"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type DashboardInvitee = {
  id: number;
  name: string;
  rewardedOrders: number;
  orderCount: number;
  paidAmount: number;
  unpaidAmount: number;
};

type DetailRow = Record<string, unknown>;
type DetailView = "summary" | "invited" | "active" | "expired" | "orders" | "orderValue" | "commission" | "linkChain";

type DashboardReferrer = {
  id: number | null;
  name: string;
  phone: string;
  code: string;
  affiliateType?: "user" | "merchant" | "staff";
  merchant?: string;
  branch?: string;
  status: string;
  joined: string;
  referrals: number;
  referralDetails: DashboardInvitee[];
  unpaidAmount: number;
  paidAmount: number;
  totalAmount: number;
  affiliateLink?: string;
};

type DashboardResponse = {
  isSuccessful?: boolean;
  data?: unknown;
  errorMessages?: string[];
};

type StatusFilter = "All" | "Active" | "Disabled";
type AffiliateTypeFilter = "All" | "user" | "merchant" | "staff";
type AffiliateType = "company" | "staff";
type CreateReferralResponse = {
  isSuccessful: boolean;
  data: { id?: number | string; name?: string; code: string; type: string; affiliateLink: string } | null;
  errorMessages?: string[];
};

type SummaryCard = {
  label: string;
  value: string;
  sublabel: string;
  color: string;
};

const statusClasses = {
  Active: "bg-[#eaf8f2] text-[#1f9e6f] ring-1 ring-[#b7e7d1]",
  Disabled: "bg-[#fdecec] text-[#d93d4a] ring-1 ring-[#f5c2c2]",
};

const typeClasses = {
  user: "bg-[#eee7ff] text-[#7250ad]",
  merchant: "bg-[#ffe4e8] text-[#b24760]",
  staff: "bg-[#e4efff] text-[#3565a5]",
};

const formatAmount = (amount: number) =>
  amount ? `ETB ${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "";

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function stringValue(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function numberValue(...values: unknown[]): number {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

function normalizeAffiliate(value: unknown): DashboardReferrer | null {
  const record = objectValue(value);
  if (!record) return null;

  const rawId = record.id;
  const id = typeof rawId === "number" && Number.isFinite(rawId)
    ? rawId
    : typeof rawId === "string" && rawId.trim() && Number.isFinite(Number(rawId))
      ? Number(rawId)
      : null;
  const merchantObject = objectValue(record.merchant);
  const branchObject = objectValue(record.branch);
  const rawType = stringValue(record.affiliateType, record.type).toLowerCase();
  const affiliateType = rawType === "staff" ? "staff" : rawType === "company" || rawType === "merchant" ? "merchant" : "user";
  const paidAmount = numberValue(record.paidAmount);
  const unpaidAmount = numberValue(record.unpaidAmount);
  const details = Array.isArray(record.referralDetails) ? record.referralDetails as DashboardInvitee[] : [];

  return {
    ...record,
    id,
    name: stringValue(record.name, record.fullName),
    phone: stringValue(record.phone, record.phoneNumber),
    code: stringValue(record.code),
    affiliateType,
    merchant: stringValue(merchantObject?.name, record.merchantName, record.merchant),
    branch: stringValue(branchObject?.name, record.branchName, record.branch),
    status: stringValue(record.status) || "Active",
    joined: stringValue(record.joined, record.createdAt, record.createdDate),
    referrals: numberValue(record.referrals, record.referralCount, details.length),
    referralDetails: details,
    unpaidAmount,
    paidAmount,
    totalAmount: numberValue(record.totalAmount, paidAmount + unpaidAmount),
    affiliateLink: stringValue(record.affiliateLink, record.link) || undefined,
  };
}

async function fetchAffiliateRecords(): Promise<DashboardReferrer[]> {
  const response = await fetch("/api/ugc/dashboard", { cache: "no-store" });
  const payload = (await response.json()) as DashboardResponse;
  if (!response.ok || !payload.isSuccessful) {
    throw new Error(payload.errorMessages?.join(" ") || "Unable to load affiliate links.");
  }
  if (!Array.isArray(payload.data)) {
    throw new Error("The affiliate list endpoint returned an unexpected response.");
  }
  return payload.data.map(normalizeAffiliate).filter((record): record is DashboardReferrer => record !== null);
}

function extractRows(value: unknown, nestedKeys: string[] = []): DetailRow[] {
  if (Array.isArray(value)) return value.filter((item): item is DetailRow => Boolean(item) && typeof item === "object") as DetailRow[];
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.data)) return extractRows(record.data);
  for (const key of nestedKeys) {
    if (Array.isArray(record[key])) return extractRows(record[key]);
  }
  return record.data && typeof record.data === "object" ? extractRows(record.data, nestedKeys) : [];
}

function detailText(row: DetailRow, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function detailNumber(row: DetailRow, ...keys: string[]): number {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value.replace(/[^\d.-]/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

function isExpiredInvitee(row: DetailRow): boolean {
  const status = detailText(row, "status", "userStatus").toLowerCase();
  if (status.includes("expired")) return true;
  if (status.includes("active")) return false;
  const expiry = detailText(row, "expiryDate", "expiresAt", "expiry", "expiryOn");
  const expiryDate = expiry ? new Date(expiry) : null;
  return Boolean(expiryDate && !Number.isNaN(expiryDate.getTime()) && expiryDate.getTime() < Date.now());
}

function isActiveInvitee(row: DetailRow): boolean {
  const status = detailText(row, "status", "userStatus").toLowerCase();
  if (status.includes("active")) return true;
  if (status.includes("expired")) return false;
  const expiry = detailText(row, "expiryDate", "expiresAt", "expiry", "expiryOn");
  const expiryDate = expiry ? new Date(expiry) : null;
  return Boolean(expiryDate && !Number.isNaN(expiryDate.getTime()) && expiryDate.getTime() >= Date.now());
}

export default function UGC() {
  const [records, setRecords] = useState<DashboardReferrer[]>([]);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<AffiliateTypeFilter>("All");
  const [merchantFilter, setMerchantFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedCode, setCopiedCode] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<DashboardReferrer | null>(null);
  const [detailView, setDetailView] = useState<DetailView>("summary");
  const [detailInvitees, setDetailInvitees] = useState<DetailRow[]>([]);
  const [detailOrders, setDetailOrders] = useState<DetailRow[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailError, setDetailError] = useState("");
  const detailRequestId = useRef(0);
  const [disablingId, setDisablingId] = useState<number | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [affiliateType, setAffiliateType] = useState<AffiliateType>("company");
  const [branch, setBranch] = useState("Addis Ababa");
  const [merchant, setMerchant] = useState("Gast Cinema");
  const [merchantId, setMerchantId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [staffPhone, setStaffPhone] = useState("");
  const [staffName, setStaffName] = useState("");
  const [isLookingUpStaff, setIsLookingUpStaff] = useState(false);
  const [staffLookupError, setStaffLookupError] = useState("");
  const [linkName, setLinkName] = useState("Gast Cinema");
  const [registrationCount, setRegistrationCount] = useState<number | null>(null);
  const [isLoadingRegistrations, setIsLoadingRegistrations] = useState(false);
  const [createError, setCreateError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createdLink, setCreatedLink] = useState("");

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setRecords(await fetchAffiliateRecords());
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load affiliate links.");
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const summary = useMemo(() => ({
    active: records.filter((record) => record.status.toLowerCase() === "active").length,
    referrals: records.reduce((total, record) => total + (record.referrals || 0), 0),
    orders: records.reduce(
      (total, record) => total + (record.referralDetails || []).reduce(
        (inviteeTotal, invitee) => inviteeTotal + (invitee.rewardedOrders || 0) + (invitee.orderCount || 0),
        0,
      ),
      0,
    ),
    commission: records.reduce((total, record) => total + (record.totalAmount || 0), 0),
  }), [records]);

  const merchantOptions = useMemo(
    () => [...new Set(records.map((record) => record.merchant?.trim()).filter((merchant): merchant is string => Boolean(merchant)))].sort((a, b) => a.localeCompare(b)),
    [records],
  );

  const branchOptions = useMemo(
    () => [...new Set(records
      .filter((record) => !merchantFilter || record.merchant?.trim() === merchantFilter)
      .map((record) => record.branch?.trim())
      .filter((branch): branch is string => Boolean(branch)))].sort((a, b) => a.localeCompare(b)),
    [records, merchantFilter],
  );

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records.filter((record) => {
      const matchesSearch = !query || [record.name, record.phone, record.code].some((value) => value.toLowerCase().includes(query));
      const matchesStatus = statusFilter === "All" || record.status.toLowerCase() === statusFilter.toLowerCase();
      const matchesDate = !dateFilter || record.joined.slice(0, 10) === dateFilter;
      const matchesType = typeFilter === "All" || record.affiliateType === typeFilter;
      const matchesMerchant = !merchantFilter || record.merchant?.trim() === merchantFilter;
      const matchesBranch = !branchFilter || record.branch?.trim() === branchFilter;
      return matchesSearch && matchesStatus && matchesDate && matchesType && matchesMerchant && matchesBranch;
    });
  }, [records, search, statusFilter, dateFilter, typeFilter, merchantFilter, branchFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / itemsPerPage));
  const visiblePage = Math.min(currentPage, totalPages);
  const startIndex = (visiblePage - 1) * itemsPerPage;
  const paginatedRecords = filteredRecords.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, dateFilter, typeFilter, merchantFilter, branchFilter]);

  const summaryCards: SummaryCard[] = [
    { label: "Merchant Links", value: "", sublabel: "", color: "#d93d4a" },
    { label: "Staff Links", value: "", sublabel: "", color: "#2d5bd7" },
    { label: "User Links", value: records.length ? records.length.toLocaleString() : "", sublabel: "personal user links", color: "#6d47d9" },
    { label: "Total Invited Users", value: summary.referrals ? summary.referrals.toLocaleString() : "", sublabel: "customers acquired", color: "#27313b" },
    { label: "Active Referrals", value: summary.active ? summary.active.toLocaleString() : "", sublabel: "within expiry window", color: "#1e9f70" },
    { label: "Expired Referrals", value: "", sublabel: "", color: "#d97706" },
    { label: "Total Orders", value: summary.orders ? summary.orders.toLocaleString() : "", sublabel: "referred orders", color: "#27313b" },
    { label: "Total Commission", value: summary.commission ? formatAmount(summary.commission) : "", sublabel: "commission earned", color: "#8d2a2d" },
  ];

  const handleCopy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedCode(link);
      window.setTimeout(() => setCopiedCode(""), 1500);
    } catch {
      setCopiedCode("");
    }
  };

  const handleDisable = async (record: DashboardReferrer) => {
    if (record.id === null) {
      setError("This affiliate has no backend ID, so it cannot be disabled.");
      return;
    }
    if (record.status.toLowerCase() === "disabled" || !window.confirm(`Disable the affiliate link for ${record.name}?`)) return;
    setError("");
    setDisablingId(record.id);
    try {
      const response = await fetch(`/api/ugc/referrer/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Disabled" }),
      });
      const payload = (await response.json().catch(() => null)) as { isSuccessful?: boolean; errorMessages?: string[] } | null;
      if (!response.ok || payload?.isSuccessful === false) {
        throw new Error(response.status === 404 ? "The affiliate-link disable endpoint is not available yet." : payload?.errorMessages?.join(" ") || "Unable to disable affiliate link.");
      }
      setRecords((current) => current.map((item) => item.id === record.id ? { ...item, status: "Disabled" } : item));
    } catch (disableError) {
      setError(disableError instanceof Error ? disableError.message : "Unable to disable affiliate link.");
    } finally {
      setDisablingId(null);
    }
  };

  const handleViewRecord = async (record: DashboardReferrer) => {
    const requestId = ++detailRequestId.current;
    setSelectedRecord(record);
    setDetailView("summary");
    setDetailInvitees((record.referralDetails || []) as unknown as DetailRow[]);
    setDetailOrders([]);
    setIsLoadingDetails(true);
    setDetailError("");

    if (record.id === null) {
      setDetailError("Detailed affiliate information requires a backend ID.");
      setIsLoadingDetails(false);
      return;
    }

    const loadRows = async (url: string, nestedKeys: string[]) => {
      const response = await fetch(url, { cache: "no-store" });
      const payload: unknown = await response.json().catch(() => null);
      const payloadRecord = payload && typeof payload === "object" ? payload as Record<string, unknown> : null;
      const messages = payloadRecord?.errorMessages;
      if (!response.ok || payloadRecord?.isSuccessful === false) {
        throw new Error(Array.isArray(messages) ? messages.join(" ") : "Unable to load affiliate details.");
      }
      return extractRows(payload, nestedKeys);
    };

    const [inviteesResult, ordersResult] = await Promise.allSettled([
      loadRows(`/api/ugc/referrer/${record.id}/invitees`, ["invitees", "users", "items"]),
      loadRows(`/api/ugc/referrer/${record.id}/orders`, ["orders", "items"]),
    ]);
    if (requestId !== detailRequestId.current) return;
    const errors: string[] = [];
    if (inviteesResult.status === "fulfilled") {
      if (inviteesResult.value.length) setDetailInvitees(inviteesResult.value);
    } else {
      errors.push("Invitee details are unavailable; showing dashboard data.");
    }
    if (ordersResult.status === "fulfilled") {
      setDetailOrders(ordersResult.value);
    } else {
      errors.push("Order details are unavailable.");
    }
    setDetailError(errors.join(" "));
    setIsLoadingDetails(false);
  };

  const closeDetails = () => {
    detailRequestId.current += 1;
    setSelectedRecord(null);
    setDetailView("summary");
  };

  const lookupRegistrations = async () => {
    if (!/^\d+$/.test(merchantId.trim())) return;
    setIsLoadingRegistrations(true);
    setRegistrationCount(null);
    try {
      const response = await fetch(`/api/ugc/merchant/${merchantId.trim()}/registrations`, { cache: "no-store" });
      const payload = (await response.json()) as { isSuccessful?: boolean; data?: number; errorMessages?: string[] };
      if (!response.ok || !payload.isSuccessful) throw new Error(payload.errorMessages?.join(" ") || "Unable to retrieve registration count.");
      setRegistrationCount(payload.data ?? 0);
    } catch (countError) {
      setCreateError(countError instanceof Error ? countError.message : "Unable to retrieve registration count.");
    } finally {
      setIsLoadingRegistrations(false);
    }
  };

  const lookupStaff = async () => {
    const phone = staffPhone.trim();
    const companyId = merchantId.trim();
    if (!phone || !/^\d+$/.test(companyId)) return;
    setIsLookingUpStaff(true);
    setStaffLookupError("");
    setStaffName("");
    try {
      const query = new URLSearchParams({ phoneNumber: phone, companyId });
      const response = await fetch(`/api/ugc/staff?${query}`, { cache: "no-store" });
      const payload = (await response.json()) as { isSuccessful?: boolean; name?: string; errorMessages?: string[] };
      if (!response.ok || !payload.isSuccessful || !payload.name) {
        throw new Error(payload.errorMessages?.join(" ") || "No staff member was found for that phone number.");
      }
      setStaffName(payload.name);
    } catch (lookupError) {
      setStaffLookupError(lookupError instanceof Error ? lookupError.message : "Unable to look up the staff member.");
    } finally {
      setIsLookingUpStaff(false);
    }
  };

  const handleGenerateLink = async () => {
    setCreateError("");
    setIsCreating(true);
    const phone = affiliateType === "staff" ? staffPhone.trim() : undefined;
    const body = {
      type: affiliateType,
      name: (affiliateType === "staff" ? staffName : linkName).trim() || undefined,
      phone,
      merchantId: Number(merchantId),
      branchId: Number(branchId),
    };
    try {
      const response = await fetch("/api/ugc/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = (await response.json()) as CreateReferralResponse;
      if (!response.ok || !payload.isSuccessful || !payload.data) throw new Error(payload.errorMessages?.join(" ") || "Unable to create referral link.");
      const created = payload.data;
      setCreatedLink(created.affiliateLink);
      setCurrentPage(1);
      setError("");
      setIsLoading(true);
      try {
        const refreshedRecords = await fetchAffiliateRecords();
        setRecords(refreshedRecords);
        const returnedId = created.id === undefined ? null : Number(created.id);
        const foundCreatedAffiliate = refreshedRecords.some((record) =>
          record.code === created.code || (returnedId !== null && Number.isFinite(returnedId) && record.id === returnedId),
        );
        if (!foundCreatedAffiliate) {
          setError("The create request succeeded, but the affiliate list did not return the new link. Check that the backend saved it and includes it in the dashboard list.");
        }
      } catch (refreshError) {
        setError(`The link was created, but the affiliate list could not be refreshed: ${refreshError instanceof Error ? refreshError.message : "Unable to load affiliate links."}`);
      } finally {
        setIsLoading(false);
      }
    } catch (createErrorValue) {
      setCreateError(createErrorValue instanceof Error ? createErrorValue.message : "Unable to create referral link.");
    } finally {
      setIsCreating(false);
    }
  };

  const createMerchantOptions = [...new Set([merchant, ...merchantOptions].map((value) => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const createBranchOptions = [...new Set([branch, ...records
    .filter((record) => !merchant || record.merchant?.trim() === merchant)
    .map((record) => record.branch?.trim() || "")]
    .filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const canSubmit = Boolean(merchantId.trim() && branchId.trim() && (affiliateType === "staff" ? staffPhone.trim() : linkName.trim()));

  const invitedCount = selectedRecord?.referrals || detailInvitees.length;
  const activeInvitees = detailInvitees.filter(isActiveInvitee);
  const expiredInvitees = detailInvitees.filter(isExpiredInvitee);
  const totalOrders = detailOrders.length
    ? detailOrders.reduce((total, order) => total + (detailNumber(order, "orderCount", "ordersCount") || 1), 0)
    : detailInvitees.reduce((total, invitee) => total + detailNumber(invitee, "rewardedOrders") + detailNumber(invitee, "orderCount"), 0);
  const totalOrderValue = detailOrders.reduce((total, order) => total + detailNumber(order, "amount", "orderAmount", "totalAmount", "value"), 0);
  const orderValueLabel = totalOrderValue ? formatAmount(totalOrderValue) : "—";
  const commissionLabel = selectedRecord ? formatAmount(selectedRecord.totalAmount || 0) || "ETB 0" : "ETB 0";
  const performanceMetrics: { title: string; value: string; view: Exclude<DetailView, "summary">; tone: string }[] = [
    { title: "Invited Users", value: invitedCount.toLocaleString(), view: "invited", tone: "text-[#17212b]" },
    { title: "Active Users", value: activeInvitees.length.toLocaleString(), view: "active", tone: "text-[#16845a]" },
    { title: "Expired Users", value: expiredInvitees.length.toLocaleString(), view: "expired", tone: "text-[#d93d4a]" },
    { title: "Orders", value: totalOrders.toLocaleString(), view: "orders", tone: "text-[#17212b]" },
    { title: "Order Value", value: orderValueLabel, view: "orderValue", tone: "text-[#17212b]" },
    { title: "Commission", value: commissionLabel, view: "commission", tone: "text-[#a51e31]" },
  ];
  const detailTitle: Record<DetailView, string> = {
    summary: "Affiliate Detail",
    invited: `All Invited Users (${invitedCount})`,
    active: `Active Users (${activeInvitees.length})`,
    expired: `Expired Users (${expiredInvitees.length})`,
    orders: `All Orders (${totalOrders})`,
    orderValue: "Order Value Breakdown",
    commission: "Commission Breakdown",
    linkChain: "Link Chain",
  };

  return (
    <main className="ml-60 min-h-screen bg-[#f5f6f7] pt-[76px] text-[#27313b]">
      <div className="mx-auto max-w-[1450px] px-4 py-3">
        <header className="flex items-center justify-between border-b border-[#e4e8eb] pb-3 text-[11px]">
          <div className="flex items-center gap-2 text-[#9aa1a7]">
            <span className="font-bold text-[#27313b]">Affiliate Dashboard</span>
            <span>•</span>
            <span>Hulubeje Affiliate Marketing</span>
          </div>
          <span className="font-medium text-[#8c949b]">26 Aug 2026</span>
        </header>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <label className="flex h-7 items-center gap-2 rounded-md border border-[#e1e5e8] bg-white px-2 text-[10px] text-[#7d858d] shadow-sm">
              <span>Date</span>
              <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="min-w-0 bg-transparent text-[#53606a] outline-none" aria-label="Filter affiliate links by date joined" />
            </label>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as AffiliateTypeFilter)} className="h-7 min-w-[112px] rounded-md border border-[#e1e5e8] bg-white px-2 text-[10px] text-[#7d858d] shadow-sm outline-none" aria-label="Filter by affiliate type">
              <option value="All">All affiliate types</option>
              <option value="user">User</option>
              <option value="merchant">Merchant</option>
              <option value="staff">Staff</option>
            </select>
            <select value={merchantFilter} onChange={(event) => { setMerchantFilter(event.target.value); setBranchFilter(""); }} className="h-7 min-w-[110px] max-w-[180px] rounded-md border border-[#e1e5e8] bg-white px-2 text-[10px] text-[#7d858d] shadow-sm outline-none disabled:bg-[#f5f6f7]" aria-label="Filter by merchant" disabled={merchantOptions.length === 0}>
              <option value="">All merchants</option>
              {merchantOptions.map((merchantName) => <option key={merchantName} value={merchantName}>{merchantName}</option>)}
            </select>
            <select value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)} className="h-7 min-w-[100px] max-w-[170px] rounded-md border border-[#e1e5e8] bg-white px-2 text-[10px] text-[#7d858d] shadow-sm outline-none disabled:bg-[#f5f6f7]" aria-label="Filter by branch" disabled={!merchantFilter || branchOptions.length === 0}>
              <option value="">All branches</option>
              {branchOptions.map((branchName) => <option key={branchName} value={branchName}>{branchName}</option>)}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="h-7 min-w-[70px] rounded-md border border-[#e1e5e8] bg-white px-2 text-[10px] text-[#7d858d] shadow-sm outline-none">
              <option value="All">Status</option>
              <option value="Active">Active</option>
              <option value="Disabled">Disabled</option>
            </select>
            <label className="flex h-7 w-[132px] items-center gap-2 rounded-md border border-[#e1e5e8] bg-white px-3 text-[10px] text-[#b0b6bb] shadow-sm">
              <span>⌕</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search..." className="w-full bg-transparent outline-none placeholder:text-[#b0b6bb]" />
            </label>
          </div>
          <button type="button" data-viewer-write onClick={() => setIsCreateOpen(true)} className="h-7 shrink-0 rounded-md bg-[#8d1829] px-4 text-[10px] font-bold text-white opacity-95 hover:bg-[#751322]">＋ Create Affiliate Link</button>
        </div>
        {merchantOptions.length === 0 && <p className="mt-2 text-[10px] text-[#9aa1a7]">Merchant and branch filters need merchant and branch details from the affiliate data.</p>}

        <section className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <div key={card.label} className="h-[85px] rounded-lg border border-[#e1e5e8] bg-white px-3 py-2 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
              <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#a1a8ad]"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: card.color }} />{card.label}</div>
              <div className="mt-1 text-[19px] font-bold leading-none" style={{ color: card.color }}>{card.value}</div>
              <div className="mt-1.5 text-[9px] text-[#a5abb0]">{card.sublabel}</div>
            </div>
          ))}
        </section>

        <section className="mt-4">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold text-[#27313b]">
            <span>All Affiliate Links</span>
            <span className="font-medium text-[#8d949a]">{filteredRecords.length} results</span>
          </div>
          {error && <p className="mb-2 rounded-md bg-[#fff0f2] px-3 py-2 text-[11px] text-[#9b263c]">{error}</p>}
          <div className="overflow-x-auto rounded-lg border border-[#e1e5e8] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <table className="min-w-[1120px] w-full table-fixed border-separate border-spacing-0 text-left">
              <thead className="bg-[#fafbfc] text-[8px] font-bold uppercase tracking-[0.1em] text-[#899198]">
                <tr>{['Type', 'Owner', 'Phone', 'Merchant', 'Branch', 'Affiliate Link', 'Users', 'Orders', 'Commission', 'Status', 'Actions'].map((heading) => <th key={heading} className="px-2 py-2.5 first:pl-3 last:pr-3">{heading}</th>)}</tr>
              </thead>
              <tbody>
                {isLoading ? <tr><td colSpan={11} className="border-t border-[#edf0f2] px-3 py-10 text-center text-xs text-[#8d949a]">Loading affiliate links...</td></tr> : filteredRecords.length === 0 ? <tr><td colSpan={11} className="border-t border-[#edf0f2] px-3 py-10 text-center text-xs text-[#8d949a]">No affiliate links found.</td></tr> : paginatedRecords.map((record, index) => {
                  const status = record.status.toLowerCase() === "disabled" ? "Disabled" : "Active";
                  return <tr key={record.id ?? record.code} className={index % 2 ? "bg-[#fcfcfd] text-[10px] text-[#53606a]" : "bg-white text-[10px] text-[#53606a]"}>
                    <td className="border-t border-[#edf0f2] px-2 py-2 first:pl-3"><span className={`rounded px-2 py-1 text-[9px] font-bold ${typeClasses[record.affiliateType || "user"]}`}>{record.affiliateType || "user"}</span></td>
                    <td className="border-t border-[#edf0f2] px-2 py-2 font-bold text-[#35404a]">{record.name}</td>
                    <td className="border-t border-[#edf0f2] px-2 py-2 text-[#8b949e]">{record.phone}</td>
                    <td className="border-t border-[#edf0f2] px-2 py-2">{record.merchant || ""}</td>
                    <td className="border-t border-[#edf0f2] px-2 py-2">{record.branch || ""}</td>
                    <td className="border-t border-[#edf0f2] px-2 py-2"><button type="button" onClick={() => handleCopy(record.affiliateLink || `https://hulubeje.com/ref/${record.code}`)} className="rounded bg-[#f0f2ff] px-2 py-1 font-mono text-[9px] text-[#5365bc] hover:bg-[#e5e9ff]">/ref/{record.code}{copiedCode === (record.affiliateLink || `https://hulubeje.com/ref/${record.code}`) ? " ✓" : ""}</button></td>
                    <td className="border-t border-[#edf0f2] px-2 py-2">{record.referrals || ""}</td>
                    <td className="border-t border-[#edf0f2] px-2 py-2"></td>
                    <td className="border-t border-[#edf0f2] px-2 py-2 font-bold text-[#35404a]">{formatAmount(record.totalAmount || 0)}</td>
                    <td className="border-t border-[#edf0f2] px-2 py-2"><span className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[9px] font-bold ${statusClasses[status]}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{status}</span></td>
                    <td className="border-t border-[#edf0f2] px-2 py-2 last:pr-3"><div className="flex items-center gap-1.5"><button type="button" onClick={() => handleViewRecord(record)} className="rounded border border-[#dfe3e6] bg-white px-2 py-1 text-[9px] font-semibold text-[#53606a] hover:bg-[#f5f6f7]">View</button><button type="button" data-viewer-write onClick={() => handleDisable(record)} disabled={status === "Disabled" || disablingId === record.id} className="rounded border border-[#f0c7cc] bg-[#fff7f7] px-2 py-1 text-[9px] font-semibold text-[#b24760] hover:bg-[#fdecec] disabled:cursor-not-allowed disabled:opacity-50">{disablingId === record.id ? "Disabling..." : "Disable"}</button></div></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
          {!isLoading && filteredRecords.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e1e5e8] px-3 py-3 text-[11px] text-[#7d858d]">
              <span>Showing {startIndex + 1}–{Math.min(startIndex + paginatedRecords.length, filteredRecords.length)} of {filteredRecords.length}</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={visiblePage === 1} className="rounded-md border border-[#e1e5e8] bg-white px-3 py-1.5 font-semibold text-[#53606a] transition-colors hover:bg-[#f8fafb] disabled:cursor-not-allowed disabled:opacity-40" aria-label="Previous affiliate links page">
                  Previous
                </button>
                <span className="min-w-[4rem] text-center font-semibold text-[#53606a]" aria-live="polite">Page {visiblePage} of {totalPages}</span>
                <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={visiblePage === totalPages} className="rounded-md border border-[#e1e5e8] bg-white px-3 py-1.5 font-semibold text-[#53606a] transition-colors hover:bg-[#f8fafb] disabled:cursor-not-allowed disabled:opacity-40" aria-label="Next affiliate links page">
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
      {selectedRecord && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#18252b]/30 p-3 backdrop-blur-[2px] sm:p-5" role="dialog" aria-modal="true" aria-labelledby="affiliate-details-title">
          <div className="flex max-h-[calc(100dvh-24px)] w-full max-w-[700px] flex-col overflow-hidden rounded-[18px] bg-white shadow-[0_20px_70px_rgba(15,23,42,0.2)] sm:max-h-[calc(100dvh-40px)]">
            <header className="flex shrink-0 items-start gap-3 border-b border-[#edf0f2] px-5 py-4 sm:px-6">
              {detailView !== "summary" && <button type="button" onClick={() => setDetailView("summary")} className="mt-0.5 text-lg leading-none text-[#899198] hover:text-[#27313b]" aria-label="Back to affiliate summary">‹</button>}
              <div className="min-w-0 flex-1"><h2 id="affiliate-details-title" className="text-[17px] font-bold text-[#17212b]">{detailTitle[detailView]}</h2>{detailView === "summary" && <p className="mt-1 truncate text-sm font-medium text-[#9aa3b1]">{selectedRecord.name} — {(selectedRecord.affiliateType || "user").replace(/^./, (letter) => letter.toUpperCase())} Affiliate</p>}</div>
              <button type="button" onClick={closeDetails} className="text-xl leading-none text-[#899198] hover:text-[#27313b]" aria-label="Close affiliate details">×</button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
              {detailView === "summary" ? <>
                <section className="overflow-hidden rounded-[14px] border border-[#e1e5e8]">
                  <div className="flex items-start justify-between bg-[#941c2d] px-5 py-4 text-white">
                    <div><h3 className="text-[18px] font-bold">{selectedRecord.name}</h3><p className="mt-0.5 text-sm text-white/85">{(selectedRecord.affiliateType || "user").replace(/^./, (letter) => letter.toUpperCase())} Affiliate</p></div>
                    <span className="rounded-md bg-white/20 px-3 py-1 text-xs font-bold capitalize">{selectedRecord.affiliateType || "user"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-5 gap-y-3 px-5 py-3 text-sm">
                    <div><p className="text-xs text-[#9aa3b1]">Phone</p><p className="mt-0.5 font-medium text-[#46515b]">{selectedRecord.phone || "—"}</p></div>
                    <div><p className="text-xs text-[#9aa3b1]">Branch</p><p className="mt-0.5 font-medium text-[#46515b]">{selectedRecord.branch || "—"}</p></div>
                    <div className="col-span-2 min-w-0"><p className="text-xs text-[#9aa3b1]">Affiliate Link</p><div className="mt-0.5 flex min-w-0 items-center gap-3"><span className="truncate font-mono text-[13px] text-[#941c2d]">{selectedRecord.affiliateLink || `hulubeje.com/ref/${selectedRecord.code}`}</span><button type="button" onClick={() => handleCopy(selectedRecord.affiliateLink || `https://hulubeje.com/ref/${selectedRecord.code}`)} className="shrink-0 text-xs font-semibold text-[#687383] hover:text-[#941c2d]">{copiedCode === (selectedRecord.affiliateLink || `https://hulubeje.com/ref/${selectedRecord.code}`) ? "✓ Copied" : "▢ Copy Link"}</button></div></div>
                  </div>
                </section>
                <h3 className="mb-2 mt-5 text-xs font-bold uppercase tracking-[0.04em] text-[#9aa3b1]">Performance — click any card for details</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {performanceMetrics.map((metric) => <button key={metric.view} type="button" onClick={() => setDetailView(metric.view)} className="min-h-[88px] rounded-[11px] border border-[#dfe3e8] bg-[#fafbfc] px-4 py-3 text-left transition-colors hover:border-[#c9d0d8] hover:bg-[#f5f7f9]">
                    <span className="block text-xs font-medium text-[#9aa3b1]">{metric.title}</span><span className={`mt-1 block text-[20px] font-bold leading-tight ${metric.tone}`}>{metric.value}</span><span className="mt-1 block text-xs text-[#c0c5cc]">View details →</span>
                  </button>)}
                </div>
                <button type="button" onClick={() => setDetailView("linkChain")} className="mt-3 flex min-h-[78px] w-full items-center gap-3 rounded-[12px] border border-[#e1e5e8] px-4 py-3 text-left hover:bg-[#fafbfc]">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#fff0f3] text-xl text-[#a51e31]">↗</span><span><span className="block text-sm font-bold text-[#27313b]">Link Chain</span><span className="mt-0.5 block text-xs text-[#9aa3b1]">Track this affiliate’s direct referrals.</span></span>
                </button>
                {isLoadingDetails && <p className="mt-3 text-xs text-[#899198]">Loading performance details...</p>}
                {detailError && <p className="mt-3 rounded-md bg-[#fff7e8] px-3 py-2 text-xs text-[#8a6422]">{detailError}</p>}
              </> : <>
                {detailError && <p className="mb-3 rounded-md bg-[#fff7e8] px-3 py-2 text-xs text-[#8a6422]">{detailError}</p>}
                {(detailView === "invited" || detailView === "active" || detailView === "expired" || detailView === "linkChain") && (() => {
                  const rows = detailView === "active" ? activeInvitees : detailView === "expired" ? expiredInvitees : detailInvitees;
                  return <>
                    <div className="overflow-x-auto rounded-[10px] border border-[#e1e5e8]">
                      <table className="w-full min-w-[650px] border-collapse text-left text-[11px]">
                        <thead className="bg-[#f8fafc] text-[9px] font-bold uppercase tracking-wide text-[#9aa3ad]"><tr>{["Customer", "Phone", "Registration", "Expiry", "Status", "Orders"].map((heading) => <th key={heading} className="whitespace-nowrap px-3 py-3">{heading}</th>)}</tr></thead>
                        <tbody>{rows.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-[#899198]">{isLoadingDetails ? "Loading users..." : "No user details available."}</td></tr> : rows.map((row, index) => {
                          const expired = isExpiredInvitee(row);
                          const status = detailText(row, "status", "userStatus") || (detailText(row, "expiryDate", "expiresAt", "expiry", "expiryOn") ? expired ? "Expired" : "Active" : "—");
                          const registration = detailText(row, "registrationDate", "registeredAt", "createdAt", "registeredOn");
                          const expiry = detailText(row, "expiryDate", "expiresAt", "expiry", "expiryOn");
                          const displayDate = (value: string) => { const date = value ? new Date(value) : null; return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : value || "—"; };
                          return <tr key={detailText(row, "id", "userId") || index} className="border-t border-[#edf0f2] even:bg-[#fcfcfd]"><td className="whitespace-nowrap px-3 py-3 font-semibold text-[#35404a]">{detailText(row, "name", "customerName", "fullName") || "—"}</td><td className="whitespace-nowrap px-3 py-3 font-mono text-[10px] text-[#9aa3b1]">{detailText(row, "phone", "phoneNumber") || "—"}</td><td className="whitespace-nowrap px-3 py-3 text-[#899198]">{displayDate(registration)}</td><td className="whitespace-nowrap px-3 py-3 text-[#899198]">{displayDate(expiry)}</td><td className="whitespace-nowrap px-3 py-3"><span className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${expired ? "border-[#f3cccc] bg-[#fff3f3] text-[#d93d4a]" : status.toLowerCase().includes("active") ? "border-[#bcebd8] bg-[#effbf5] text-[#16845a]" : "border-[#e1e5e8] bg-[#f8fafc] text-[#899198]"}`}>{status}</span></td><td className="px-3 py-3 text-right font-semibold">{detailNumber(row, "rewardedOrders") + detailNumber(row, "orderCount")}</td></tr>;
                        })}</tbody>
                      </table>
                    </div>
                    <p className="mt-3 flex gap-4 text-[11px] text-[#899198]"><span><span className="mr-1 text-[#20ad7a]">●</span>Active: {activeInvitees.length}</span><span><span className="mr-1 text-[#e45860]">●</span>Expired: {expiredInvitees.length}</span></p>
                  </>;
                })()}
                {(detailView === "orders" || detailView === "orderValue") && <>
                  {detailView === "orderValue" && <div className="mb-3 grid grid-cols-3 gap-2"><div className="rounded-[9px] border border-[#e1e5e8] bg-[#fafbfc] p-3"><p className="text-[10px] text-[#9aa3ad]">Total Orders</p><p className="mt-1 font-bold">{totalOrders}</p></div><div className="rounded-[9px] border border-[#e1e5e8] bg-[#fafbfc] p-3"><p className="text-[10px] text-[#9aa3ad]">Total Value</p><p className="mt-1 font-bold">{orderValueLabel === "—" ? "ETB 0" : orderValueLabel}</p></div><div className="rounded-[9px] border border-[#e1e5e8] bg-[#fafbfc] p-3"><p className="text-[10px] text-[#9aa3ad]">Total Commission</p><p className="mt-1 font-bold text-[#a51e31]">{commissionLabel}</p></div></div>}
                  <div className="overflow-x-auto rounded-[10px] border border-[#e1e5e8]"><table className="w-full min-w-[700px] border-collapse text-left text-[11px]"><thead className="bg-[#f8fafc] text-[9px] font-bold uppercase tracking-wide text-[#9aa3ad]"><tr>{["Order", "Customer", "Amount", "Month", "Earned %", "Commission", "Status"].map((heading) => <th key={heading} className="whitespace-nowrap px-3 py-3">{heading}</th>)}</tr></thead><tbody>{detailOrders.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-[#899198]">{isLoadingDetails ? "Loading orders..." : "No order details available."}</td></tr> : detailOrders.map((order, index) => {
                    const orderDate = detailText(order, "createdAt", "orderDate", "date");
                    const paidValue = order.paid;
                    const status = detailText(order, "status") || (typeof paidValue === "boolean" ? paidValue ? "Paid" : "Pending" : "—");
                    const amount = detailNumber(order, "amount", "orderAmount", "totalAmount", "value");
                    const commission = detailNumber(order, "commission", "commissionAmount", "earnedCommission");
                    return <tr key={detailText(order, "id", "orderId", "orderNumber") || index} className="border-t border-[#edf0f2] even:bg-[#fcfcfd]"><td className="whitespace-nowrap px-3 py-3 font-mono text-[10px] text-[#9aa3ad]">{detailText(order, "orderId", "orderNumber", "id") || "—"}</td><td className="whitespace-nowrap px-3 py-3 font-semibold">{detailText(order, "customer", "customerName", "inviteeName") || "—"}</td><td className="whitespace-nowrap px-3 py-3 font-semibold">{amount ? formatAmount(amount) : "—"}</td><td className="whitespace-nowrap px-3 py-3 text-[#899198]">{detailText(order, "month") || (orderDate ? new Date(orderDate).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : "—")}</td><td className="whitespace-nowrap px-3 py-3 font-semibold text-[#941c2d]">{detailText(order, "earnedPercent", "commissionRate", "rate") || "—"}</td><td className="whitespace-nowrap px-3 py-3 text-right font-semibold">{commission ? formatAmount(commission) : "—"}</td><td className="whitespace-nowrap px-3 py-3"><span className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${status.toLowerCase() === "paid" ? "border-[#bcebd8] bg-[#effbf5] text-[#16845a]" : "border-[#f2e2a7] bg-[#fff9e8] text-[#b88005]"}`}>{status}</span></td></tr>;
                  })}</tbody></table></div>
                </>}
                {detailView === "commission" && <div className="overflow-x-auto rounded-[10px] border border-[#e1e5e8]"><table className="w-full min-w-[520px] border-collapse text-left text-[11px]"><thead className="bg-[#f8fafc] text-[9px] font-bold uppercase tracking-wide text-[#9aa3ad]"><tr>{["Customer", "Orders", "Paid Commission", "Pending Commission", "Total Commission"].map((heading) => <th key={heading} className="whitespace-nowrap px-3 py-3">{heading}</th>)}</tr></thead><tbody>{detailInvitees.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-[#899198]">{isLoadingDetails ? "Loading commission details..." : "No commission details available."}</td></tr> : detailInvitees.map((row, index) => {
                  const paid = detailNumber(row, "paidAmount", "paidCommission");
                  const unpaid = detailNumber(row, "unpaidAmount", "pendingCommission");
                  return <tr key={detailText(row, "id", "userId") || index} className="border-t border-[#edf0f2] even:bg-[#fcfcfd]"><td className="px-3 py-3 font-semibold">{detailText(row, "name", "customerName", "fullName") || "—"}</td><td className="px-3 py-3">{detailNumber(row, "rewardedOrders") + detailNumber(row, "orderCount")}</td><td className="px-3 py-3">{formatAmount(paid) || "ETB 0"}</td><td className="px-3 py-3">{formatAmount(unpaid) || "ETB 0"}</td><td className="px-3 py-3 font-bold text-[#a51e31]">{formatAmount(paid + unpaid) || "ETB 0"}</td></tr>;
                })}</tbody></table></div>}
              </>}
            </div>
            {detailView !== "summary" && <footer className="flex shrink-0 justify-end border-t border-[#edf0f2] px-5 py-3"><button type="button" onClick={() => setDetailView("summary")} className="h-9 rounded-md border border-[#dfe3e6] px-4 text-xs font-semibold text-[#65717c] hover:bg-[#f8fafb]">Back to Summary</button></footer>}
          </div>
        </div>
      )}
      {isCreateOpen && (
        <div data-viewer-write className="fixed inset-0 z-50 grid place-items-center bg-[#18252b]/30 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="create-affiliate-title">
          <div className="w-full max-w-[430px] overflow-hidden rounded-2xl bg-white shadow-[0_20px_70px_rgba(15,23,42,0.2)]">
            <div className="flex items-start justify-between border-b border-[#edf0f2] px-5 py-4">
              <div><h2 id="create-affiliate-title" className="text-sm font-bold text-[#27313b]">Create Affiliate Link</h2><p className="mt-1 text-xs text-[#9aa1a7]">Generate a trackable referral link</p></div>
              <button type="button" onClick={() => setIsCreateOpen(false)} className="text-xl leading-none text-[#a5abb0] hover:text-[#27313b]" aria-label="Close">×</button>
            </div>
            <div className="space-y-4 px-5 py-5">
              <div><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[#9aa1a7]">Affiliate Type</p><div className="grid grid-cols-2 gap-2">{([{ value: "company", label: "Merchant" }, { value: "staff", label: "Staff" }] as const).map(({ value, label }) => <button key={value} type="button" onClick={() => { setAffiliateType(value); setCreateError(""); }} className={`h-10 rounded-lg border text-xs font-bold ${affiliateType === value ? "border-[#951d2c] bg-[#951d2c] text-white" : "border-[#dfe3e6] bg-white text-[#65717c] hover:border-[#951d2c]"}`}>{label}</button>)}</div></div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#9aa1a7]">Branch<select value={branch} onChange={(event) => setBranch(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-[#dfe3e6] bg-white px-3 text-sm font-normal normal-case tracking-normal text-[#46515b] outline-none focus:border-[#951d2c]"><option value="">Select branch</option>{createBranchOptions.map((branchName) => <option key={branchName} value={branchName}>{branchName}</option>)}</select></label>
              <label className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#9aa1a7]">Merchant<select value={merchant} onChange={(event) => { const nextMerchant = event.target.value; setMerchant(nextMerchant); const nextBranch = records.find((record) => record.merchant?.trim() === nextMerchant)?.branch?.trim(); if (nextBranch) setBranch(nextBranch); }} className="mt-2 h-11 w-full rounded-lg border border-[#dfe3e6] bg-white px-3 text-sm font-normal normal-case tracking-normal text-[#46515b] outline-none focus:border-[#951d2c]"><option value="">Select merchant</option>{createMerchantOptions.map((merchantName) => <option key={merchantName} value={merchantName}>{merchantName}</option>)}</select></label>
              {affiliateType === "company" && <label className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#9aa1a7]">Link Name<input value={linkName} onChange={(event) => setLinkName(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-[#dfe3e6] px-3 text-sm font-normal normal-case tracking-normal text-[#46515b] outline-none focus:border-[#951d2c]" /></label>}
              <details className="rounded-lg border border-[#e1e5e8] px-3 py-2"><summary className="cursor-pointer text-[10px] font-bold uppercase tracking-[0.08em] text-[#899198]">Merchant and branch IDs required for creation</summary><div className="mt-3 grid grid-cols-2 gap-2"><label className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#9aa1a7]">Merchant ID<input inputMode="numeric" value={merchantId} onChange={(event) => setMerchantId(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-[#dfe3e6] px-3 text-sm font-normal normal-case tracking-normal text-[#46515b] outline-none focus:border-[#951d2c]" /></label><label className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#9aa1a7]">Branch ID<input inputMode="numeric" value={branchId} onChange={(event) => setBranchId(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-[#dfe3e6] px-3 text-sm font-normal normal-case tracking-normal text-[#46515b] outline-none focus:border-[#951d2c]" /></label></div><button type="button" onClick={lookupRegistrations} disabled={!/^\d+$/.test(merchantId.trim()) || isLoadingRegistrations} className="mt-3 h-9 rounded-lg bg-[#eef1f3] px-3 text-xs font-bold text-[#46515b] disabled:cursor-not-allowed disabled:opacity-50">{isLoadingRegistrations ? "Checking..." : registrationCount === null ? "Check merchant registrations" : `${registrationCount.toLocaleString()} registrations`}</button></details>
              {affiliateType === "staff" && <div><label className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#9aa1a7]">Staff Phone<div className="mt-2 flex gap-2"><input value={staffPhone} onChange={(event) => { setStaffPhone(event.target.value); setStaffName(""); setStaffLookupError(""); }} placeholder="Enter phone number" className="h-11 min-w-0 flex-1 rounded-lg border border-[#dfe3e6] px-3 text-sm font-normal normal-case tracking-normal text-[#46515b] outline-none focus:border-[#951d2c]" /><button type="button" onClick={lookupStaff} disabled={!staffPhone.trim() || !/^\d+$/.test(merchantId.trim()) || isLookingUpStaff} className="shrink-0 rounded-lg bg-[#eef1f3] px-3 text-xs font-bold text-[#46515b] hover:bg-[#e3e7e9] disabled:cursor-not-allowed disabled:opacity-50">{isLookingUpStaff ? "Looking..." : "Find Name"}</button></div></label>{staffName && <p className="mt-2 text-xs font-semibold text-[#19815e]">{staffName}</p>}{staffLookupError && <p className="mt-2 text-xs text-[#b24760]">{staffLookupError}</p>}</div>}
              {createError && <p className="rounded-lg bg-[#fff0f2] px-3 py-2 text-xs text-[#9b263c]">{createError}</p>}
              {createdLink && <div><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[#9aa1a7]">Generated Link</p><div className="flex h-11 items-center justify-between rounded-lg border border-[#e1e5e8] bg-[#fafbfc] px-3 font-mono text-xs text-[#46515b]"><span className="truncate">{createdLink.replace(/^https?:\/\//, "")}</span><button type="button" onClick={() => handleCopy(createdLink)} className="ml-3 shrink-0 font-sans text-[11px] font-semibold text-[#687383]">{copiedCode === createdLink ? "Copied" : "Copy Link"}</button></div></div>}
            </div>
            <div className="flex justify-end gap-2 border-t border-[#edf0f2] px-5 py-4"><button type="button" onClick={() => setIsCreateOpen(false)} className="h-10 rounded-lg border border-[#dfe3e6] px-4 text-xs font-semibold text-[#65717c]">Cancel</button><button type="button" onClick={handleGenerateLink} disabled={!canSubmit || isCreating} className="h-10 rounded-lg bg-[#951d2c] px-5 text-xs font-bold text-white hover:bg-[#751322] disabled:cursor-not-allowed disabled:opacity-50">{isCreating ? "Creating..." : "Generate Link"}</button></div>
          </div>
        </div>
      )}
    </main>
  );
}
