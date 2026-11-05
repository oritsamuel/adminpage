export type AdminRole = "Super Admin" | "Admin" | "Viewer" | "Editor";
export type AppPageId = "ugc" | "waiterManagement" | "eventManagement" | "hbWebsite";

export type AdminAccount = {
    id: string;
    name: string;
    password: string;
    role: AdminRole;
    pages: AppPageId[];
    mustChangePassword?: boolean;
};

export const accountStorageKey = "adminAccounts";
export const sessionStorageKey = "user";
export const defaultFirstLoginPassword = "admin123";

export const appPages: { id: AppPageId; label: string }[] = [
    { id: "ugc", label: "HB UGC" },
    { id: "waiterManagement", label: "Waiter Management" },
    { id: "eventManagement", label: "Event Dashboard" },
    { id: "hbWebsite", label: "HB Website" },
];

export const accountRoles: AdminRole[] = ["Super Admin", "Admin", "Viewer", "Editor"];
export const assignableRoles: AdminRole[] = ["Admin", "Viewer", "Editor"];

const defaultAccounts: AdminAccount[] = [
    {
        id: "super-admin",
        name: "Super Admin",
        password: defaultFirstLoginPassword,
        role: "Super Admin",
        pages: [],
        mustChangePassword: true,
    },
    {
        id: "demo-staff",
        name: "Admin ",
        password: defaultFirstLoginPassword,
        role: "Admin",
        pages: ["ugc"],
        mustChangePassword: false,
    },
];

const validRoles = new Set<AdminRole>(accountRoles);
const validPages = new Set<AppPageId>(appPages.map((page) => page.id));

function isAdminAccount(value: unknown): value is AdminAccount {
    if (!value || typeof value !== "object") return false;
    const account = value as Partial<AdminAccount>;
    return typeof account.id === "string"
        && typeof account.name === "string"
        && typeof account.password === "string"
        && (account.mustChangePassword === undefined || typeof account.mustChangePassword === "boolean")
        && validRoles.has(account.role as AdminRole)
        && Array.isArray(account.pages)
        && account.pages.every((page) => validPages.has(page));
}

export function normalizeName(name: string) {
    return name.trim().toLocaleLowerCase();
}

function normalizeStoredAccount(account: AdminAccount): AdminAccount {
    const mustChangePassword = account.mustChangePassword ?? true;
    return {
        id: account.id,
        name: account.name,
        password: mustChangePassword ? defaultFirstLoginPassword : account.password,
        role: account.role,
        pages: [...account.pages],
        mustChangePassword,
    };
}

export function readAccounts(): AdminAccount[] {
    if (typeof window === "undefined") return defaultAccounts.map((account) => ({ ...account, pages: [...account.pages] }));

    try {
        const stored = localStorage.getItem(accountStorageKey);
        if (stored !== null) {
            const parsed: unknown = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.every(isAdminAccount)) return parsed.map(normalizeStoredAccount);
            localStorage.removeItem(accountStorageKey);
        }

        const legacySettings = localStorage.getItem("adminRoleSettings");
        if (legacySettings) {
            const parsed = JSON.parse(legacySettings) as { members?: Array<{ id?: string; role?: string }> };
            const legacyMembers = Array.isArray(parsed.members) ? parsed.members : [];
            return defaultAccounts.map((account) => {
                if (account.role === "Super Admin") return { ...account, pages: [...account.pages] };
                const oldRole = legacyMembers.find((member) => member.id === account.id)?.role;
                return {
                    ...account,
                    role: accountRoles.includes(oldRole as AdminRole) && oldRole !== "Super Admin" ? oldRole as AdminRole : account.role,
                    pages: [...account.pages],
                };
            });
        }
    } catch {
        localStorage.removeItem(accountStorageKey);
    }

    return defaultAccounts.map((account) => ({ ...account, pages: [...account.pages] }));
}

export function writeAccounts(accounts: AdminAccount[]) {
    localStorage.setItem(accountStorageKey, JSON.stringify(accounts));
}

export function pageForPath(pathname: string): AppPageId | null {
    if (pathname.startsWith("/UGC")) return "ugc";
    if (pathname.startsWith("/waiterManagement")) return "waiterManagement";
    if (pathname.startsWith("/eventManagement")) return "eventManagement";
    if (pathname.startsWith("/HBWebsite")) return "hbWebsite";
    return null;
}

export function canAccessPath(account: AdminAccount, pathname: string) {
    if (pathname === "/" || pathname === "/Settings") return true;
    if (account.role === "Super Admin" || account.role === "Admin") return true;
    const page = pageForPath(pathname);
    return page !== null && account.pages.includes(page);
}