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
  ?? "https://waiter-tip.hulubeje.com"
).replace(/\/$/, "");

function buildTippingUrl(companyId: number | string, branchId: number | string) {
  const url = new URL("/tip", TIPPING_APP_URL);
  url.searchParams.set("companyId", String(companyId));
  url.searchParams.set("branchId", String(branchId));
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

    const restaurantKey = name.toLocaleLowerCase();
    const savedRestaurantId = typeof record.restaurantId === "string" ? record.restaurantId : "";
    const restaurantId = savedRestaurantId || restaurantIds.get(restaurantKey) || crypto.randomUUID();
    restaurantIds.set(restaurantKey, restaurantId);

    const savedBranchId = typeof record.branchId === "string" ? record.branchId : "";
    const branchId = savedBranchId && !existingBranchIds.has(savedBranchId) ? savedBranchId : crypto.randomUUID();
    existingBranchIds.add(branchId);

    const companyId = typeof record.companyId === "number"
      ? record.companyId
      : typeof record.companyId === "string" && record.companyId.trim() !== ""
        ? Number.parseInt(record.companyId, 10) || 0
        : Number.parseInt(branchId, 10) || 0;
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
  const nextCompanyId = Math.max(
    0,
    ...existingBranches.map((record) => (typeof record.companyId === "number" ? record.companyId : 0)),
  ) + 1;

  return {
    companyId: nextCompanyId,
    restaurantId: existingRestaurant?.restaurantId ?? String(nextCompanyId),
    name,
    branchId: String(nextCompanyId),
    branch,
    token: "",
    tippingUrl: buildTippingUrl(nextCompanyId, nextCompanyId),
    logo: draft.logo,
    admins: 0,
    waiters: 0,
    status: "Active",
    phone: "",
    adminList: [],
  };
}