"use client";

import { useEffect, useState } from "react";

type UGCOrdersResponse = {
  isSuccessful?: boolean;
  data?: {
    items?: Array<{
      orderId?: number | string;
      inviteeId?: number | string;
      inviteeName?: string;
      referrerId?: number | string;
      referrerType?: string;
      referrerName?: string;
      referrerCode?: string;
      orderDate?: string;
      orderAmount?: number | string;
      commissionAmount?: number | string;
      commissionPercentage?: number | string;
      status?: string;
    }>;
    page?: number;
    pageSize?: number;
    totalCount?: number;
    totalPages?: number;
    hasNext?: boolean;
  };
  errorMessages?: string[];
};

type Order = {
  id: string;
  customer: string;
  owner: string;
  code: string;
  affiliateType: string;
  orderAmount: number;
  commission: number;
  commissionPercentage: number | null;
  paid: boolean;
  inviteeId: number;
  referrerId: number;
  referrerCode: string;
  orderId: number | string;
};

const typeStyles = { Staff: "bg-[#e4efff] text-[#3565a5]", Merchant: "bg-[#ffe4e8] text-[#b24760]", User: "bg-[#eee7ff] text-[#7250ad]" };

const toNumber = (value: number | string | undefined) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const commissionTiers = [10, 8, 5];

function resolveCommissionPercentage(
  reportedPercentage: number,
  orderAmount: number,
  commission: number,
): number | null {
  const amountInCents = Math.round(commission * 100);
  const matchingTiers = commissionTiers.filter(
    (tier) => Math.round(orderAmount * tier) === amountInCents,
  );
  if (matchingTiers.includes(reportedPercentage)) return reportedPercentage;
  return matchingTiers.length === 1 ? matchingTiers[0] : null;
}

export default function UGCOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadOrders = async () => {
    setLoading(true);
    try {
      const mappedOrders: Order[] = [];
      let page = 1;
      while (true) {
        const response = await fetch(`/api/ugc/orders?page=${page}&pageSize=100`, { cache: "no-store" });
        const payload = (await response.json()) as UGCOrdersResponse;
        if (!response.ok || !payload.isSuccessful) {
          throw new Error(payload.errorMessages?.join(" ") || "Unable to load orders.");
        }

        const pageData = payload.data;
        if (!pageData || !Array.isArray(pageData.items) || typeof pageData.hasNext !== "boolean" || typeof pageData.totalPages !== "number") {
          throw new Error("The /ugc/orders endpoint returned an unexpected paginated response.");
        }

        mappedOrders.push(...pageData.items.map((item, index) => {
          const inviteeId = Number(item.inviteeId ?? 0);
          const referrerId = Number(item.referrerId ?? 0);
          const customer = item.inviteeName || "Unknown customer";
          const owner = item.referrerName || "Affiliate owner";
          const code = item.referrerCode || "";
          const affiliateType = item.referrerType || "User";
          const paid = (item.status || "Pending").toLowerCase() === "paid";
          const orderId = item.orderId ?? `${item.inviteeId ?? "invitee"}-${index}`;
          const orderAmount = toNumber(item.orderAmount);
          const commission = toNumber(item.commissionAmount);
          const commissionPercentage = resolveCommissionPercentage(
            toNumber(item.commissionPercentage),
            orderAmount,
            commission,
          );

          return {
            id: String(orderId),
            customer,
            owner,
            code,
            affiliateType,
            orderAmount,
            commission,
            commissionPercentage,
            paid,
            inviteeId: inviteeId || 0,
            referrerId: referrerId || 0,
            referrerCode: code,
            orderId,
          };
        }));

        if (!pageData.hasNext) break;
        if (page >= pageData.totalPages) {
          throw new Error("The /ugc/orders endpoint returned inconsistent pagination metadata.");
        }
        page += 1;
      }
      setOrders(mappedOrders);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load orders.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadOrders();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handlePay = async (order: Order) => {
    if (!order.referrerId || !order.inviteeId || !order.orderId || order.affiliateType.toLowerCase() === "merchant") return;
    if (!order.commissionPercentage) {
      setError(`Cannot pay order ${order.orderId}: its commission rate does not match a documented tier (10%, 8%, or 5%).`);
      return;
    }
    setPayingOrderId(order.id);
    setError("");
    try {
      const response = await fetch("/api/ugc/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referrerId: order.referrerId,
          invitees: [{
            inviteeId: order.inviteeId,
            orderId: order.orderId,
            amount: order.commission,
            commissionPercentage: order.commissionPercentage,
          }],
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.isSuccessful) {
        throw new Error(payload.errorMessages?.join(" ") || "Payment could not be marked as paid.");
      }
      await loadOrders();
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
          <table className="w-full min-w-[980px] border-collapse text-left text-[11px]"><thead className="bg-[#f8fafc] text-[9px] font-bold uppercase tracking-wide text-[#7d8790]"><tr>{["Order", "Customer", "Affiliate Type", "Affiliate Owner", "Affiliate Code", "Order Amount", "Commission", "Status", "Action"].map((heading) => <th key={heading} className="whitespace-nowrap px-3 py-3">{heading}</th>)}</tr></thead>
            <tbody>{loading ? <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-[#8b949e]">Loading UGC orders...</td></tr> : orders.length === 0 ? <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-[#8b949e]">No referred orders found.</td></tr> : orders.map((order) => <tr key={order.id} className="border-t border-[#edf0f2] hover:bg-[#fcfdff]"><td className="px-3 py-3 font-mono text-[10px] text-[#8b949e]">{order.id}</td><td className="px-3 py-3 font-bold text-[#35404a]">{order.customer}</td><td className="px-3 py-3"><span className={`rounded px-2 py-1 text-[10px] font-bold ${typeStyles[order.affiliateType as keyof typeof typeStyles] ?? typeStyles.User}`}>{order.affiliateType}</span></td><td className="px-3 py-3 font-medium">{order.owner}</td><td className="px-3 py-3 font-mono text-[#65717c]">{order.code}</td><td className="px-3 py-3 font-bold">ETB {order.orderAmount.toFixed(2)}</td><td className="px-3 py-3 font-bold text-[#9b263c]">ETB {order.commission.toFixed(2)} ({order.commissionPercentage ?? "—"}%)</td><td className="px-3 py-3"><span className={`inline-flex items-center gap-1 rounded px-2 py-1 font-bold ${order.paid ? "bg-[#d9f7e9] text-[#16845a]" : "bg-[#fff4cf] text-[#b88005]"}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{order.paid ? "Paid" : "Pending"}</span></td><td className="px-3 py-3">{order.paid ? <button disabled className="rounded-md bg-[#e7ebef] px-4 py-1.5 font-bold text-[#a5adb5]">✓ Paid</button> : order.affiliateType.toLowerCase() === "merchant" ? <span className="text-[10px] text-[#8b949e]" title="Merchant orders are not eligible for commission payments in the API contract.">Not eligible</span> : <button data-viewer-write onClick={() => handlePay(order)} disabled={payingOrderId === order.id || !order.commissionPercentage} title={!order.commissionPercentage ? "The commission amount does not establish one valid tier." : undefined} className="rounded-md bg-[#951d3c] px-4 py-1.5 font-bold text-white hover:bg-[#7d1833] disabled:opacity-60">{payingOrderId === order.id ? "Paying..." : "▣ Pay"}</button>}</td></tr>)}</tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
