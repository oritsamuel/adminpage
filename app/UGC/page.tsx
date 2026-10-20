"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type DetailRow = Record<string, unknown>;
type DetailView = "summary" | "invited" | "active" | "expired" | "orders" | "orderValue" | "commission";
type InviteeCounts = { total: number; active: number; expired: number };

type DashboardReferrer = {
  id: number | null;
  name: string;
  phone: string;
  code: string;
  affiliateType?: "user" | "merchant" | "staff";
  merchantId?: number;
  merchant?: string;
  branchId?: number;
  branch?: string;
  referrals: number;
  affiliateLink?: string;
};

type DashboardResponse = {
  isSuccessful?: boolean;
  data?: unknown;
  errorMessages?: string[];
  pagination?: {
    page?: number;
    pageSize?: number;
    totalCount?: number;
    totalPages?: number;
    hasNext?: boolean;
  };
};

type UGCKeyMetrics = {
  merchantLinks?: number;
  staffLinks?: number;
  userLinks?: number;
  totalInvitedUsers?: number;
  activeReferrals?: number;
  expiredReferrals?: number;
  totalOrders?: number;
  totalCommission?: number;
};

type AffiliateTypeFilter = "All" | "user" | "merchant" | "staff";
type AffiliateType = "company" | "staff";
type CreateReferralResponse = {
  isSuccessful: boolean;
  data: { id?: number | string; name?: string; code: string; type: string; affiliateLink: string } | null;
  errorMessages?: string[];
};

type CreateOption = {
  id: string;
  label: string;
};

type SummaryCard = {
  label: string;
  value: string;
  sublabel: string;
  color: string;
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

function responseError(payload: unknown, fallback: string): string {
  const record = objectValue(payload);
  const messages = record?.errorMessages;
  if (Array.isArray(messages)) {
    const message = messages.filter((value): value is string => typeof value === "string").join(" ");
    if (message) return message;
  }
  return fallback;
}

function extractOptions(payload: unknown, collectionNames: string[], idNames: string[], labelNames: string[], noun: string): CreateOption[] {
  const root = objectValue(payload);
  const data = objectValue(root?.data);
  const collections = [payload, root?.data, ...collectionNames.map((name) => root?.[name]), ...collectionNames.map((name) => data?.[name])];
  const list = collections.find(Array.isArray);
  if (!Array.isArray(list)) throw new Error(`The ${noun} endpoint returned an unexpected response.`);

  return list.map((value) => {
    const item = objectValue(value);
    if (!item) throw new Error(`The ${noun} endpoint returned an invalid item.`);
    const id = stringValue(...idNames.map((name) => item[name]));
    const label = stringValue(...labelNames.map((name) => item[name]));
    if (!id || !label) throw new Error(`The ${noun} endpoint returned an item without an ID or name.`);
    return { id, label };
  });
}

function SearchableOptionSelect({
  label,
  value,
  options,
  disabled,
  placeholder,
  loading,
  onChange,
}: {
  label: string;
  value: string;
  options: CreateOption[];
  disabled?: boolean;
  placeholder: string;
  loading?: boolean;
  onChange: (id: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.id === value);
  const visibleOptions = options.filter((option) => option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  return (
    <div className="relative">
      <label className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#9aa1a7]">
        {label}
        <input
          type="text"
          value={isOpen ? query : selected?.label ?? ""}
          onFocus={() => { setQuery(""); setIsOpen(true); }}
          onChange={(event) => { setQuery(event.target.value); setIsOpen(true); }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setIsOpen(false);
              setQuery("");
            }
          }}
          disabled={disabled}
          placeholder={loading ? `Loading ${label.toLowerCase()}...` : placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={`${label.toLowerCase()}-options`}
          aria-autocomplete="list"
          className="mt-2 h-11 w-full rounded-lg border border-[#dfe3e6] bg-white px-3 text-sm font-normal normal-case tracking-normal text-[#46515b] outline-none focus:border-[#951d2c] disabled:bg-[#f5f6f7]"
        />
      </label>
      {isOpen && !disabled && (
        <div id={`${label.toLowerCase()}-options`} role="listbox" className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-[#dfe3e6] bg-white py-1 shadow-lg">
          {visibleOptions.length ? visibleOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={option.id === value}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(option.id);
                setQuery("");
                setIsOpen(false);
              }}
              className="block w-full px-3 py-2 text-left text-sm font-normal normal-case tracking-normal text-[#46515b] hover:bg-[#f5f6f7]"
            >
              {option.label}
            </button>
          )) : (
            <p className="px-3 py-2 text-xs font-normal normal-case tracking-normal text-[#899198]">
              {loading ? `Loading ${label.toLowerCase()}...` : options.length ? "No matches found." : `No ${label.toLowerCase()} available.`}
            </p>
          )}
        </div>
      )}
    </div>
  );
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
  const rawType = stringValue(record.affiliateType).toLowerCase();
  const affiliateType = rawType === "staff" ? "staff" : rawType === "company" || rawType === "merchant" ? "merchant" : "user";

  return {
    ...record,
    id,
    name: stringValue(record.name),
    phone: stringValue(record.phone),
    code: stringValue(record.code),
    affiliateType,
    merchantId: numberValue(record.merchantId) || undefined,
    merchant: stringValue(record.merchant),
    branchId: numberValue(record.branchId) || undefined,
    branch: stringValue(record.branch),
    referrals: numberValue(record.referrals),
    affiliateLink: stringValue(record.affiliateLink) || undefined,
  };
}

async function fetchAffiliateRecords(): Promise<DashboardReferrer[]> {
  const records: DashboardReferrer[] = [];
  let page = 1;

  while (true) {
    const response = await fetch(`/api/ugc/dashboard?page=${page}&pageSize=100`, { cache: "no-store" });
    const payload = await response.json() as DashboardResponse;
    if (!response.ok || !payload.isSuccessful) {
      throw new Error(payload.errorMessages?.join(" ") || "Unable to load affiliate links.");
    }
    if (!Array.isArray(payload.data) || !payload.pagination || typeof payload.pagination.hasNext !== "boolean" || typeof payload.pagination.totalPages !== "number") {
      throw new Error("The /links endpoint returned an unexpected paginated response.");
    }

    records.push(...payload.data.map(normalizeAffiliate).filter((record): record is DashboardReferrer => record !== null));
    if (!payload.pagination.hasNext) break;
    if (page >= payload.pagination.totalPages) {
      throw new Error("The /links endpoint returned inconsistent pagination metadata.");
    }
    page += 1;
  }

  return records;
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
  return detailText(row, "status").toLowerCase() === "expired";
}

function isActiveInvitee(row: DetailRow): boolean {
  return detailText(row, "status").toLowerCase() === "active";
}

export default function UGC() {
  const [records, setRecords] = useState<DashboardReferrer[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<AffiliateTypeFilter>("All");
  const [merchantFilter, setMerchantFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [kpis, setKpis] = useState<UGCKeyMetrics | null>(null);
  const [copiedCode, setCopiedCode] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<DashboardReferrer | null>(null);
  const [detailView, setDetailView] = useState<DetailView>("summary");
  const [detailInvitees, setDetailInvitees] = useState<DetailRow[]>([]);
  const [detailInviteeCounts, setDetailInviteeCounts] = useState<InviteeCounts>({ total: 0, active: 0, expired: 0 });
  const [detailOrders, setDetailOrders] = useState<DetailRow[]>([]);
  const [detailPerformance, setDetailPerformance] = useState<Record<string, unknown> | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailError, setDetailError] = useState("");
  const detailRequestId = useRef(0);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [affiliateType, setAffiliateType] = useState<AffiliateType>("company");
  const [branch, setBranch] = useState("");
  const [merchant, setMerchant] = useState("");
  const [merchantId, setMerchantId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [createMerchants, setCreateMerchants] = useState<CreateOption[]>([]);
  const [createBranches, setCreateBranches] = useState<CreateOption[]>([]);
  const [isLoadingCreateMerchants, setIsLoadingCreateMerchants] = useState(false);
  const [isLoadingCreateBranches, setIsLoadingCreateBranches] = useState(false);
  const [merchantOptionsError, setMerchantOptionsError] = useState("");
  const [branchOptionsError, setBranchOptionsError] = useState("");
  const createMerchantRequestId = useRef(0);
  const createBranchRequestId = useRef(0);
  const [staffPhone, setStaffPhone] = useState("");
  const [staffName, setStaffName] = useState("");
  const [linkName, setLinkName] = useState("");
  const [createError, setCreateError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [linkSuccess, setLinkSuccess] = useState("");

  const openCreateDialog = async () => {
    setIsCreateOpen(true);
    setMerchantId("");
    setBranchId("");
    setMerchant("");
    setBranch("");
    setLinkName("");
    setCreateMerchants([]);
    setCreateBranches([]);
    setMerchantOptionsError("");
    setBranchOptionsError("");
    setCreateError("");
    setIsLoadingCreateMerchants(true);
    const requestId = ++createMerchantRequestId.current;
    try {
      const response = await fetch("/api/auth/merchants", { cache: "no-store" });
      const payload: unknown = await response.json();
      if (!response.ok || objectValue(payload)?.isSuccessful === false) {
        throw new Error(responseError(payload, "Unable to load merchants."));
      }
      const options = extractOptions(
        payload,
        ["merchants", "items"],
        ["id", "merchantId", "companyId"],
        ["name", "merchantName", "companyName", "label"],
        "merchant list",
      );
      if (requestId === createMerchantRequestId.current) setCreateMerchants(options);
    } catch (loadError) {
      if (requestId === createMerchantRequestId.current) {
        setMerchantOptionsError(loadError instanceof Error ? loadError.message : "Unable to load merchants.");
      }
    } finally {
      if (requestId === createMerchantRequestId.current) setIsLoadingCreateMerchants(false);
    }
  };

  const closeCreateDialog = () => {
    createMerchantRequestId.current += 1;
    createBranchRequestId.current += 1;
    setIsCreateOpen(false);
    setIsLoadingCreateMerchants(false);
    setIsLoadingCreateBranches(false);
  };

  const selectCreateMerchant = async (nextMerchantId: string) => {
    const selected = createMerchants.find((option) => option.id === nextMerchantId);
    setMerchantId(nextMerchantId);
    setMerchant(selected?.label ?? "");
    setLinkName(selected?.label ?? "");
    setBranchId("");
    setBranch("");
    setCreateBranches([]);
    setBranchOptionsError("");
    setCreateError("");
    const requestId = ++createBranchRequestId.current;
    if (!nextMerchantId) {
      setIsLoadingCreateBranches(false);
      return;
    }

    setIsLoadingCreateBranches(true);
    try {
      const response = await fetch(`/api/auth/merchants/${encodeURIComponent(nextMerchantId)}/branches`, { cache: "no-store" });
      const payload: unknown = await response.json();
      if (!response.ok || objectValue(payload)?.isSuccessful === false) {
        throw new Error(responseError(payload, "Unable to load branches."));
      }
      const options = extractOptions(
        payload,
        ["branches", "items"],
        ["id", "branchId"],
        ["name", "branchName", "branch", "label"],
        "branch list",
      );
      if (requestId === createBranchRequestId.current) setCreateBranches(options);
    } catch (loadError) {
      if (requestId === createBranchRequestId.current) {
        setBranchOptionsError(loadError instanceof Error ? loadError.message : "Unable to load branches.");
      }
    } finally {
      if (requestId === createBranchRequestId.current) setIsLoadingCreateBranches(false);
    }
  };

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [affiliateRecords, kpiPayload] = await Promise.all([
          fetchAffiliateRecords(),
          fetch("/api/ugc/kpis", { cache: "no-store" }).then(async (response) => {
            const payload = (await response.json()) as DashboardResponse & { data?: UGCKeyMetrics };
            if (!response.ok || !payload.isSuccessful) {
              throw new Error(payload.errorMessages?.join(" ") || "Unable to load UGC KPIs.");
            }
            return (payload.data as UGCKeyMetrics) ?? {};
          }),
        ]);
        setRecords(affiliateRecords);
        setKpis(kpiPayload);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load affiliate links.");
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();
  }, []);

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
      const matchesType = typeFilter === "All" || record.affiliateType === typeFilter;
      const matchesMerchant = !merchantFilter || record.merchant?.trim() === merchantFilter;
      const matchesBranch = !branchFilter || record.branch?.trim() === branchFilter;
      return matchesSearch && matchesType && matchesMerchant && matchesBranch;
    });
  }, [records, search, typeFilter, merchantFilter, branchFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / itemsPerPage));
  const visiblePage = Math.min(currentPage, totalPages);
  const startIndex = (visiblePage - 1) * itemsPerPage;
  const paginatedRecords = filteredRecords.slice(startIndex, startIndex + itemsPerPage);
  const merchantLinkCount = Math.max(
    kpis?.merchantLinks ?? 0,
    records.filter((record) => record.affiliateType === "merchant").length,
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setCurrentPage(1), 0);
    return () => window.clearTimeout(timer);
  }, [search, typeFilter, merchantFilter, branchFilter]);

  const summaryCards: SummaryCard[] = [
    { label: "Merchant Links", value: kpis?.merchantLinks !== undefined ? merchantLinkCount.toLocaleString() : "", sublabel: "merchant referrals", color: "#d93d4a" },
    { label: "Staff Links", value: kpis?.staffLinks !== undefined ? kpis.staffLinks.toLocaleString() : "", sublabel: "staff referrals", color: "#2d5bd7" },
    { label: "User Links", value: kpis?.userLinks !== undefined ? kpis.userLinks.toLocaleString() : "", sublabel: "personal user links", color: "#6d47d9" },
    { label: "Total Invited Users", value: kpis?.totalInvitedUsers !== undefined ? kpis.totalInvitedUsers.toLocaleString() : "", sublabel: "customers acquired", color: "#27313b" },
    { label: "Active Referrals", value: kpis?.activeReferrals !== undefined ? kpis.activeReferrals.toLocaleString() : "", sublabel: "within expiry window", color: "#1e9f70" },
    { label: "Expired Referrals", value: kpis?.expiredReferrals !== undefined ? kpis.expiredReferrals.toLocaleString() : "", sublabel: "cap reached", color: "#d97706" },
    { label: "Total Orders", value: kpis?.totalOrders !== undefined ? kpis.totalOrders.toLocaleString() : "", sublabel: "referred orders", color: "#27313b" },
    { label: "Total Commission", value: kpis?.totalCommission !== undefined ? formatAmount(kpis.totalCommission) : "", sublabel: "commission earned", color: "#8d2a2d" },
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

  const handleViewRecord = async (record: DashboardReferrer) => {
    const requestId = ++detailRequestId.current;
    setSelectedRecord(record);
    setDetailView("summary");
    setDetailInvitees([]);
    setDetailInviteeCounts({ total: 0, active: 0, expired: 0 });
    setDetailOrders([]);
    setDetailPerformance(null);
    setIsLoadingDetails(true);
    setDetailError("");

    if (record.id === null) {
      setDetailError("Detailed affiliate information requires a backend ID.");
      setIsLoadingDetails(false);
      return;
    }

    const loadPayload = async (url: string) => {
      const response = await fetch(url, { cache: "no-store" });
      const payload = await response.json() as Record<string, unknown>;
      if (!response.ok || payload.isSuccessful !== true) {
        const messages = payload.errorMessages;
        throw new Error(Array.isArray(messages) ? messages.join(" ") : "Unable to load affiliate details.");
      }
      return payload;
    };

    try {
      const type = record.affiliateType ?? "user";
      const linkParams = new URLSearchParams();
      if (record.merchantId !== undefined) linkParams.set("merchantId", String(record.merchantId));
      if (record.branchId !== undefined) linkParams.set("branchId", String(record.branchId));
      const detailQuery = linkParams.toString();
      const inviteeParams = new URLSearchParams(linkParams);
      inviteeParams.set("page", "1");
      inviteeParams.set("pageSize", "100");
      const affiliatePath = `/api/ugc/affiliates/${type}/${record.id}`;
      const [affiliateResult, inviteesResult, ordersResult] = await Promise.allSettled([
        loadPayload(`${affiliatePath}${detailQuery ? `?${detailQuery}` : ""}`),
        loadPayload(`${affiliatePath}/invitees?${inviteeParams}`).then((payload) => {
          const data = objectValue(payload.data);
          return {
            rows: extractRows(payload, ["items"]),
            counts: {
              total: numberValue(data?.total),
              active: numberValue(data?.activeCount),
              expired: numberValue(data?.expiredCount),
            },
          };
        }),
        type === "user"
          ? loadPayload(`/api/ugc/referrers/${record.id}/orders?page=1&pageSize=100`).then((payload) => extractRows(payload, ["items"]))
          : Promise.resolve([]),
      ]);

      if (requestId !== detailRequestId.current) return;

      const errors: string[] = [];
      if (affiliateResult.status === "fulfilled") {
        const data = objectValue(affiliateResult.value.data);
        setDetailPerformance(objectValue(data?.performance));
      } else {
        errors.push(affiliateResult.reason instanceof Error ? affiliateResult.reason.message : "Unable to load affiliate performance.");
      }

      if (inviteesResult.status === "fulfilled") {
        setDetailInvitees(inviteesResult.value.rows);
        setDetailInviteeCounts(inviteesResult.value.counts);
      } else {
        errors.push(inviteesResult.reason instanceof Error ? inviteesResult.reason.message : "Unable to load invited users.");
      }

      if (ordersResult.status === "fulfilled") {
        setDetailOrders(ordersResult.value);
      } else if (type === "user") {
        errors.push(ordersResult.reason instanceof Error ? ordersResult.reason.message : "Unable to load referrer orders.");
      }

      setDetailError(errors.join(" "));
    } catch (viewError) {
      if (requestId !== detailRequestId.current) return;
      setDetailError(viewError instanceof Error ? viewError.message : "Unable to load affiliate details.");
    } finally {
      if (requestId === detailRequestId.current) {
        setIsLoadingDetails(false);
      }
    }
  };

  const closeDetails = () => {
    detailRequestId.current += 1;
    setSelectedRecord(null);
    setDetailView("summary");
    setDetailPerformance(null);
    setDetailInviteeCounts({ total: 0, active: 0, expired: 0 });
  };

  const handleGenerateLink = async () => {
    if (!/^\d+$/.test(merchantId.trim()) || !/^\d+$/.test(branchId.trim())) {
      setCreateError("Select a merchant and branch before creating the link.");
      return;
    }
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
      const response = await fetch("/api/ugc/links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = (await response.json()) as CreateReferralResponse;
      if (!response.ok || !payload.isSuccessful || !payload.data?.affiliateLink) throw new Error(payload.errorMessages?.join(" ") || "Unable to create referral link.");
      const created = payload.data;
      setLinkSuccess(created.affiliateLink);
      closeCreateDialog();
      setCurrentPage(1);
      setError("");
      setIsLoading(true);
      try {
        const refreshedRecords = await fetchAffiliateRecords();
        const returnedId = created.id === undefined ? null : Number(created.id);
        const foundCreatedAffiliate = refreshedRecords.some((record) =>
          record.code === created.code || (returnedId !== null && Number.isFinite(returnedId) && record.id === returnedId),
        );
        if (!foundCreatedAffiliate) {
          const createdRecord = normalizeAffiliate({
            id: created.id ?? null,
            name: created.name,
            phone,
            code: created.code,
            affiliateType: created.type,
            merchantId: Number(merchantId),
            merchant,
            branchId: Number(branchId),
            branch,
            referrals: 0,
            affiliateLink: created.affiliateLink,
          });
          setRecords(createdRecord ? [...refreshedRecords, createdRecord] : refreshedRecords);
          setError("The link was created and is shown here. The backend list includes links only after they receive registrations.");
        } else {
          setRecords(refreshedRecords);
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

  const canSubmit = Boolean(
    /^\d+$/.test(merchantId.trim())
    && /^\d+$/.test(branchId.trim())
    && !isLoadingCreateMerchants
    && !isLoadingCreateBranches
    && (affiliateType === "staff" ? staffPhone.trim() && staffName.trim() : linkName.trim()),
  );

  const performanceNumber = (key: string, fallback = 0) =>
    detailPerformance?.[key] === undefined ? fallback : numberValue(detailPerformance[key]);
  const invitedCount = performanceNumber("invitedUsers", detailInviteeCounts.total || selectedRecord?.referrals || detailInvitees.length);
  const activeInvitees = detailInvitees.filter(isActiveInvitee);
  const expiredInvitees = detailInvitees.filter(isExpiredInvitee);
  const totalOrders = performanceNumber("orders", detailOrders.length);
  const totalOrderValue = performanceNumber("orderValue");
  const orderValueLabel = detailPerformance?.orderValue === undefined ? "—" : formatAmount(totalOrderValue) || "ETB 0";
  const commissionLabel = detailPerformance?.commission === undefined ? "—" : formatAmount(performanceNumber("commission")) || "ETB 0";
  const performanceMetrics: { title: string; value: string; view: Exclude<DetailView, "summary">; tone: string }[] = [
    { title: "Invited Users", value: invitedCount.toLocaleString(), view: "invited", tone: "text-[#17212b]" },
    { title: "Active Users", value: performanceNumber("activeUsers", detailInviteeCounts.active || activeInvitees.length).toLocaleString(), view: "active", tone: "text-[#16845a]" },
    { title: "Expired Users", value: performanceNumber("expiredUsers", detailInviteeCounts.expired || expiredInvitees.length).toLocaleString(), view: "expired", tone: "text-[#d93d4a]" },
    { title: "Orders", value: totalOrders.toLocaleString(), view: "orders", tone: "text-[#17212b]" },
    { title: "Order Value", value: orderValueLabel, view: "orderValue", tone: "text-[#17212b]" },
    { title: "Commission", value: commissionLabel, view: "commission", tone: "text-[#a51e31]" },
  ];
  const detailTitle: Record<DetailView, string> = {
    summary: "Affiliate Detail",
    invited: `All Invited Users (${invitedCount})`,
    active: `Active Users (${performanceNumber("activeUsers", detailInviteeCounts.active || activeInvitees.length)})`,
    expired: `Expired Users (${performanceNumber("expiredUsers", detailInviteeCounts.expired || expiredInvitees.length)})`,
    orders: `All Orders (${totalOrders})`,
    orderValue: "Order Value Breakdown",
    commission: "Commission Breakdown",
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
            <label className="flex h-7 w-[132px] items-center gap-2 rounded-md border border-[#e1e5e8] bg-white px-3 text-[10px] text-[#b0b6bb] shadow-sm">
              <span>⌕</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search..." className="w-full bg-transparent outline-none placeholder:text-[#b0b6bb]" />
            </label>
          </div>
          <button type="button" data-viewer-write onClick={() => void openCreateDialog()} className="h-7 shrink-0 rounded-md bg-[#8d1829] px-4 text-[10px] font-bold text-white opacity-95 hover:bg-[#751322]">＋ Create Affiliate Link</button>
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
                <tr>{['Type', 'Owner', 'Phone', 'Merchant', 'Branch', 'Affiliate Link', 'Registrations', 'Actions'].map((heading) => <th key={heading} className="px-2 py-2.5 first:pl-3 last:pr-3">{heading}</th>)}</tr>
              </thead>
              <tbody>
                {isLoading ? <tr><td colSpan={8} className="border-t border-[#edf0f2] px-3 py-10 text-center text-xs text-[#8d949a]">Loading affiliate links...</td></tr> : filteredRecords.length === 0 ? <tr><td colSpan={8} className="border-t border-[#edf0f2] px-3 py-10 text-center text-xs text-[#8d949a]">No affiliate links found.</td></tr> : paginatedRecords.map((record, index) => {
                  return <tr key={record.id ?? record.code} className={index % 2 ? "bg-[#fcfcfd] text-[10px] text-[#53606a]" : "bg-white text-[10px] text-[#53606a]"}>
                    <td className="border-t border-[#edf0f2] px-2 py-2 first:pl-3"><span className={`rounded px-2 py-1 text-[9px] font-bold ${typeClasses[record.affiliateType || "user"]}`}>{record.affiliateType || "user"}</span></td>
                    <td className="border-t border-[#edf0f2] px-2 py-2 font-bold text-[#35404a]">{record.name}</td>
                    <td className="border-t border-[#edf0f2] px-2 py-2 text-[#8b949e]">{record.phone}</td>
                    <td className="border-t border-[#edf0f2] px-2 py-2">{record.merchant || ""}</td>
                    <td className="border-t border-[#edf0f2] px-2 py-2">{record.branch || ""}</td>
                    <td className="border-t border-[#edf0f2] px-2 py-2"><button type="button" onClick={() => handleCopy(record.affiliateLink || `https://hulubeje.com/ref/${record.code}`)} className="rounded bg-[#f0f2ff] px-2 py-1 font-mono text-[9px] text-[#5365bc] hover:bg-[#e5e9ff]">/ref/{record.code}{copiedCode === (record.affiliateLink || `https://hulubeje.com/ref/${record.code}`) ? " ✓" : ""}</button></td>
                    <td className="border-t border-[#edf0f2] px-2 py-2">{record.referrals || ""}</td>
                    <td className="border-t border-[#edf0f2] px-2 py-2 last:pr-3"><button type="button" onClick={() => handleViewRecord(record)} disabled={record.id === null} title={record.id === null ? "The create-link response does not include an owner ID; details are available after the link appears in the backend list." : undefined} className="rounded border border-[#dfe3e6] bg-white px-2 py-1 text-[9px] font-semibold text-[#53606a] hover:bg-[#f5f6f7] disabled:cursor-not-allowed disabled:opacity-50">View</button></td>
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
                {isLoadingDetails && <p className="mt-3 text-xs text-[#899198]">Loading performance details...</p>}
                {detailError && <p className="mt-3 rounded-md bg-[#fff7e8] px-3 py-2 text-xs text-[#8a6422]">{detailError}</p>}
              </> : <>
                {detailError && <p className="mb-3 rounded-md bg-[#fff7e8] px-3 py-2 text-xs text-[#8a6422]">{detailError}</p>}
                {(detailView === "invited" || detailView === "active" || detailView === "expired") && (() => {
                  const rows = detailView === "active" ? activeInvitees : detailView === "expired" ? expiredInvitees : detailInvitees;
                  return <>
                    <div className="overflow-x-auto rounded-[10px] border border-[#e1e5e8]">
                      <table className="w-full min-w-[650px] border-collapse text-left text-[11px]">
                        <thead className="bg-[#f8fafc] text-[9px] font-bold uppercase tracking-wide text-[#9aa3ad]"><tr>{["Customer", "Phone", "Registration", "Status", "Orders", "Paid Orders"].map((heading) => <th key={heading} className="whitespace-nowrap px-3 py-3">{heading}</th>)}</tr></thead>
                        <tbody>{rows.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-[#899198]">{isLoadingDetails ? "Loading users..." : "No user details available."}</td></tr> : rows.map((row, index) => {
                          const expired = isExpiredInvitee(row);
                          const status = detailText(row, "status") || "—";
                          const registration = detailText(row, "registration");
                          const displayDate = (value: string) => { const date = value ? new Date(value) : null; return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : value || "—"; };
                          return <tr key={detailText(row, "id") || index} className="border-t border-[#edf0f2] even:bg-[#fcfcfd]"><td className="whitespace-nowrap px-3 py-3 font-semibold text-[#35404a]">{detailText(row, "customer") || "—"}</td><td className="whitespace-nowrap px-3 py-3 font-mono text-[10px] text-[#9aa3b1]">{detailText(row, "phone") || "—"}</td><td className="whitespace-nowrap px-3 py-3 text-[#899198]">{displayDate(registration)}</td><td className="whitespace-nowrap px-3 py-3"><span className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${expired ? "border-[#f3cccc] bg-[#fff3f3] text-[#d93d4a]" : status.toLowerCase() === "active" ? "border-[#bcebd8] bg-[#effbf5] text-[#16845a]" : "border-[#e1e5e8] bg-[#f8fafc] text-[#899198]"}`}>{status}</span></td><td className="px-3 py-3 text-right font-semibold">{detailNumber(row, "orders")}</td><td className="px-3 py-3 text-right font-semibold">{detailNumber(row, "paidOrders")}</td></tr>;
                        })}</tbody>
                      </table>
                    </div>
                    <p className="mt-3 flex gap-4 text-[11px] text-[#899198]"><span><span className="mr-1 text-[#20ad7a]">●</span>Active: {detailInviteeCounts.active}</span><span><span className="mr-1 text-[#e45860]">●</span>Expired: {detailInviteeCounts.expired}</span><span>{detailInviteeCounts.total} total</span></p>
                    {detailInviteeCounts.total > detailInvitees.length && <p className="mt-2 text-[11px] text-[#8a6422]">Showing {detailInvitees.length} invitees. The contract does not return pagination metadata for this list.</p>}
                  </>;
                })()}
                {(detailView === "orders" || detailView === "orderValue") && <>
                  {detailView === "orderValue" && <div className="mb-3 grid grid-cols-3 gap-2"><div className="rounded-[9px] border border-[#e1e5e8] bg-[#fafbfc] p-3"><p className="text-[10px] text-[#9aa3ad]">Total Orders</p><p className="mt-1 font-bold">{totalOrders}</p></div><div className="rounded-[9px] border border-[#e1e5e8] bg-[#fafbfc] p-3"><p className="text-[10px] text-[#9aa3ad]">Total Value</p><p className="mt-1 font-bold">{orderValueLabel}</p></div><div className="rounded-[9px] border border-[#e1e5e8] bg-[#fafbfc] p-3"><p className="text-[10px] text-[#9aa3ad]">Total Commission</p><p className="mt-1 font-bold text-[#a51e31]">{commissionLabel}</p></div></div>}
                  {selectedRecord?.affiliateType !== "user" ? <p className="rounded-lg bg-[#fff7e8] px-3 py-3 text-xs text-[#8a6422]">The backend contract does not provide per-order rows for merchant or staff links.</p> : <div className="overflow-x-auto rounded-[10px] border border-[#e1e5e8]"><table className="w-full min-w-[700px] border-collapse text-left text-[11px]"><thead className="bg-[#f8fafc] text-[9px] font-bold uppercase tracking-wide text-[#9aa3ad]"><tr>{["Order", "Customer", "Date", "Amount", "Rate", "Commission", "Status"].map((heading) => <th key={heading} className="whitespace-nowrap px-3 py-3">{heading}</th>)}</tr></thead><tbody>{detailOrders.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-[#899198]">{isLoadingDetails ? "Loading orders..." : "No order details available."}</td></tr> : detailOrders.map((order, index) => {
                    const rate = detailNumber(order, "commissionRate");
                    const status = detailText(order, "paymentStatus") || "—";
                    const amount = detailNumber(order, "orderAmount");
                    const commission = detailNumber(order, "commissionAmount");
                    return <tr key={detailText(order, "orderId") || index} className="border-t border-[#edf0f2] even:bg-[#fcfcfd]"><td className="whitespace-nowrap px-3 py-3 font-mono text-[10px] text-[#9aa3b1]">{detailText(order, "orderId") || "—"}</td><td className="whitespace-nowrap px-3 py-3 font-semibold">{detailText(order, "inviteeName") || "—"}</td><td className="whitespace-nowrap px-3 py-3 text-[#899198]">{detailText(order, "orderDate") || "—"}</td><td className="whitespace-nowrap px-3 py-3 font-semibold">{formatAmount(amount) || "—"}</td><td className="whitespace-nowrap px-3 py-3 font-semibold text-[#941c2d]">{rate ? `${(rate * 100).toFixed(0)}%` : "—"}</td><td className="whitespace-nowrap px-3 py-3 text-right font-semibold">{formatAmount(commission) || "—"}</td><td className="whitespace-nowrap px-3 py-3"><span className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${status.toLowerCase() === "paid" ? "border-[#bcebd8] bg-[#effbf5] text-[#16845a]" : "border-[#f2e2a7] bg-[#fff9e8] text-[#b88005]"}`}>{status}</span></td></tr>;
                  })}</tbody></table></div>}
                </>}
                {detailView === "commission" && <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">{[["Paid Commission", "commissionPaid"], ["Pending Commission", "commissionUnpaid"], ["Total Commission", "commission"]].map(([label, key]) => <div key={key} className="rounded-[9px] border border-[#e1e5e8] bg-[#fafbfc] p-3"><p className="text-[10px] text-[#9aa3ad]">{label}</p><p className="mt-1 font-bold text-[#a51e31]">{detailPerformance?.[key] === undefined ? "—" : formatAmount(performanceNumber(key)) || "ETB 0"}</p></div>)}</div>}
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
              <button type="button" onClick={closeCreateDialog} className="text-xl leading-none text-[#a5abb0] hover:text-[#27313b]" aria-label="Close">×</button>
            </div>
            <div className="space-y-4 px-5 py-5">
              <div><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[#9aa1a7]">Affiliate Type</p><div className="grid grid-cols-2 gap-2">{([{ value: "company", label: "Merchant" }, { value: "staff", label: "Staff" }] as const).map(({ value, label }) => <button key={value} type="button" onClick={() => { setAffiliateType(value); setCreateError(""); }} className={`h-10 rounded-lg border text-xs font-bold ${affiliateType === value ? "border-[#951d2c] bg-[#951d2c] text-white" : "border-[#dfe3e6] bg-white text-[#65717c] hover:border-[#951d2c]"}`}>{label}</button>)}</div></div>
              <SearchableOptionSelect
                label="Merchant"
                value={merchantId}
                options={createMerchants}
                disabled={isLoadingCreateMerchants}
                loading={isLoadingCreateMerchants}
                placeholder={createMerchants.length ? "Search merchants..." : "No merchants available"}
                onChange={(id) => void selectCreateMerchant(id)}
              />
              {merchantOptionsError && <p className="rounded-lg bg-[#fff0f2] px-3 py-2 text-xs text-[#9b263c]">{merchantOptionsError}</p>}
              <SearchableOptionSelect
                label="Branch"
                value={branchId}
                options={createBranches}
                disabled={!merchantId || isLoadingCreateBranches || Boolean(branchOptionsError)}
                loading={isLoadingCreateBranches}
                placeholder={isLoadingCreateBranches ? "Loading branches..." : createBranches.length ? "Search branches..." : "No branches available"}
                onChange={(id) => {
                  const selected = createBranches.find((option) => option.id === id);
                  setBranchId(id);
                  setBranch(selected?.label ?? "");
                }}
              />
              {branchOptionsError && <p className="rounded-lg bg-[#fff0f2] px-3 py-2 text-xs text-[#9b263c]">{branchOptionsError}</p>}
              {affiliateType === "company" && <label className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#9aa1a7]">Link Name<input value={linkName} onChange={(event) => setLinkName(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-[#dfe3e6] px-3 text-sm font-normal normal-case tracking-normal text-[#46515b] outline-none focus:border-[#951d2c]" /></label>}
              {affiliateType === "staff" && <div className="grid grid-cols-2 gap-2"><label className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#9aa1a7]">Staff Name<input value={staffName} onChange={(event) => setStaffName(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-[#dfe3e6] px-3 text-sm font-normal normal-case tracking-normal text-[#46515b] outline-none focus:border-[#951d2c]" /></label><label className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#9aa1a7]">Staff Phone<input value={staffPhone} onChange={(event) => setStaffPhone(event.target.value)} placeholder="Enter phone number" className="mt-2 h-11 w-full rounded-lg border border-[#dfe3e6] px-3 text-sm font-normal normal-case tracking-normal text-[#46515b] outline-none focus:border-[#951d2c]" /></label></div>}
              {createError && <p className="rounded-lg bg-[#fff0f2] px-3 py-2 text-xs text-[#9b263c]">{createError}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-[#edf0f2] px-5 py-4"><button type="button" onClick={closeCreateDialog} className="h-10 rounded-lg border border-[#dfe3e6] px-4 text-xs font-semibold text-[#65717c]">Cancel</button><button type="button" onClick={handleGenerateLink} disabled={!canSubmit || isCreating} className="h-10 rounded-lg bg-[#951d2c] px-5 text-xs font-bold text-white hover:bg-[#751322] disabled:cursor-not-allowed disabled:opacity-50">{isCreating ? "Creating..." : "Generate Link"}</button></div>
          </div>
        </div>
      )}
      {linkSuccess && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-[#18252b]/35 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="affiliate-created-title">
          <div className="w-full max-w-[420px] rounded-2xl bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.24)]">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#e8f8ef] text-2xl font-bold text-[#16845a]" aria-hidden="true">✓</div>
            <h2 id="affiliate-created-title" className="mt-4 text-center text-base font-bold text-[#27313b]">Affiliate link created</h2>
            <p className="mt-1 text-center text-sm text-[#7d8790]">Your referral link is ready to use.</p>
            <div className="mt-5 flex min-w-0 items-center gap-3 rounded-lg border border-[#e1e5e8] bg-[#fafbfc] px-3 py-2">
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-[#46515b]">{linkSuccess}</span>
              <button type="button" onClick={() => void handleCopy(linkSuccess)} className="shrink-0 text-xs font-semibold text-[#941c2d] hover:text-[#751322]">{copiedCode === linkSuccess ? "Copied" : "Copy"}</button>
            </div>
            <button type="button" onClick={() => setLinkSuccess("")} className="mt-5 h-10 w-full rounded-lg bg-[#951d2c] text-xs font-bold text-white hover:bg-[#751322]">Done</button>
          </div>
        </div>
      )}
    </main>
  );
}
