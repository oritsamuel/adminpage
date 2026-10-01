"use client";

import { useEffect, useState } from "react";

type Invitee = { id: number; name: string; rewardedOrders: number; orderCount: number; paidAmount: number; unpaidAmount: number };
type Referrer = { id: number; name: string; phone: string; code: string; status: string; referralDetails?: Invitee[] };
type Order = { id: string; customer: string; owner: string; code: string; orderCount: number; commission: number; paid: boolean; inviteeId: number; referrerCode: string; };

const typeStyles = { Staff: "bg-[#e4efff] text-[#3565a5]", Merchant: "bg-[#ffe4e8] text-[#b24760]", User: "bg-[#eee7ff] text-[#7250ad]" };

function flattenReferrers(referrers: Referrer[]): Order[] {
  return referrers.flatMap((referrer) => (referrer.referralDetails ?? []).map((invitee, index) => ({
    id: `${referrer.id}-${invitee.id}-${index}`,
    customer: invitee.name,
    owner: referrer.name,
    code: referrer.code,
    orderCount: invitee.orderCount,
    commission: invitee.unpaidAmount,
    paid: invitee.orderCount === 0,
    inviteeId: invitee.id,
    referrerCode: referrer.code,
  })));
}

export default function UGCOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/ugc/dashboard", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.isSuccessful) throw new Error(payload.errorMessages?.join(" ") || "Unable to load orders.");
      const data = (payload.data || []) as Referrer[];
      setOrders(flattenReferrers(data));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load orders.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => { loadDashboard(); }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handlePay = async (order: Order) => {
    if (order.orderCount <= 0) return;
    setPayingOrderId(order.id);
    setError("");
    try {
      const response = await fetch("/api/ugc/mark-paid", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: order.referrerCode, invitees: [{ inviteeId: order.inviteeId, orderCount: order.orderCount }] }) });
      const payload = await response.json();
      if (!response.ok || !payload.isSuccessful) throw new Error(payload.errorMessages?.join(" ") || "Payment could not be marked as paid.");
      await loadDashboard();
    } catch (payError) {
      setError(payError instanceof Error ? payError.message : "Payment could not be marked as paid.");
    } finally {
      setPayingOrderId(null);
    }
  };

  return (
    <main className="ml-60 min-h-screen bg-[#f8fafc] px-4 pb-12 pt-[96px] text-[#27313b] md:px-6">
      <div className="mx-auto max-w-[1500px]">
        <header className="flex items-center gap-2 border-b border-[#e6eaee] pb-4 text-xs"><span className="font-bold">Orders</span><span className="text-[#b0b7bd]">•</span><span className="text-[#8b949e]">Hulubeje Affiliate Marketing</span><span className="ml-auto text-[#8b949e]">{new Date().toLocaleDateString()}</span></header>
        <section className="mt-5"><h1 className="text-lg font-bold">Referred Orders</h1><p className="mt-1 text-xs text-[#8b949e]">Orders generated through affiliate links.</p></section>
        {error && <p className="mt-4 rounded-lg bg-[#fff0f2] px-4 py-3 text-sm text-[#9b263c]">{error}</p>}
        <section className="mt-4 overflow-x-auto rounded-xl border border-[#e1e6ea] bg-white shadow-sm">
          <table className="w-full min-w-[980px] border-collapse text-left text-[11px]"><thead className="bg-[#f8fafc] text-[9px] font-bold uppercase tracking-wide text-[#7d8790]"><tr>{["Order", "Customer", "Affiliate Type", "Affiliate Owner", "Affiliate Code", "Unpaid Orders", "Unpaid Commission", "Status", "Action"].map((heading) => <th key={heading} className="whitespace-nowrap px-3 py-3">{heading}</th>)}</tr></thead>
            <tbody>{loading ? <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-[#8b949e]">Loading UGC orders...</td></tr> : orders.length === 0 ? <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-[#8b949e]">No referred orders found.</td></tr> : orders.map((order) => <tr key={order.id} className="border-t border-[#edf0f2] hover:bg-[#fcfdff]"><td className="px-3 py-3 font-mono text-[10px] text-[#8b949e]">{order.id}</td><td className="px-3 py-3 font-bold text-[#35404a]">{order.customer}</td><td className="px-3 py-3"><span className={`rounded px-2 py-1 text-[10px] font-bold ${typeStyles.User}`}>User</span></td><td className="px-3 py-3 font-medium">{order.owner}</td><td className="px-3 py-3 font-mono text-[#65717c]">{order.code}</td><td className="px-3 py-3 font-bold">{order.orderCount}</td><td className="px-3 py-3 font-bold text-[#9b263c]">ETB {order.commission.toFixed(2)}</td><td className="px-3 py-3"><span className={`inline-flex items-center gap-1 rounded px-2 py-1 font-bold ${order.paid ? "bg-[#d9f7e9] text-[#16845a]" : "bg-[#fff4cf] text-[#b88005]"}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{order.paid ? "Paid" : "Pending"}</span></td><td className="px-3 py-3">{order.paid ? <button disabled className="rounded-md bg-[#e7ebef] px-4 py-1.5 font-bold text-[#a5adb5]">✓ Paid</button> : <button data-viewer-write onClick={() => handlePay(order)} disabled={payingOrderId === order.id} className="rounded-md bg-[#951d3c] px-4 py-1.5 font-bold text-white hover:bg-[#7d1833] disabled:opacity-60">{payingOrderId === order.id ? "Paying..." : "▣ Pay"}</button>}</td></tr>)}</tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
