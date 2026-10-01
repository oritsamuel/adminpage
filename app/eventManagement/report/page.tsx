"use client";

import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";

type Transaction = {
  id: string;
  customerName: string;
  eventName: string;
  eventOrganizer?: string;
  quantity: number;
  totalPrice: number;
  eventDateTime: string;
  status: string;
  ticketType?: string;
};

type Summary = {
  totalRevenue: number;
  revenueChangePercent: number;
  totalBookings: number;
  bookingsChangePercent: number;
  totalRedeemed: number;
  redeemedPercent: number;
  notRedeemed: number;
  notRedeemedPercent: number;
  remainingTickets: number;
  eventCapacity: number;
};

export default function ReportsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [filterEvent, setFilterEvent] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      router.push('/login');
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/eventManagement/api/transactions");
        if (!res.ok) throw new Error("Failed to fetch transactions");
        const json = await res.json();
        if (!mounted) return;
        setTransactions(json.data || []);
        setSummary(json.summary || null);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  const events = useMemo(() => {
    const s = new Set<string>();
    transactions.forEach((t) => s.add(t.eventName));
    return ["all", ...Array.from(s)];
  }, [transactions]);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (filterEvent !== "all" && t.eventName !== filterEvent) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          t.customerName.toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q) ||
          t.eventName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [transactions, filterEvent, search]);

  function fmt(n?: number) {
    if (n == null) return "—";
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return (
    <div className="event-dashboard event-report-page">
      <div className="glass-panel">
        <div className="table-header">
          <div className="table-title">Reports</div>

          <div>
            <select
              className="filter-select"
              value={filterEvent}
              onChange={(e) => setFilterEvent(e.target.value)}
              aria-label="Filter by event"
            >
              {events.map((ev) => (
                <option key={ev} value={ev}>
                  {ev === "all" ? "All events" : ev}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ padding: "1.25rem" }}>
          {loading ? (
            <p>Loading reports…</p>
          ) : error ? (
            <p style={{ color: "var(--danger)" }}>Error: {error}</p>
          ) : (
            <>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-title">Total Revenue</div>
                  <div className="stat-value highlight">{summary ? fmt(summary.totalRevenue) : "—"}</div>
                  <div className={`stat-sub ${summary && summary.revenueChangePercent > 0 ? "up" : summary && summary.revenueChangePercent < 0 ? "down" : "neutral"}`}>
                    {summary ? `${summary.revenueChangePercent}% vs yesterday` : ""}
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-title">Bookings</div>
                  <div className="stat-value">{summary ? summary.totalBookings : "—"}</div>
                  <div className={`stat-sub ${summary && summary.bookingsChangePercent > 0 ? "up" : summary && summary.bookingsChangePercent < 0 ? "down" : "neutral"}`}>
                    {summary ? `${summary.bookingsChangePercent}% vs yesterday` : ""}
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-title">Redeemed</div>
                  <div className="stat-value">{summary ? `${summary.redeemedPercent}%` : "—"}</div>
                  <div className="stat-sub neutral">{summary ? `${summary.totalRedeemed} tickets redeemed` : ""}</div>
                </div>

                <div className="stat-card">
                  <div className="stat-title">Not Redeemed</div>
                  <div className="stat-value">{summary ? `${summary.notRedeemed}` : "—"}</div>
                  <div className="stat-sub neutral">{summary ? `${summary.notRedeemedPercent}%` : ""}</div>
                </div>

                <div className="stat-card">
                  <div className="stat-title">Remaining Tickets</div>
                  <div className="stat-value">{summary ? summary.remainingTickets : "—"}</div>
                  <div className="stat-sub neutral">Capacity: {summary ? summary.eventCapacity : "—"}</div>
                </div>
              </div>

              <div className="filter-bar">
                <div className="filter-search-wrap">
                  <div className="filter-search-icon">🔍</div>
                  <input
                    className="filter-search"
                    placeholder="Search by customer, voucher or event"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div style={{ marginLeft: "auto" }}>
                  <button
                    className="btn-clear-filters"
                    onClick={() => {
                      setSearch("");
                      setFilterEvent("all");
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr 360px', alignItems: 'start' }}>
                <div className="glass-panel" style={{ padding: '1rem' }}>
                  <h3 style={{ margin: '0 0 0.75rem 0' }}>Revenue by Event</h3>
                  <EventRevenueChart transactions={filtered} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="glass-panel" style={{ padding: '1rem' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0' }}>Status Breakdown</h4>
                    <StatusBreakdown transactions={filtered} />
                  </div>

                  <div className="glass-panel" style={{ padding: '1rem' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0' }}>Ticket Type Share</h4>
                    <TicketTypeShare transactions={filtered} />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function EventRevenueChart({ transactions }: { transactions: Transaction[] }) {
  const groups: { label: string; revenue: number }[] = [];
  const map = new Map<string, number>();
  transactions.forEach((t) => map.set(t.eventName, (map.get(t.eventName) || 0) + t.totalPrice));
  map.forEach((v, k) => groups.push({ label: k, revenue: v }));
  groups.sort((a, b) => b.revenue - a.revenue);

  const max = Math.max(1, ...groups.map((g) => g.revenue));
  const height = 140;

  return (
    <div style={{ width: '100%' }}>
      {groups.length === 0 ? (
        <div style={{ color: 'var(--text-muted)' }}>No data for selected filters.</div>
      ) : (
        <svg viewBox={`0 0 ${groups.length * 80} ${height}`} width="100%" height={height} preserveAspectRatio="xMidYMid meet">
          {groups.map((g, i) => {
            const bw = 40;
            const x = i * 80 + 20;
            const h = Math.max(4, Math.round((g.revenue / max) * (height - 30)));
            const y = height - h - 20;
            return (
              <g key={g.label}>
                <rect x={x} y={y} width={bw} height={h} rx={6} fill="var(--accent)" opacity={0.95} />
                <text x={x + bw / 2} y={height - 4} fontSize={11} textAnchor="middle" fill="var(--text-secondary)">{g.label}</text>
                <text x={x + bw / 2} y={y - 6} fontSize={11} textAnchor="middle" fill="var(--text-primary)">{Math.round(g.revenue)}</text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

function StatusBreakdown({ transactions }: { transactions: Transaction[] }) {
  const counts = transactions.reduce((acc: Record<string, number>, t) => {
    acc[t.status] = (acc[t.status] || 0) + t.quantity;
    return acc;
  }, {});
  const total = Object.values(counts).reduce((s, v) => s + v, 0) || 1;
  const colors: Record<string, string> = { Redeemed: 'var(--success)', Booked: 'var(--info)', Used: 'var(--accent)', Pending: 'var(--warning)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {Object.entries(counts).length === 0 ? (
        <div style={{ color: 'var(--text-muted)' }}>No status data</div>
      ) : (
        Object.entries(counts).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '8rem', color: 'var(--text-secondary)', fontWeight: 700 }}>{k}</div>
            <div style={{ flex: 1, height: '12px', background: 'var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ width: `${Math.round((v / total) * 100)}%`, height: '12px', background: colors[k] || 'var(--accent)', borderRadius: 8 }} />
            </div>
            <div style={{ width: '3.25rem', textAlign: 'right', color: 'var(--text-primary)', fontWeight: 700 }}>{v}</div>
          </div>
        ))
      )}
    </div>
  );
}

function TicketTypeShare({ transactions }: { transactions: Transaction[] }) {
  const counts = transactions.reduce((acc: Record<string, number>, t) => {
    acc[t.ticketType as string] = (acc[t.ticketType as string] || 0) + t.quantity;
    return acc;
  }, {});
  const total = Object.values(counts).reduce((s, v) => s + v, 0) || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {Object.entries(counts).length === 0 ? (
        <div style={{ color: 'var(--text-muted)' }}>No ticket type data</div>
      ) : (
        Object.entries(counts).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '8rem', color: 'var(--text-secondary)', fontWeight: 700 }}>{k}</div>
            <div style={{ flex: 1, height: '12px', background: 'var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ width: `${Math.round((v / total) * 100)}%`, height: '12px', background: 'var(--accent)', borderRadius: 8 }} />
            </div>
            <div style={{ width: '3.25rem', textAlign: 'right', color: 'var(--text-primary)', fontWeight: 700 }}>{v}</div>
          </div>
        ))
      )}
    </div>
  );
}
