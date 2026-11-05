"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  appPages,
  canAccessPath,
  readAccounts,
  sessionStorageKey,
  type AdminAccount,
  type AppPageId,
} from "../auth/accessControl";

type UGCKeyMetrics = {
  merchantLinks: number;
  staffLinks: number;
  userLinks: number;
  totalInvitedUsers: number;
  activeReferrals: number;
  expiredReferrals: number;
  totalOrders: number;
  totalCommission: number;
};

type UGCActivity = {
  metrics: UGCKeyMetrics;
  pendingOrderCount: number;
  pendingCommission: number | null;
};

type EventSummary = {
  totalRevenue: number;
  totalBookings: number;
  totalRedeemed: number;
  notRedeemed: number;
};

type Metric = {
  label: string;
  value: string;
};

const workspaceDetails: Record<AppPageId, { href: string; description: string }> = {
  ugc: { href: "/UGC", description: "Affiliate links, referred orders, and commissions." },
  waiterManagement: { href: "/waiterManagement", description: "Waiter performance and tips; requires a company branch." },
  eventManagement: { href: "/eventManagement", description: "Bookings, ticket status, and ticket scanning." },
  hbWebsite: { href: "/HBWebsite", description: "Website workspace." },
};

function formatAmount(amount: number) {
  return `ETB ${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function metric(label: string, value: number | string): Metric {
  return { label, value: typeof value === "number" ? value.toLocaleString() : value };
}

export default function OverviewDashboard() {
  const [account, setAccount] = useState<AdminAccount | null>(null);
  const [today, setToday] = useState("");
  const [ugcActivity, setUgcActivity] = useState<UGCActivity | null>(null);
  const [ugcError, setUgcError] = useState("");
  const [eventSummary, setEventSummary] = useState<EventSummary | null>(null);
  const [eventError, setEventError] = useState("");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setToday(new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }));
      try {
        const session = JSON.parse(localStorage.getItem(sessionStorageKey) || "{}") as { id?: string };
        setAccount(readAccounts().find((user) => user.id === session.id) || null);
      } catch {
        localStorage.removeItem(sessionStorageKey);
      }
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!account || !canAccessPath(account, "/UGC")) return;
    let isCurrent = true;
    Promise.all([
      fetch("/api/ugc/kpis", { cache: "no-store" }),
      fetch("/api/ugc/orders?status=pending&page=1&pageSize=100", { cache: "no-store" }),
    ])
      .then(async ([kpiResponse, ordersResponse]) => {
        const [kpiPayload, ordersPayload] = await Promise.all([kpiResponse.json(), ordersResponse.json()]) as [
          { isSuccessful?: boolean; data?: UGCKeyMetrics; errorMessages?: string[] },
          { isSuccessful?: boolean; data?: { items?: Array<{ commissionAmount?: number }>; totalCount?: number; hasNext?: boolean }; errorMessages?: string[] },
        ];
        if (!kpiResponse.ok || !kpiPayload.isSuccessful || !kpiPayload.data) {
          throw new Error(kpiPayload.errorMessages?.join(" ") || "Unable to load UGC KPIs.");
        }
        if (!ordersResponse.ok || !ordersPayload.isSuccessful || !ordersPayload.data || !Array.isArray(ordersPayload.data.items) || typeof ordersPayload.data.totalCount !== "number") {
          throw new Error(ordersPayload.errorMessages?.join(" ") || "Unable to load pending UGC orders.");
        }
        const pendingCommission = ordersPayload.data.hasNext
          ? null
          : ordersPayload.data.items.reduce((total, order) => total + (order.commissionAmount ?? 0), 0);
        if (isCurrent) {
          setUgcActivity({
            metrics: kpiPayload.data,
            pendingOrderCount: ordersPayload.data.totalCount,
            pendingCommission,
          });
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) setUgcError(error instanceof Error ? error.message : "Unable to load UGC activity.");
      });
    return () => { isCurrent = false; };
  }, [account]);

  useEffect(() => {
    if (!account || !canAccessPath(account, "/eventManagement")) return;
    let isCurrent = true;
    fetch("/eventManagement/api/transactions", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as {
          success?: boolean;
          summary?: EventSummary;
        };
        if (!response.ok || !payload.success || !payload.summary) {
          throw new Error("Unable to load event activity.");
        }
        if (isCurrent) {
          setEventSummary(payload.summary);
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) setEventError(error instanceof Error ? error.message : "Unable to load event activity.");
      });
    return () => { isCurrent = false; };
  }, [account]);

  const accessibleWorkspaces = account
    ? appPages.filter((page) => canAccessPath(account, workspaceDetails[page.id].href))
    : [];

  const pendingOrderCount = ugcActivity?.pendingOrderCount ?? 0;
  const ugcMetrics: Metric[] = ugcActivity ? [
    metric("Affiliate links", ugcActivity.metrics.merchantLinks + ugcActivity.metrics.staffLinks + ugcActivity.metrics.userLinks),
    metric("Active referrals", ugcActivity.metrics.activeReferrals),
    metric("Invited users", ugcActivity.metrics.totalInvitedUsers),
    metric("Referred orders", ugcActivity.metrics.totalOrders),
  ] : [];

  const eventMetrics: Metric[] = eventSummary ? [
    metric("Tickets booked", eventSummary.totalBookings),
    metric("Tickets redeemed", eventSummary.totalRedeemed),
    metric("Not yet redeemed", eventSummary.notRedeemed),
    metric("Ticket revenue", formatAmount(eventSummary.totalRevenue)),
  ] : [];

  const hasPendingOrders = pendingOrderCount > 0;

  return (
    <main id="overview" className="ml-60 min-h-screen bg-[#f5f7f8] pt-[76px] text-[#18252b]">
      <div className="mx-auto max-w-[1440px] px-6 py-8 md:px-10 md:py-10">
        <header className="mb-9 flex flex-wrap items-end justify-between gap-4 border-b border-[#dce4e5] pb-6">
          <div>
            {today && <p className="mb-3 text-xs font-bold tracking-[0.18em] text-[#e0784f] uppercase">{today}</p>}
            <h2 className="text-4xl font-semibold text-[#183c3d] md:text-5xl">Good morning, {account?.name || "there"}</h2>
            <p className="mt-3 text-sm text-[#738184]">Your operation at a glance.</p>
          </div>
          {account && <span className="rounded-md border border-[#dce4e5] bg-white px-3 py-2 text-xs font-semibold text-[#607071]">{account.role}</span>}
        </header>

        {account && canAccessPath(account, "/UGC") && <section aria-labelledby="attention-title" className="mb-9">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h3 id="attention-title" className="text-base font-semibold text-[#183c3d]">Needs attention</h3>
            <Link href="/UGC/orders" className="text-xs font-semibold text-[#347b56] hover:underline">Open referred orders</Link>
          </div>
          <div className="border-l-2 border-[#e0784f] bg-white px-4 py-4 sm:px-5">
            {ugcError ? <p className="text-sm text-[#738184]">UGC activity is unavailable right now.</p>
              : ugcActivity === null ? <p className="text-sm text-[#738184]">Checking for unpaid referred orders...</p>
                : hasPendingOrders ? <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[#27313b]">{pendingOrderCount.toLocaleString()} referred orders awaiting payment</p>
                  <span className="text-sm font-semibold text-[#9b263c]">{ugcActivity.pendingCommission === null ? "See orders for commission total" : formatAmount(ugcActivity.pendingCommission)}</span>
                </div>
                  : <p className="text-sm text-[#405658]">No referred orders are awaiting payment.</p>}
          </div>
        </section>}

        <section aria-labelledby="snapshot-title" className="mb-10">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
            <h3 id="snapshot-title" className="text-base font-semibold text-[#183c3d]">Operational snapshot</h3>
            <Link href="/Settings" className="text-xs font-semibold text-[#607071] hover:text-[#183c3d]">Access settings</Link>
          </div>
          <div className="divide-y divide-[#dce4e5] border-y border-[#dce4e5]">
            {account && canAccessPath(account, "/UGC") && <article className="grid gap-4 bg-white px-4 py-5 sm:px-5 lg:grid-cols-[minmax(180px,0.8fr)_minmax(0,2fr)] lg:items-center">
              <div>
                <Link href="/UGC" className="text-sm font-semibold text-[#183c3d] hover:underline">HB UGC</Link>
                <p className="mt-1 text-xs text-[#738184]">Affiliate activity and commissions</p>
              </div>
              {ugcError ? <p className="text-sm text-[#738184]">UGC activity is unavailable right now.</p>
                : ugcActivity === null ? <p className="text-sm text-[#738184]">Loading affiliate activity...</p>
                  : <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {ugcMetrics.map((item) => <div key={item.label}><dt className="text-[11px] text-[#738184]">{item.label}</dt><dd className="mt-1 text-lg font-semibold text-[#183c3d]">{item.value}</dd></div>)}
                    <div className="col-span-2 sm:col-span-4"><dt className="text-[11px] text-[#738184]">Paid commission</dt><dd className="mt-1 text-sm font-semibold text-[#9b263c]">{formatAmount(ugcActivity.metrics.totalCommission)}</dd></div>
                  </dl>}
            </article>}

            {account && canAccessPath(account, "/eventManagement") && <article className="grid gap-4 bg-white px-4 py-5 sm:px-5 lg:grid-cols-[minmax(180px,0.8fr)_minmax(0,2fr)] lg:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <Link href="/eventManagement" className="text-sm font-semibold text-[#183c3d] hover:underline">Event Dashboard</Link>
                </div>
                <p className="mt-1 text-xs text-[#738184]">Bookings and ticket redemption</p>
              </div>
              {eventError ? <p className="text-sm text-[#738184]">Event activity is unavailable right now.</p>
                : eventSummary === null ? <p className="text-sm text-[#738184]">Loading event activity...</p>
                  : <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {eventMetrics.map((item) => <div key={item.label}><dt className="text-[11px] text-[#738184]">{item.label}</dt><dd className="mt-1 text-lg font-semibold text-[#183c3d]">{item.value}</dd></div>)}
                  </dl>}
            </article>}
          </div>
        </section>

        <section aria-labelledby="workspaces-title">
          <div className="mb-3">
            <h3 id="workspaces-title" className="text-base font-semibold text-[#183c3d]">Your workspaces</h3>
          </div>
          <div className="grid gap-x-8 sm:grid-cols-2 xl:grid-cols-4">
            {account && accessibleWorkspaces.map((workspace) => <Link key={workspace.id} href={workspaceDetails[workspace.id].href} className="group border-t border-[#dce4e5] py-4">
              <span className="text-sm font-semibold text-[#183c3d] group-hover:text-[#347b56]">{workspace.label}<span className="ml-2" aria-hidden="true">→</span></span>
              <span className="mt-1 block text-xs leading-5 text-[#738184]">{workspaceDetails[workspace.id].description}</span>
            </Link>)}
            {account && accessibleWorkspaces.length === 0 && <p className="border-t border-[#dce4e5] py-4 text-sm text-[#738184]">No operational pages are assigned to this account yet.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}