"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type TicketTransaction = {
  id: string;
  customerName: string;
  customerContact: string;
  voucherCode: string;
  bookingDateTime: string;
  eventName: string;
  eventOrganizer: string;
  eventDateTime: string;
  paymentPhone: string;
  paymentMethod: string;
  paymentReference: string;
  quantity: number;
  totalPrice: number;
  invitedToName: string;
  invitedContact: string;
  status: 'Booked' | 'Redeemed';
  ticketType: 'Regular' | 'VIP' | 'VVIP';
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

function ChangeIndicator({ value }: { value: number }) {
  if (value === 0) return <span className="stat-sub neutral">— vs yesterday</span>;
  const isUp = value > 0;
  return (
    <span className={`stat-sub ${isUp ? 'up' : 'down'}`}>
      {isUp ? '▲' : '▼'} {Math.abs(value)}% vs yesterday
    </span>
  );
}

function PercentBar({ percent, color }: { percent: number; color: string }) {
  const clamped = Math.min(100, Math.max(0, percent || 0));
  return (
    <div style={{ marginTop: '0.5rem' }}>
      <div style={{ height: '4px', background: '#E2E8F0', borderRadius: '99px', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${clamped}%`,
          background: color,
          borderRadius: '99px',
          transition: 'width 0.6s ease',
        }} />
      </div>
    </div>
  );
}

export default function EventManagement() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<TicketTransaction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filterType, setFilterType] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterEvent, setFilterEvent] = useState<string>('All');
  const [filterOrganizer, setFilterOrganizer] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterPayment, setFilterPayment] = useState<string>('All');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [selectedTicket, setSelectedTicket] = useState<TicketTransaction | null>(null);
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [scanValue, setScanValue] = useState('');
  const [scanError, setScanError] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      router.push('/login');
      return;
    }

    async function fetchTransactions() {
      try {
        const res = await fetch('/eventManagement/api/transactions?t=' + Date.now());
        if (!res.ok) throw new Error('API error');
        const data = await res.json();
        console.log('API Response:', data);
        if (data.success && data.summary) {
          setTransactions(data.data ?? []);
          setSummary(data.summary);
        } else if (data.error) {
          console.error('API returned error:', data.error);
          setError(true);
        } else {
          console.error('Unexpected response format:', data);
          setError(true);
        }
      } catch (err) {
        console.error('Failed to fetch transactions:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchTransactions();
  }, [router]);

  const formatDateTime = (dateString: string) =>
    new Date(dateString).toLocaleString('en-US', {
      month: 'numeric', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
    });

  const formatDateTimeSplit = (dateString: string) => {
    const d = new Date(dateString);
    const datePart = d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
    const timePart = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    return (
      <span className="datetime-cell">
        <span className="date-part">{datePart}</span>
        <span className="time-part">{timePart}</span>
      </span>
    );
  };

  const getTicketBadge = (type: string) => {
    const cls = type === 'Regular' ? 'badge-regular' : type === 'VIP' ? 'badge-vip' : 'badge-vvip';
    return <span className={`badge ${cls}`}>{type}</span>;
  };

  const getStatusBadge = (status: string) => {
    const cls = status === 'Redeemed' ? 'badge-redeemed' : 'badge-booked';
    return <span className={`badge ${cls}`}>{status}</span>;
  };

  // Derived unique options for dropdowns
  const uniqueEvents = Array.from(new Set(transactions.map(t => t.eventName))).sort();
  const uniqueOrganizers = Array.from(new Set(transactions.map(t => t.eventOrganizer))).sort();
  const uniquePayments = Array.from(new Set(transactions.map(t => t.paymentMethod))).sort();

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  };

  const resolveTicketFromCode = (value: string) => {
    const normalized = value.trim();
    if (!normalized) {
      setScanError('Enter or scan a ticket ID or voucher code.');
      return;
    }

    const match = transactions.find((ticket) => {
      const idMatch = ticket.id.toLowerCase() === normalized.toLowerCase();
      const voucherMatch = ticket.voucherCode.toLowerCase() === normalized.toLowerCase();
      return idMatch || voucherMatch;
    });

    if (!match) {
      setScanError('No ticket was found for that QR code.');
      return;
    }

    setSelectedTicket(match);
    setIsScanOpen(false);
    setScanValue('');
    setScanError('');
    stopCamera();
  };

  const startCameraScan = async () => {
    const BarcodeDetectorCtor = (window as Window & {
      BarcodeDetector?: new (options?: { formats?: string[] }) => {
        detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
      };
    }).BarcodeDetector;

    if (!BarcodeDetectorCtor || !navigator.mediaDevices?.getUserMedia) {
      setScanError('Camera scanning is not supported in this browser. Please type the ticket ID instead.');
      setCameraReady(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);

      const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
      const tick = async () => {
        if (!videoRef.current || !streamRef.current) return;

        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length > 0 && barcodes[0]?.rawValue) {
            resolveTicketFromCode(barcodes[0].rawValue);
            return;
          }
        } catch {
          // Ignore detection errors and continue scanning.
        }

        window.setTimeout(tick, 800);
      };

      window.setTimeout(tick, 800);
    } catch {
      setScanError('Unable to access the camera. Please type the ticket ID instead.');
      setCameraReady(false);
    }
  };

  const handleRedeem = async (id: string) => {
    try {
      const ticket = transactions.find(t => t.id === id);
      if (!ticket) return;

      const res = await fetch('/eventManagement/api/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voucherId: ticket.id,
          userId: 3,
        }),
      });

      const result = await res.json();
      if (result.success) {
        setTransactions(prev =>
          prev.map(t => t.id === id ? { ...t, status: 'Redeemed' } : t)
        );
        setSelectedTicket(prev => prev?.id === id ? { ...prev, status: 'Redeemed' } : prev);
      } else {
        console.error('Redemption failed:', result.error);
        alert('Failed to redeem ticket: ' + (result.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Redemption error:', err);
      alert('Failed to redeem ticket');
    }
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (!isScanOpen) {
      stopCamera();
      return;
    }

    void startCameraScan();
  }, [isScanOpen]);

  const filtered = transactions.filter(t => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q ||
      t.customerName.toLowerCase().includes(q) ||
      t.voucherCode.toLowerCase().includes(q) ||
      t.paymentPhone.toLowerCase().includes(q) ||
      t.customerContact.toLowerCase().includes(q) ||
      t.eventOrganizer.toLowerCase().includes(q);
    const matchType      = filterType      === 'All' || t.ticketType      === filterType;
    const matchEvent     = filterEvent     === 'All' || t.eventName       === filterEvent;
    const matchOrganizer = filterOrganizer === 'All' || t.eventOrganizer  === filterOrganizer;
    const matchStatus    = filterStatus    === 'All' || t.status          === filterStatus;
    const matchPayment   = filterPayment   === 'All' || t.paymentMethod   === filterPayment;
    const txDate = new Date(t.bookingDateTime);
    const matchFrom = !filterDateFrom || txDate >= new Date(filterDateFrom);
    const matchTo   = !filterDateTo   || txDate <= new Date(filterDateTo + 'T23:59:59');
    return matchSearch && matchType && matchEvent && matchOrganizer && matchStatus && matchPayment && matchFrom && matchTo;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const visiblePage = Math.min(currentPage, totalPages);
  const startIndex = (visiblePage - 1) * itemsPerPage;
  const paginated = filtered.slice(startIndex, startIndex + itemsPerPage);

  const hasActiveFilters = !!(searchQuery || filterType !== 'All' || filterEvent !== 'All' || filterOrganizer !== 'All' || filterStatus !== 'All' || filterPayment !== 'All' || filterDateFrom || filterDateTo);

  const clearAllFilters = () => {
    setSearchQuery('');
    setFilterType('All');
    setFilterEvent('All');
    setFilterOrganizer('All');
    setFilterStatus('All');
    setFilterPayment('All');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  return (
    <>
      {isScanOpen && (
        <div className="modal-overlay" onClick={() => setIsScanOpen(false)}>
          <div className="modal-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h2 className="modal-title">Scan Ticket QR</h2>
              <button className="modal-close" onClick={() => setIsScanOpen(false)} aria-label="Close scan modal">×</button>
            </div>

            <div className="modal-body">
              <div className="mb-4 overflow-hidden rounded-xl border border-dashed border-[#dfe3e6] bg-[#f8fafb]">
                <video ref={videoRef} className="h-56 w-full object-cover" muted playsInline autoPlay />
                {!cameraReady && (
                  <div className="flex h-56 items-center justify-center text-center text-xs text-[#67727b]">
                    Camera preview unavailable. Enter the ticket ID manually.
                  </div>
                )}
              </div>

              <label className="filter-label block text-left">Ticket ID or Voucher Code</label>
              <input
                value={scanValue}
                onChange={event => setScanValue(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    resolveTicketFromCode(scanValue);
                  }
                }}
                placeholder="Paste scanned QR value or ticket ID"
                className="filter-search mt-2 w-full"
              />

              {scanError && <p className="mt-3 text-xs text-[#9b263c]">{scanError}</p>}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setIsScanOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-redeem" onClick={() => resolveTicketFromCode(scanValue)}>
                Open Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="event-dashboard event-booking-page">
      {/* HEADER */}
      <header className="header animate-fade-in delay-1">
        <div>
          <h1>Event <span>Tickets</span></h1>
          <p>Real-time overview of ticket sales and revenue.</p>
        </div>
        <div className="logo-container">
          <Image src="/logo.png" alt="Event Logo" width={170} height={60} className="logo-image h-auto w-auto" />
        </div>
      </header>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          Loading ticket sales data...
        </div>
      ) : error || !summary ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--danger)' }}>
          Failed to load data. Please refresh the page.
        </div>
      ) : (
        <>
          {/* SUMMARY CARDS */}
          <div className="stats-grid animate-fade-in delay-2">
            {/* Total Revenue */}
            <div className="stat-card glass-panel">
              <div className="stat-title">Total Revenue</div>
              <div className="stat-value highlight">
                {summary.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
              </div>
              <ChangeIndicator value={summary.revenueChangePercent} />
            </div>

            {/* Total Bookings */}
            <div className="stat-card glass-panel">
              <div className="stat-title">Total Bookings</div>
              <div className="stat-value">{summary.totalBookings}</div>
              <ChangeIndicator value={summary.bookingsChangePercent} />
            </div>

            {/* Total Redeemed */}
            <div className="stat-card glass-panel">
              <div className="stat-title">Total Redeemed</div>
              <div className="stat-value" style={{ color: 'var(--success)' }}>{summary.totalRedeemed}</div>
              <span className="stat-sub neutral">{summary.redeemedPercent}% of bookings</span>
              <PercentBar percent={summary.redeemedPercent} color="var(--success)" />
            </div>

            {/* Not Redeemed */}
            <div className="stat-card glass-panel">
              <div className="stat-title">Not Redeemed</div>
              <div className="stat-value" style={{ color: 'var(--warning)' }}>{summary.notRedeemed}</div>
              <span className="stat-sub neutral">{summary.notRedeemedPercent}% of bookings</span>
              <PercentBar percent={summary.notRedeemedPercent} color="var(--warning)" />
            </div>

            {/* Remaining Tickets */}
            <div className="stat-card glass-panel">
              <div className="stat-title">Remaining Tickets</div>
              <div className="stat-value">{summary.remainingTickets}</div>
              <span className="stat-sub neutral">of {summary.eventCapacity} capacity</span>
              <PercentBar
                percent={Math.round(((summary.eventCapacity - summary.remainingTickets) / summary.eventCapacity) * 100)}
                color="var(--accent)"
              />
            </div>
          </div>

          {/* TABLE */}
          <div className="glass-panel animate-fade-in delay-3" style={{ overflow: 'visible' }}>
            {/* Table title row */}
            <div className="table-header">
              <div className="table-title">Transaction List</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-redeem flex items-center gap-2 px-3 py-2"
                  onClick={() => {
                    setScanValue('');
                    setScanError('');
                    setIsScanOpen(true);
                  }}
                  aria-label="Scan ticket QR"
                >
                  <span aria-hidden="true">◉</span>
                  Scan QR
                </button>
                <select className="filter-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
                  <option value="All">All Ticket Types</option>
                  <option value="Regular">Regular</option>
                  <option value="VIP">VIP</option>
                  <option value="VVIP">VVIP</option>
                </select>
              </div>
            </div>

            {/* Advanced filter bar */}
            <div className="filter-bar">
              {/* Search */}
              <div className="filter-search-wrap">
                <svg className="filter-search-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  id="filter-search"
                  className="filter-search"
                  type="text"
                  placeholder="Search by customer name, voucher code or phone..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Event Name */}
              <div className="filter-group">
                <label className="filter-label" htmlFor="filter-event">Event Name</label>
                <select id="filter-event" className="filter-select" value={filterEvent} onChange={e => setFilterEvent(e.target.value)}>
                  <option value="All">All Events</option>
                  {uniqueEvents.map(ev => <option key={ev} value={ev}>{ev}</option>)}
                </select>
              </div>

              {/* Organizer */}
              <div className="filter-group">
                <label className="filter-label" htmlFor="filter-organizer">Event Organizer</label>
                <select id="filter-organizer" className="filter-select" value={filterOrganizer} onChange={e => setFilterOrganizer(e.target.value)}>
                  <option value="All">All Organizers</option>
                  {uniqueOrganizers.map(org => <option key={org} value={org}>{org}</option>)}
                </select>
              </div>

              {/* Status */}
              <div className="filter-group">
                <label className="filter-label" htmlFor="filter-status">Status</label>
                <select id="filter-status" className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="All">All Status</option>
                  <option value="Booked">Booked</option>
                  <option value="Redeemed">Redeemed</option>
                </select>
              </div>

              {/* Payment Method */}
              <div className="filter-group">
                <label className="filter-label" htmlFor="filter-payment">Payment Method</label>
                <select id="filter-payment" className="filter-select" value={filterPayment} onChange={e => setFilterPayment(e.target.value)}>
                  <option value="All">All</option>
                  {uniquePayments.map(pm => <option key={pm} value={pm}>{pm}</option>)}
                </select>
              </div>

              {/* Date Range */}
              <div className="filter-group">
                <label className="filter-label">Booking Date From</label>
                <input
                  id="filter-date-from"
                  type="date"
                  className="filter-date"
                  value={filterDateFrom}
                  onChange={e => setFilterDateFrom(e.target.value)}
                />
              </div>

              <div className="filter-group">
                <label className="filter-label">To</label>
                <input
                  id="filter-date-to"
                  type="date"
                  className="filter-date"
                  value={filterDateTo}
                  min={filterDateFrom || undefined}
                  onChange={e => setFilterDateTo(e.target.value)}
                />
              </div>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <button className="btn-clear-filters" onClick={clearAllFilters}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/>
                  </svg>
                  Clear Filters
                </button>
              )}
            </div>

            <div className="table-container">
              <table>
                <colgroup>
                  <col className="col-name" />
                  <col className="col-contact" />
                  <col className="col-voucher" />
                  <col className="col-booking" />
                  <col className="col-event" />
                  <col className="col-organizer" />
                  <col className="col-tickettype" />
                  <col className="col-eventdate" />
                  <col className="col-qty" />
                  <col className="col-price" />
                  <col className="col-invname" />
                  <col className="col-invcontact" />
                  <col className="col-status" />
                  <col className="col-action" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Customer Name</th>
                    <th>Contact</th>
                    <th>Voucher</th>
                    <th>Booking Date &amp; Time</th>
                    <th>Event</th>
                    <th>Event Organizer</th>
                    <th>Ticket Type</th>
                    <th>Event Date</th>
                    <th>Qty</th>
                    <th>Total</th>
                    <th>Invited Name</th>
                    <th>Invited Contact</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={14} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        No tickets match the selected filter.
                      </td>
                    </tr>
                  ) : (
                    paginated.map(txn => (
                      <tr key={txn.id}>
                        <td style={{ fontWeight: 600 }}>{txn.customerName}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{txn.customerContact}</td>
                        <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{txn.voucherCode}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{formatDateTimeSplit(txn.bookingDateTime)}</td>
                        <td>{txn.eventName}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{txn.eventOrganizer}</td>
                        <td>{getTicketBadge(txn.ticketType)}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{formatDateTimeSplit(txn.eventDateTime)}</td>
                        <td style={{ textAlign: 'center' }}>{txn.quantity}</td>
                        <td style={{ fontWeight: 700 }}>{txn.totalPrice.toFixed(2)} ETB</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{txn.invitedToName || '—'}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{txn.invitedContact || '—'}</td>
                        <td>{getStatusBadge(txn.status)}</td>
                        <td>
                          <div className="action-cell">
                            <button className="btn btn-view" onClick={() => setSelectedTicket(txn)}>View</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            <div className="table-footer">
              <div className="pagination-info">
                {filtered.length === 0 ? null : (
                  <span>
                    Showing {filtered.length === 0 ? 0 : startIndex + 1}–{Math.min(filtered.length, startIndex + paginated.length)} of {filtered.length}
                  </span>
                )}
              </div>
              <div className="pagination-controls">
                <button className="btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>Prev</button>
                <span style={{ margin: '0 0.5rem', color: 'var(--text-secondary)' }}>{currentPage} / {totalPages}</span>
                <button className="btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>Next</button>
              </div>
            </div>
          </div>
        </>
      )}
      </div>

      {/* ── BOOKING DETAILS MODAL ─────────────────── */}
      {selectedTicket && (
        <div className="modal-overlay" onClick={() => setSelectedTicket(null)}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="modal-header">
              <h2 className="modal-title">Booking Details</h2>
              <button className="modal-close" onClick={() => setSelectedTicket(null)} aria-label="Close">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Status badge */}
            <div className="modal-status-row">
              {getStatusBadge(selectedTicket.status)}
              {getTicketBadge(selectedTicket.ticketType)}
            </div>

            <div className="modal-body">
              {/* Booking Information */}
              <div className="modal-section">
                <div className="modal-section-title">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  Booking Information
                </div>
                <div className="modal-detail-row"><span className="modal-detail-label">Customer Name</span><span className="modal-detail-value">{selectedTicket.customerName}</span></div>
                <div className="modal-detail-row"><span className="modal-detail-label">Customer Contact</span><span className="modal-detail-value">{selectedTicket.customerContact}</span></div>
                <div className="modal-detail-row"><span className="modal-detail-label">Voucher Code</span><span className="modal-detail-value modal-mono">{selectedTicket.voucherCode}</span></div>
                <div className="modal-detail-row"><span className="modal-detail-label">Booking Date &amp; Time</span><span className="modal-detail-value">{formatDateTime(selectedTicket.bookingDateTime)}</span></div>
              </div>

              {/* Event Information */}
              <div className="modal-section">
                <div className="modal-section-title">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  Event Information
                </div>
                <div className="modal-detail-row"><span className="modal-detail-label">Event Name</span><span className="modal-detail-value">{selectedTicket.eventName}</span></div>
                <div className="modal-detail-row"><span className="modal-detail-label">Event Organizer</span><span className="modal-detail-value">{selectedTicket.eventOrganizer}</span></div>
                <div className="modal-detail-row"><span className="modal-detail-label">Event Date &amp; Time</span><span className="modal-detail-value">{formatDateTime(selectedTicket.eventDateTime)}</span></div>
                <div className="modal-detail-row"><span className="modal-detail-label">Ticket Type</span><span className="modal-detail-value">{selectedTicket.ticketType}</span></div>
              </div>

              {/* Payment Information */}
              <div className="modal-section">
                <div className="modal-section-title">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                  Payment Information
                </div>
                <div className="modal-detail-row"><span className="modal-detail-label">Payment Phone</span><span className="modal-detail-value">{selectedTicket.paymentPhone}</span></div>
                <div className="modal-detail-row"><span className="modal-detail-label">Payment Method</span><span className="modal-detail-value">{selectedTicket.paymentMethod}</span></div>
                <div className="modal-detail-row"><span className="modal-detail-label">Payment Reference</span><span className="modal-detail-value modal-mono">{selectedTicket.paymentReference}</span></div>
                <div className="modal-detail-row"><span className="modal-detail-label">Quantity</span><span className="modal-detail-value">{selectedTicket.quantity}</span></div>
                <div className="modal-detail-row"><span className="modal-detail-label">Total Price</span><span className="modal-detail-value modal-price">{selectedTicket.totalPrice.toFixed(2)} ETB</span></div>
              </div>

              {/* Invitation Information */}
              {(selectedTicket.invitedToName || selectedTicket.invitedContact) && (
                <div className="modal-section">
                  <div className="modal-section-title">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    Invitation Information
                  </div>
                  {selectedTicket.invitedToName && <div className="modal-detail-row"><span className="modal-detail-label">Invited To Name</span><span className="modal-detail-value">{selectedTicket.invitedToName}</span></div>}
                  {selectedTicket.invitedContact && <div className="modal-detail-row"><span className="modal-detail-label">Invited Contact</span><span className="modal-detail-value">{selectedTicket.invitedContact}</span></div>}
                </div>
              )}
            </div>

            {/* Footer action */}
            <div className="modal-footer">
              <button
                data-viewer-write
                className="modal-btn-redeem"
                disabled={selectedTicket.status === 'Redeemed'}
                onClick={() => handleRedeem(selectedTicket.id)}
              >
                {selectedTicket.status === 'Redeemed' ? '✓ Ticket Redeemed' : 'Redeem Ticket'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
