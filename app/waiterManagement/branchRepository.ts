export type BranchRecord = {
  companyId?: number;
  restaurantId: string;
  name: string;
  branchId: string;
  branch: string;
  token: string;
  tippingUrl: string;
  logo?: string;
  admins: number;
  waiters: number;
  status: "Active" | "Inactive";
  phone: string;
  adminList: string[];
};

type BranchDraft = {
  companyName: string;
  branchName: string;
  logo?: string;
};

const STORAGE_KEY = "waiterManagementMerchants";
const TIPPING_APP_URL = (
  process.env.WAITER_APP_URL
  ?? process.env.NEXT_PUBLIC_WAITER_APP_URL
  ?? process.env.NEXT_PUBLIC_TIP_FRONTEND_URL
  ?? "https://waiters-tip.vercel.app/"
).replace(/\/$/, "");

function buildTippingUrl(companyId: number | string, branchId: number | string) {
  const safeCompanyId = String(companyId ?? "").trim();
  const safeBranchId = String(branchId ?? "").trim();
  if (!safeCompanyId || !safeBranchId || safeCompanyId === "0" || safeBranchId === "0") {
    return "";
  }

  const url = new URL("/tip", TIPPING_APP_URL);
  url.searchParams.set("companyId", safeCompanyId);
  url.searchParams.set("branchId", safeBranchId);
  return url.toString();
}

function normalizeStoredBranches(value: unknown): BranchRecord[] {
  if (!Array.isArray(value)) return [];

  const existingBranchIds = new Set<string>();
  const restaurantIds = new Map<string, string>();

  return value.flatMap((item): BranchRecord[] => {
    if (!item || typeof item !== "object") return [];

    const record = item as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    const branch = typeof record.branch === "string" ? record.branch.trim() : "";
    if (!name || !branch) return [];

    const companyIdValue = record.companyId ?? record.merchantId ?? record.company_id ?? record.merchant_id ?? record.id;
    const branchIdValue = record.branchId ?? record.branch_id;

    const companyId = typeof companyIdValue === "number"
      ? companyIdValue
      : typeof companyIdValue === "string" && companyIdValue.trim() !== ""
        ? Number.parseInt(companyIdValue, 10) || 0
        : 0;
    const branchId = typeof branchIdValue === "string" && branchIdValue.trim() !== ""
      ? branchIdValue
      : typeof branchIdValue === "number" && Number.isFinite(branchIdValue)
        ? String(branchIdValue)
        : "";

    if (!companyId || !branchId || companyId === 0 || branchId === "0") return [];

    const restaurantKey = name.toLocaleLowerCase();
    const savedRestaurantId = typeof record.restaurantId === "string" ? record.restaurantId : "";
    const restaurantId = savedRestaurantId || restaurantIds.get(restaurantKey) || String(companyId);
    restaurantIds.set(restaurantKey, restaurantId);

    if (existingBranchIds.has(branchId)) return [];
    existingBranchIds.add(branchId);

    const token = typeof record.token === "string" ? record.token : "";

    const phone = typeof record.phone === "string" ? record.phone : "";
    const adminList = Array.isArray(record.adminList)
      ? record.adminList.filter((admin): admin is string => typeof admin === "string")
      : phone ? [phone] : [];

    return [{
      companyId: companyId || undefined,
      restaurantId,
      name,
      branchId,
      branch,
      token,
      tippingUrl: buildTippingUrl(companyId || restaurantId, branchId),
      logo: typeof record.logo === "string" ? record.logo : undefined,
      admins: adminList.length || (typeof record.admins === "number" ? record.admins : 0),
      waiters: typeof record.waiters === "number" ? record.waiters : 0,
      status: record.status === "Inactive" ? "Inactive" : "Active",
      phone: phone || adminList[0] || "",
      adminList,
    }];
  });
}

export function loadMockBranches(): BranchRecord[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const normalized = normalizeStoredBranches(stored ? JSON.parse(stored) : []);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  } catch {
    return [];
  }
}

export function saveMockBranches(branches: BranchRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(branches));
}

export function createMockBranch(draft: BranchDraft, existingBranches: BranchRecord[]): BranchRecord {
  const name = draft.companyName.trim();
  const branch = draft.branchName.trim();
  const existingRestaurant = existingBranches.find(
    (record) => record.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
  );

  const companyId = existingRestaurant?.companyId;
  const branchId = existingRestaurant?.branchId ?? "";

  return {
    companyId,
    restaurantId: existingRestaurant?.restaurantId ?? "",
    name,
    branchId,
    branch,
    token: "",
    tippingUrl: companyId !== undefined && branchId ? buildTippingUrl(companyId, branchId) : "",
    logo: draft.logo,
    admins: 0,
    waiters: 0,
    status: "Active",
    phone: "",
    adminList: [],
  };
}