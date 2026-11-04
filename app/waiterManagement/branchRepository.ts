export type AdminListItem = {
  id?: number;
  name: string;
  phone: string;
  status: "Active" | "Terminated";
};

export type AdminStatusMap = Record<string, "Active" | "Terminated">;

export type BranchRecord = {
  companyId?: number;
  companyCode?: number;
  restaurantId: string;
  name: string;
  branchId: string;
  branchCode?: number;
  branch: string;
  token: string;
  tippingUrl: string;
  logo?: string;
  admins: number;
  waiters: number;
  status: "Active" | "Inactive";
  phone: string;
  adminList: AdminListItem[];
};

export function buildTippingUrl(companyId: number | string, branchId: number | string) {
  const safeCompanyId = String(companyId ?? "").trim();
  const safeBranchId = String(branchId ?? "").trim();
  if (!safeCompanyId || !safeBranchId || safeCompanyId === "0" || safeBranchId === "0") {
    return "";
  }

  const configuredBaseUrl = (
    process.env.NEXT_PUBLIC_TIP_FRONTEND_URL
    ?? process.env.WAITER_APP_URL
    ?? process.env.NEXT_PUBLIC_WAITER_APP_URL
  )?.trim();

  const baseUrl = configuredBaseUrl ?? (
    typeof window !== "undefined"
      ? window.location.origin
      : "https://waiters-tip.vercel.app"
  );

  const url = new URL(baseUrl);
  url.pathname = "/tip";
  url.search = "";
  url.hash = "";
  url.searchParams.set("companyId", safeCompanyId);
  url.searchParams.set("branchId", safeBranchId);
  return url.toString();
}
