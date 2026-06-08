"use client";
import { useEffect, useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, formatEther } from "viem";
import { ConnectButton } from "./ConnectButton";

const ADDR = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x0") as `0x${string}`;
const ABI = [
  { name: "open", type: "function", stateMutability: "payable", inputs: [{ name: "isLong", type: "bool" }, { name: "leverage", type: "uint256" }], outputs: [] },
  { name: "close", type: "function", stateMutability: "nonpayable", inputs: [{ name: "id", type: "uint256" }], outputs: [] },
  { name: "setPrice", type: "function", stateMutability: "nonpayable", inputs: [{ name: "p", type: "uint256" }], outputs: [] },
  { name: "fundHouse", type: "function", stateMutability: "payable", inputs: [], outputs: [] },
  { name: "pnlOf", type: "function", stateMutability: "view", inputs: [{ name: "id", type: "uint256" }], outputs: [{ type: "int256" }] },
  { name: "valueOf", type: "function", stateMutability: "view", inputs: [{ name: "id", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { name: "getPosition", type: "function", stateMutability: "view", inputs: [{ name: "id", type: "uint256" }], outputs: [{ type: "tuple", components: [{ name: "trader", type: "address" }, { name: "isLong", type: "bool" }, { name: "collateral", type: "uint256" }, { name: "leverage", type: "uint256" }, { name: "entryPrice", type: "uint256" }, { name: "open", type: "bool" }, { name: "openedAt", type: "uint256" }] }] },
  { name: "getMyPositions", type: "function", stateMutability: "view", inputs: [{ name: "u", type: "address" }], outputs: [{ type: "uint256[]" }] },
  { name: "price", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "owner", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "houseBalance", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

function PositionRow({ id, onClose, busy }: { id: bigint; onClose: (id: bigint) => void; busy: boolean }) {
  const { data: p } = useReadContract({ address: ADDR, abi: ABI, functionName: "getPosition", args: [id] });
  const { data: pnl } = useReadContract({ address: ADDR, abi: ABI, functionName: "pnlOf", args: [id] });
  const { data: val } = useReadContract({ address: ADDR, abi: ABI, functionName: "valueOf", args: [id] });
  if (!p || !p.open) return null;
  const profit = pnl !== undefined && pnl >= 0n;
  return (
    <div className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
      <span className={`text-xs font-bold px-2 py-1 rounded ${p.isLong?"bg-green-500/20 text-green-400":"bg-red-500/20 text-red-400"}`}>{p.isLong?"LONG":"SHORT"} {p.leverage.toString()}x</span>
      <div className="flex-1 text-sm"><div className="text-gray-400">Margin {formatEther(p.collateral)} USDC</div><div className="text-xs text-gray-600">Entry {Number(formatEther(p.entryPrice)).toFixed(4)}</div></div>
      <div className="text-right"><div className={`font-bold ${profit?"text-green-400":"text-red-400"}`}>{profit?"+":""}{pnl!==undefined?Number(formatEther(pnl)).toFixed(3):"0"}</div><div className="text-xs text-gray-600">val {val?Number(formatEther(val)).toFixed(2):"0"}</div></div>
      <button onClick={()=>onClose(id)} disabled={busy} className="px-3 py-1.5 bg-gray-700 text-white text-xs font-bold rounded-lg hover:bg-gray-600 disabled:opacity-40">Close</button>
    </div>
  );
}

export default function App() {
  const { address, isConnected } = useAccount();
  const [isLong, setIsLong] = useState(true);
  const [lev, setLev] = useState(2);
  const [margin, setMargin] = useState("10");
  const [newPrice, setNewPrice] = useState("1");
  const { data: price, refetch: rPrice } = useReadContract({ address: ADDR, abi: ABI, functionName: "price" });
  const { data: house, refetch: rHouse } = useReadContract({ address: ADDR, abi: ABI, functionName: "houseBalance" });
  const { data: owner } = useReadContract({ address: ADDR, abi: ABI, functionName: "owner" });
  const { data: myPos, refetch: rMy } = useReadContract({ address: ADDR, abi: ABI, functionName: "getMyPositions", args: address ? [address] : undefined, query: { enabled: !!address } });
  const { writeContract, data: txHash, isPending, reset } = useWriteContract();
  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash, query: { enabled: !!txHash } });
  useEffect(() => { if(!isSuccess) return; rPrice(); rHouse(); rMy(); reset(); }, [isSuccess]); // eslint-disable-line
  const busy = isPending || isConfirming;
  const isOwner = address?.toLowerCase() === owner?.toLowerCase();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3"><span className="text-2xl">📈</span><span className="font-bold text-lg">Arc Perps</span><span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full">Mark {price?Number(formatEther(price)).toFixed(4):"1"}</span></div>
        <ConnectButton />
      </header>
      <main className="flex-1 max-w-md mx-auto w-full px-4 py-8 space-y-6">
        <div className="text-center"><h1 className="text-4xl font-extrabold bg-gradient-to-br from-green-400 to-red-500 bg-clip-text text-transparent">Perps 📈</h1><p className="text-gray-400 text-sm mt-1">Leveraged long/short · house {house?Number(formatEther(house)).toFixed(0):"0"} USDC</p></div>
        {busy && <div className="text-center text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl py-3 animate-pulse">{isPending ? "Confirm in wallet..." : "Processing..."}</div>}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button onClick={()=>setIsLong(true)} className={`py-3 rounded-xl font-bold border transition-all ${isLong?"bg-green-500/20 border-green-500 text-green-400":"bg-gray-800 border-gray-700 text-gray-400"}`}>📈 Long</button>
            <button onClick={()=>setIsLong(false)} className={`py-3 rounded-xl font-bold border transition-all ${!isLong?"bg-red-500/20 border-red-500 text-red-400":"bg-gray-800 border-gray-700 text-gray-400"}`}>📉 Short</button>
          </div>
          <div className="space-y-1"><label className="text-xs text-gray-500 uppercase tracking-wider">Margin (USDC)</label><input value={margin} onChange={e=>setMargin(e.target.value)} type="number" className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-500" /></div>
          <div className="space-y-1"><label className="text-xs text-gray-500 uppercase tracking-wider">Leverage: {lev}x</label><input type="range" min="1" max="10" value={lev} onChange={e=>setLev(Number(e.target.value))} className="w-full accent-green-500" /><div className="text-xs text-gray-500 text-right">Position size: {(Number(margin||"0")*lev).toFixed(0)} USDC</div></div>
          <button onClick={()=>writeContract({address:ADDR,abi:ABI,functionName:"open",args:[isLong,BigInt(lev)],value:parseEther(margin||"0")})} disabled={!isConnected||busy} className={`w-full py-3 font-bold rounded-xl text-black hover:opacity-90 disabled:opacity-40 ${isLong?"bg-gradient-to-r from-green-400 to-emerald-500":"bg-gradient-to-r from-red-400 to-rose-500"}`}>{!isConnected?"Connect Wallet":busy?"...":`Open ${isLong?"Long":"Short"} ${lev}x`}</button>
        </div>
        {myPos && myPos.length > 0 && <div className="space-y-2"><h2 className="text-xs text-gray-500 uppercase tracking-widest">My Positions</h2>{myPos.slice().reverse().map(id => <PositionRow key={id.toString()} id={id} busy={busy} onClose={(i)=>writeContract({address:ADDR,abi:ABI,functionName:"close",args:[i]})} />)}</div>}
        {isOwner && <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-2"><p className="text-xs text-gray-500 uppercase tracking-wider">Oracle: set mark price</p><div className="flex gap-2"><input value={newPrice} onChange={e=>setNewPrice(e.target.value)} type="number" step="0.01" className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none" /><button onClick={()=>writeContract({address:ADDR,abi:ABI,functionName:"setPrice",args:[parseEther(newPrice||"0")]})} disabled={busy} className="px-4 py-2 bg-green-500 text-black font-bold rounded-lg hover:bg-green-400 disabled:opacity-40 text-sm">Set</button><button onClick={()=>writeContract({address:ADDR,abi:ABI,functionName:"fundHouse",value:parseEther("100")})} disabled={busy} className="px-3 py-2 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 text-sm">Fund</button></div></div>}
      </main>
      <footer className="border-t border-gray-800 py-4 text-center text-gray-600 text-xs">Built on <a href="https://arc.network" target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline">Arc Network</a></footer>
    </div>
  );
}
