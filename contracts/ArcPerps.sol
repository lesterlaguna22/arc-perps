// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
// Simplified perps: owner is the price oracle + house. Open long/short with leverage, close for PnL.
contract ArcPerps {
    address public owner;
    uint256 public price = 1e18;     // mark price (USDC, 1e18)
    uint256 public maxLeverage = 10;
    struct Position { address trader; bool isLong; uint256 collateral; uint256 leverage; uint256 entryPrice; bool open; uint256 openedAt; }
    Position[] public positions;
    mapping(address => uint256[]) public myPositions;
    event PriceUpdated(uint256 price);
    event Opened(uint256 indexed id, address trader, bool isLong, uint256 collateral, uint256 leverage, uint256 entry);
    event Closed(uint256 indexed id, int256 pnl, uint256 payout);
    constructor() { owner = msg.sender; }
    receive() external payable {}
    function fundHouse() external payable { require(msg.sender==owner,"no"); }
    function setPrice(uint256 p) external { require(msg.sender==owner,"Not owner"); require(p>0,"bad"); price = p; emit PriceUpdated(p); }
    function open(bool isLong, uint256 leverage) external payable {
        require(msg.value > 0 && leverage >= 1 && leverage <= maxLeverage, "Invalid");
        uint256 id = positions.length;
        positions.push(Position(msg.sender, isLong, msg.value, leverage, price, true, block.timestamp));
        myPositions[msg.sender].push(id);
        emit Opened(id, msg.sender, isLong, msg.value, leverage, price);
    }
    // pnl = collateral * leverage * (price-entry)/entry * dir
    function pnlOf(uint256 id) public view returns (int256) {
        Position memory p = positions[id];
        if (!p.open) return 0;
        int256 diff = int256(price) - int256(p.entryPrice);
        int256 raw = int256(p.collateral) * int256(p.leverage) * diff / int256(p.entryPrice);
        return p.isLong ? raw : -raw;
    }
    function valueOf(uint256 id) public view returns (uint256) {
        Position memory p = positions[id];
        int256 pnl = pnlOf(id);
        int256 v = int256(p.collateral) + pnl;
        if (v < 0) return 0;
        return uint256(v);
    }
    function close(uint256 id) external {
        Position storage p = positions[id];
        require(p.trader == msg.sender && p.open, "Cannot close");
        uint256 payout = valueOf(id);
        int256 pnl = pnlOf(id);
        p.open = false;
        if (payout > 0) {
            require(address(this).balance >= payout, "House illiquid");
            (bool ok,) = payable(p.trader).call{value: payout}(""); require(ok,"fail");
        }
        emit Closed(id, pnl, payout);
    }
    function houseBalance() external view returns (uint256) { return address(this).balance; }
    function getPosition(uint256 id) external view returns (Position memory) { return positions[id]; }
    function getMyPositions(address u) external view returns (uint256[] memory) { return myPositions[u]; }
    function totalPositions() external view returns (uint256) { return positions.length; }
}