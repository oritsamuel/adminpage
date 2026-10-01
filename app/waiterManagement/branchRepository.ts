export type BranchRecord = {
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
const TIPPING_APP_URL = "https://waiter-tip.hulubeje.com";
const TOKEN_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function createToken(existingTokens: Set<string>) {
  let token = "";

  do {
    const randomValues = crypto.getRandomValues(new Uint8Array(8));
    token = Array.from(randomValues, (value) => TOKEN_ALPHABET[value % TOKEN_ALPHABET.length]).join("");
  } while (existingTokens.has(token));

  existingTokens.add(token);
  return token;
}

function createTippingUrl(token: string) {
  return `${TIPPING_APP_URL}/r/${encodeURIComponent(token)}`;
}

function normalizeStoredBranches(value: unknown): BranchRecord[] {
  if (!Array.isArray(value)) return [];

  const existingTokens = new Set<string>();
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

    const savedToken = typeof record.token === "string" ? record.token : "";
    const token = /^[A-Z0-9]{8}$/.test(savedToken) && !existingTokens.has(savedToken)
      ? savedToken
      : createToken(existingTokens);
    existingTokens.add(token);

    const phone = typeof record.phone === "string" ? record.phone : "";
    const adminList = Array.isArray(record.adminList)
      ? record.adminList.filter((admin): admin is string => typeof admin === "string")
      : phone ? [phone] : [];

    return [{
      restaurantId,
      name,
      branchId,
      branch,
      token,
      tippingUrl: createTippingUrl(token),
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
  const token = createToken(new Set(existingBranches.map((record) => record.token)));

  return {
    restaurantId: existingRestaurant?.restaurantId ?? crypto.randomUUID(),
    name,
    branchId: crypto.randomUUID(),
    branch,
    token,
    tippingUrl: createTippingUrl(token),
    logo: draft.logo,
    admins: 0,
    waiters: 0,
    status: "Active",
    phone: "",
    adminList: [],
  };
}