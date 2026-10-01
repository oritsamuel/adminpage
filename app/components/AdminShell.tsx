"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { canAccessPath, readAccounts, sessionStorageKey, type AdminAccount } from "../auth/accessControl";

const navigation = [
  { label: "Overview", href: "/", number: "01" },
  { label: "HB UGC", href: "/UGC", number: "02" },
  { label: "Waiter Management", href: "/waiterManagement", number: "03" },
  { label: "Event Dashboard", href: "/eventManagement", number: "04" },
  { label: "HB website", href: "/HBWebsite", number: "05" },
  { label: "Settings", href: "/Settings", number: "06" },

];

type AdminShellProps = {
  children: React.ReactNode;
};

export default function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [ugcOpen, setUgcOpen] = useState(pathname.startsWith("/UGC"));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [account, setAccount] = useState<AdminAccount | null>(null);
  const [checkingSession, setCheckingSession] = useState(pathname !== "/login");
  const compactSidebar = sidebarCollapsed && !mobileNavOpen;
  const activePageTitle = pathname.startsWith("/UGC/orders")
    ? "Orders"
    : pathname.startsWith("/UGC/commission")
      ? "Commission"
      : navigation.find((item) => item.href === "/" ? pathname === "/" : pathname.startsWith(item.href))?.label || "Admin page";

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSidebarCollapsed(localStorage.getItem("adminSidebarCollapsed") === "true");
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((collapsed) => {
      const nextCollapsed = !collapsed;
      localStorage.setItem("adminSidebarCollapsed", String(nextCollapsed));
      return nextCollapsed;
    });
  };

  const closeMobileNav = () => setMobileNavOpen(false);
  const blockViewerMutation = (event: React.SyntheticEvent<HTMLElement>) => {
    if (account?.role !== "Viewer") return;
    const target = event.target;
    if (target instanceof HTMLElement && target.closest("[data-viewer-write]")) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  const blockViewerKeyInput = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab") blockViewerMutation(event);
  };

  useEffect(() => {
    if (pathname === "/login") {
      return;
    }

    const restoreAccount = () => {
      try {
        const session = JSON.parse(localStorage.getItem(sessionStorageKey) || "{}") as { id?: string };
        const activeAccount = readAccounts().find((user) => user.id === session.id);
        if (!activeAccount) {
          localStorage.removeItem(sessionStorageKey);
          router.replace("/login");
          return;
        }
        setAccount(activeAccount);
        setCheckingSession(false);
        if (activeAccount.mustChangePassword && pathname !== "/Settings") {
          router.replace("/Settings");
        } else if (!canAccessPath(activeAccount, pathname)) {
          router.replace("/");
        }
      } catch {
        localStorage.removeItem(sessionStorageKey);
        router.replace("/login");
      }
    };

    const timeoutId = window.setTimeout(restoreAccount, 0);
    window.addEventListener("admin-accounts-updated", restoreAccount);
    window.addEventListener("storage", restoreAccount);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("admin-accounts-updated", restoreAccount);
      window.removeEventListener("storage", restoreAccount);
    };
  }, [pathname, router]);

  if (pathname === "/login") return <>{children}</>;
  if (checkingSession || !account || !canAccessPath(account, pathname)) return null;

  return (
    <div className={`min-h-screen bg-[#f5f7f8] text-[#18252b] ${sidebarCollapsed ? "admin-shell-sidebar-collapsed" : ""}`}>
      <header className="fixed inset-x-0 top-0 z-20 flex h-[76px] items-center border-b border-[#dce4e5] bg-[#fbfcfa]/95 px-4 backdrop-blur sm:px-6 md:px-8">
        <div className={`flex items-center gap-3 transition-[width] duration-200 ${compactSidebar ? "w-[4.5rem]" : "w-60"}`}>
          <button type="button" onClick={() => setMobileNavOpen(true)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[#607071] hover:bg-[#edf2ef] md:hidden" aria-label="Open navigation menu" aria-expanded={mobileNavOpen}>
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <Image src="/logo.png" alt="Company logo" width={130} height={40} priority className="h-auto w-[104px] sm:w-auto" />
        </div>
        <h1 className="absolute left-1/2 hidden -translate-x-1/2 text-lg font-semibold tracking-[-0.02em] text-[#183c3d] sm:block md:text-xl">
          {activePageTitle}
        </h1>
        <div className="ml-auto flex items-center gap-4">
          <span className="hidden text-right sm:block">
            <span className="block text-xs font-semibold text-[#183c3d]">{account.name}</span>
            <span className="block text-[11px] text-[#738184]">{account.role}</span>
          </span>
          <div className="grid h-10 w-10 place-items-center rounded-full bg-[#e1a36f] text-sm font-bold text-[#183c3d]">{account.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</div>
          <button type="button" onClick={() => { localStorage.removeItem(sessionStorageKey); localStorage.removeItem("token"); router.replace("/login"); }} className="rounded-md px-3 py-2 text-xs font-semibold text-[#607071] transition-colors hover:bg-[#edf2ef] hover:text-[#183c3d]">Sign out</button>
        </div>
      </header>

      {mobileNavOpen && <button type="button" onClick={closeMobileNav} className="admin-mobile-backdrop" aria-label="Dismiss navigation backdrop" />}
      <aside className={`admin-sidebar fixed bottom-0 left-0 top-[76px] z-10 block border-r border-[#dce4e5] bg-[#edf2ef] py-5 transition-[width] duration-200 ${compactSidebar ? "w-[4.5rem] px-2" : "w-60 px-4"} ${mobileNavOpen ? "admin-sidebar-open" : ""}`}>
        <nav aria-label="Main navigation" className="flex h-full flex-col">
          {mobileNavOpen ? <button type="button" onClick={closeMobileNav} className="mb-5 grid h-9 w-9 place-items-center rounded-lg text-[#607071] hover:bg-white md:hidden" aria-label="Close navigation menu">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m18 6-12 12M6 6l12 12" /></svg>
          </button> : <button
            type="button"
            onClick={toggleSidebar}
            aria-label={`${sidebarCollapsed ? "Expand" : "Collapse"} sidebar`}
            aria-expanded={!sidebarCollapsed}
            title={`${sidebarCollapsed ? "Expand" : "Collapse"} sidebar`}
            className={`sidebar-collapse-button mb-5 grid h-9 w-9 place-items-center rounded-lg text-[#607071] transition-colors hover:bg-white hover:text-[#183c3d] ${sidebarCollapsed ? "mx-auto" : "ml-auto"}`}
          >
            <svg className={`h-4 w-4 transition-transform ${sidebarCollapsed ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
              <path d="M19 12H9" />
            </svg>
          </button>}
          <div>
            {!compactSidebar && <p className="mb-3 px-3 text-[10px] font-bold tracking-[0.2em] text-[#8a9695] uppercase">Workspace</p>}
            <div className="space-y-1">
              {navigation.filter((item) => canAccessPath(account, item.href)).map((item) => {
                const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                const className = `flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors ${
                  isActive
                    ? "bg-[#183c3d] font-semibold text-white shadow-[0_6px_14px_rgba(24,60,61,0.14)]"
                    : "font-medium text-[#607071] hover:bg-white hover:text-[#183c3d]"
                }`;
                const numberClassName = `grid h-6 w-6 place-items-center rounded-md text-[10px] font-bold ${
                  isActive ? "bg-[#d8f36c] text-[#183c3d]" : "bg-white text-[#70807f]"
                }`;

                if (item.href === "/UGC") {
                  return (
                    <div key={item.label}>
                      <div className="flex items-center gap-1">
                        <Link href={item.href} onClick={() => { setUgcOpen(true); closeMobileNav(); }} className={`${className} ${compactSidebar ? "justify-center" : "flex-1"}`} title={compactSidebar ? item.label : undefined}>
                          <span className={numberClassName}>{item.number}</span>
                          {!compactSidebar && item.label}
                        </Link>
                        {!compactSidebar && <button type="button" onClick={() => setUgcOpen((open) => !open)} className="grid h-11 w-8 place-items-center rounded-xl text-[#607071] hover:bg-white hover:text-[#183c3d]" aria-label={`${ugcOpen ? "Collapse" : "Expand"} UGC menu`}>
                          <span className={`text-xs transition-transform ${ugcOpen ? "rotate-180" : ""}`}>⌄</span>
                        </button>}
                      </div>
                      {ugcOpen && !compactSidebar && (
                        <div className="ml-9 mt-1 space-y-1 border-l border-[#cbd8d4] pl-3">
                          <Link href="/UGC/orders" onClick={() => { setUgcOpen(true); closeMobileNav(); }} className={`block rounded-lg px-3 py-2 text-xs transition-colors ${pathname.startsWith("/UGC/orders") ? "bg-[#183c3d] font-semibold text-white shadow-[0_4px_10px_rgba(24,60,61,0.12)]" : "text-[#607071] hover:bg-white hover:text-[#183c3d]"}`}>Orders</Link>
                          <Link href="/UGC/commission" onClick={() => { setUgcOpen(true); closeMobileNav(); }} className={`block rounded-lg px-3 py-2 text-xs transition-colors ${pathname.startsWith("/UGC/commission") ? "bg-[#183c3d] font-semibold text-white shadow-[0_4px_10px_rgba(24,60,61,0.12)]" : "text-[#607071] hover:bg-white hover:text-[#183c3d]"}`}>Commission</Link>
                        </div>
                      )}
                    </div>
                  );
                }

                return item.href.startsWith("#") ? (
                    <a key={item.label} href={item.href} onClick={closeMobileNav} className={`${className} ${compactSidebar ? "justify-center px-1" : ""}`} title={compactSidebar ? item.label : undefined}>
                    <span className={numberClassName}>{item.number}</span>
                    {!compactSidebar && item.label}
                  </a>
                ) : (
                  <Link key={item.label} href={item.href} onClick={closeMobileNav} className={`${className} ${compactSidebar ? "justify-center px-1" : ""}`} title={compactSidebar ? item.label : undefined}>
                    <span className={numberClassName}>{item.number}</span>
                    {!compactSidebar && item.label}
                  </Link>
                );
              })}
            </div>
          </div>
          {!compactSidebar && <div className="mt-auto rounded-2xl p-4">
            <Image src="/logo2.png" alt="Company logo" width={130} height={50} className="h-auto w-auto" />
          </div>}
        </nav>
      </aside>

      <div
        data-viewer-mode={account.role === "Viewer"}
        onClickCapture={blockViewerMutation}
        onChangeCapture={blockViewerMutation}
        onSubmitCapture={blockViewerMutation}
        onKeyDownCapture={blockViewerKeyInput}
        onBeforeInputCapture={blockViewerMutation}
      >
        {children}
      </div>
    </div>
  );
}
