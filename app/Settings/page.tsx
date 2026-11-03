"use client";

import { useEffect, useState } from "react";
import {
    appPages,
    assignableRoles,
    defaultFirstLoginPassword,
    normalizeName,
    readAccounts,
    sessionStorageKey,
    writeAccounts,
    type AdminAccount,
    type AdminRole,
    type AppPageId,
} from "../auth/accessControl";

const inputClassName = "h-10 w-full rounded-md border border-[#dce4e5] bg-white px-3 text-sm outline-none focus:border-[#347b56]";
export default function SettingsPage() {
    const [accounts, setAccounts] = useState<AdminAccount[]>([]);
    const [currentUserId, setCurrentUserId] = useState("");
    const [isReady, setIsReady] = useState(false);
    const [name, setName] = useState("");
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [pendingRemovalId, setPendingRemovalId] = useState("");
    const [accountError, setAccountError] = useState("");
    const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirm: "" });
    const [passwordMessage, setPasswordMessage] = useState("");
    const [passwordError, setPasswordError] = useState("");

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            setAccounts(readAccounts());
            try {
                const session = JSON.parse(localStorage.getItem(sessionStorageKey) || "{}") as { id?: string };
                setCurrentUserId(session.id || "");
            } catch {
                localStorage.removeItem(sessionStorageKey);
            }
            setIsReady(true);
        }, 0);
        return () => window.clearTimeout(timeoutId);
    }, []);

    const currentAccount = accounts.find((account) => account.id === currentUserId);
    const isSuperAdmin = currentAccount?.role === "Super Admin";
    const canManageAccess = isSuperAdmin || currentAccount?.role === "Admin";

    const addAccount = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const normalizedName = normalizeName(name);
        if (!normalizedName) {
            setAccountError("Enter a name for the new user.");
            return;
        }
        if (accounts.some((account) => normalizeName(account.name) === normalizedName)) {
            setAccountError("A user with this name already exists.");
            return;
        }

        const deterministicId = normalizeName(name).replace(/\s+/g, "-");
        setAccounts((existing) => [...existing, {
            id: deterministicId,
            name: name.trim(),
            password: defaultFirstLoginPassword,
            role: "Viewer",
            pages: [],
            mustChangePassword: true,
        }]);
        setName("");
        setHasUnsavedChanges(true);
        setAccountError("");
    };

    const updateRole = (id: string, role: AdminRole) => {
        if (!isSuperAdmin || !assignableRoles.includes(role)) return;
        setAccounts((existing) => existing.map((account) => account.id === id ? { ...account, role } : account));
        setHasUnsavedChanges(true);
    };

    const togglePage = (id: string, page: AppPageId, checked: boolean) => {
        if (!canManageAccess) return;
        setAccounts((existing) => existing.map((account) => {
            if (account.id !== id || account.role === "Super Admin" || account.role === "Admin") return account;
            const pages = checked
                ? [...new Set([...account.pages, page])]
                : account.pages.filter((allowedPage) => allowedPage !== page);
            return { ...account, pages };
        }));
        setHasUnsavedChanges(true);
    };

    const removeAccount = (id: string) => {
        if (!isSuperAdmin || id === currentUserId) return;
        if (pendingRemovalId !== id) {
            setPendingRemovalId(id);
            return;
        }
        setAccounts((existing) => existing.filter((item) => item.id !== id));
        setHasUnsavedChanges(true);
        setPendingRemovalId("");
    };

    const saveChanges = () => {
        writeAccounts(accounts);
        setHasUnsavedChanges(false);
        window.dispatchEvent(new Event("admin-accounts-updated"));
    };

    const changePassword = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setPasswordError("");
        setPasswordMessage("");
        if (!currentAccount || currentAccount.password !== passwordForm.current) {
            setPasswordError("Your current password is incorrect.");
            return;
        }
        if (passwordForm.next.length < 8) {
            setPasswordError("Use at least 8 characters for your new password.");
            return;
        }
        if (passwordForm.next !== passwordForm.confirm) {
            setPasswordError("The new passwords do not match.");
            return;
        }

        setAccounts((existing) => existing.map((account) => account.id === currentUserId
            ? { ...account, password: passwordForm.next, mustChangePassword: false }
            : account));
        setHasUnsavedChanges(true);
        setPasswordForm({ current: "", next: "", confirm: "" });
        setPasswordMessage("Password updated in the form. Save changes to apply it.");
    };

    return (
        <main className="ml-60 min-h-screen bg-[#f5f7f8] px-4 pb-12 pt-[100px] text-[#18252b] sm:px-6 lg:px-10">
            <div className="mx-auto max-w-[1400px]">
                <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-[#dce4e5] pb-5">
                    <div>
                        <p className="mb-2 text-[10px] font-bold uppercase text-[#b26543]">Workspace access</p>
                        <h2 className="text-2xl font-semibold text-[#183c3d]">People &amp; permissions</h2>
                        <p className="mt-1 text-sm text-[#738184]">Manage sign-in accounts and the pages each person can use.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {currentAccount && <span className="rounded-md border border-[#dce4e5] bg-white px-3 py-2 text-xs font-semibold text-[#607071]">{currentAccount.role}</span>}
                        {hasUnsavedChanges && <span className="text-xs font-medium text-[#b26543]">Unsaved changes</span>}
                        <button type="button" onClick={saveChanges} disabled={!isReady || !hasUnsavedChanges} className="h-10 rounded-md bg-[#183c3d] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#255353] disabled:cursor-not-allowed disabled:opacity-40">Save changes</button>
                    </div>
                </header>

                {currentAccount?.mustChangePassword && <p className="mb-6 border-l-2 border-[#e0784f] bg-[#fff7ed] px-4 py-3 text-sm text-[#704524]" role="alert">You are using the shared first-login password. Change it and save before entering the workspace.</p>}

                <section aria-labelledby="password-title" className="mb-10 border-b border-[#dce4e5] pb-8">
                    <div className="mb-4">
                        <h3 id="password-title" className="text-base font-semibold text-[#183c3d]">Change your password</h3>
                        <p className="mt-1 text-xs text-[#738184]">Update the password for {currentAccount?.name || "your account"}.</p>
                    </div>
                    <form onSubmit={changePassword} className="grid max-w-4xl gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto] xl:items-end">
                        <label className="flex flex-col gap-2 text-xs font-semibold text-[#607071]">Current password
                            <input required type="password" autoComplete="current-password" value={passwordForm.current} onChange={(event) => setPasswordForm({ ...passwordForm, current: event.target.value })} className={inputClassName} />
                        </label>
                        <label className="flex flex-col gap-2 text-xs font-semibold text-[#607071]">New password
                            <input required minLength={8} type="password" autoComplete="new-password" value={passwordForm.next} onChange={(event) => setPasswordForm({ ...passwordForm, next: event.target.value })} className={inputClassName} />
                        </label>
                        <label className="flex flex-col gap-2 text-xs font-semibold text-[#607071]">Confirm new password
                            <input required minLength={8} type="password" autoComplete="new-password" value={passwordForm.confirm} onChange={(event) => setPasswordForm({ ...passwordForm, confirm: event.target.value })} className={inputClassName} />
                        </label>
                        <button type="submit" disabled={!isReady || !currentAccount} className="h-10 rounded-md bg-[#183c3d] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#255353] disabled:opacity-50">Update password</button>
                        {passwordError && <p className="text-xs text-[#a83242] sm:col-span-2 xl:col-span-4" role="alert">{passwordError}</p>}
                        {passwordMessage && <p className="text-xs font-medium text-[#347b56] sm:col-span-2 xl:col-span-4" role="status">{passwordMessage}</p>}
                    </form>
                </section>

                {canManageAccess && <section aria-labelledby="users-title">
                    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <h3 id="users-title" className="text-base font-semibold text-[#183c3d]">User access</h3>
                            <p className="mt-1 text-xs text-[#738184]">Overview and Settings are available to everyone. Admins have access to every page.</p>
                        </div>
                        <span className="text-xs font-semibold text-[#607071]">{accounts.length} accounts</span>
                    </div>

                    {isSuperAdmin && <form onSubmit={addAccount} className="mb-6 border border-[#dce4e5] bg-white p-4">
                        <div className="mb-4">
                            <h4 className="text-sm font-semibold text-[#183c3d]">Register a user</h4>
                            <p className="mt-1 text-xs text-[#738184]">New users start as Viewers. Their first sign-in password is <code className="font-mono font-semibold">{defaultFirstLoginPassword}</code>; they must change it before entering the workspace.</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_auto] xl:items-end">
                            <label className="flex flex-col gap-2 text-xs font-semibold text-[#607071]">Name
                                <input required value={name} onChange={(event) => setName(event.target.value)} className={inputClassName} />
                            </label>
                            <button type="submit" className="h-10 rounded-md bg-[#183c3d] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#255353]">Add user</button>
                            {accountError && <p className="text-xs text-[#a83242] sm:col-span-2 xl:col-span-2" role="alert">{accountError}</p>}
                        </div>
                    </form>}

                    <div className="divide-y divide-[#dce4e5] border-y border-[#dce4e5]">
                        {!isReady ? <p className="py-8 text-center text-sm text-[#738184]">Loading accounts...</p> : accounts.map((account) => {
                            const isSelf = account.id === currentUserId;
                            const canEditRole = isSuperAdmin && !isSelf && account.role !== "Super Admin";
                            const canEditPages = canManageAccess && account.role !== "Super Admin" && account.role !== "Admin";
                            const hasAllPages = account.role === "Super Admin" || account.role === "Admin";
                            return (
                                <article key={account.id} className="grid gap-4 py-5 lg:grid-cols-[minmax(180px,0.8fr)_minmax(140px,0.55fr)_minmax(0,2fr)_auto] lg:items-start">
                                    <div className="min-w-0">
                                        <h4 className="truncate text-sm font-semibold text-[#183c3d]">{account.name}{isSelf ? <span className="ml-2 text-[10px] font-medium text-[#8a9695]">You</span> : null}</h4>
                                        {account.mustChangePassword && <p className="mt-1 text-xs font-medium text-[#b26543]">Must change password at first sign-in</p>}
                                    </div>
                                    <div>
                                        {canEditRole ? <label className="flex flex-col gap-2 text-[10px] font-bold uppercase text-[#8a9695]">Role
                                            <select value={account.role} onChange={(event) => updateRole(account.id, event.target.value as AdminRole)} className={`${inputClassName} font-medium normal-case text-[#263c3c]`} aria-label={`Role for ${account.name}`}>
                                                {assignableRoles.map((role) => <option key={role} value={role}>{role}</option>)}
                                            </select>
                                        </label> : <><p className="mb-2 text-[10px] font-bold uppercase text-[#8a9695]">Role</p><span className="inline-flex min-h-10 items-center text-sm font-semibold text-[#263c3c]">{account.role}</span></>}
                                    </div>
                                    <div>
                                        <p className="mb-2 text-[10px] font-bold uppercase text-[#8a9695]">Page access</p>
                                        {hasAllPages ? <p className="text-sm font-medium text-[#347b56]">All pages, including Overview and Settings</p> : <>
                                            <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2 xl:grid-cols-4">
                                                {appPages.map((page) => <label key={page.id} className={`flex items-center gap-2 text-xs ${canEditPages ? "cursor-pointer text-[#405658]" : "text-[#738184]"}`}>
                                                    <input type="checkbox" checked={account.pages.includes(page.id)} disabled={!canEditPages} onChange={(event) => togglePage(account.id, page.id, event.target.checked)} className="h-4 w-4 accent-[#347b56]" />
                                                    {page.label}
                                                </label>)}
                                            </div>
                                            {account.pages.length === 0 && <p className="mt-2 text-[11px] text-[#8a9695]">Overview and Settings only</p>}
                                        </>}
                                    </div>
                                    <div className="flex items-start justify-end">
                                        {isSuperAdmin && !isSelf && (pendingRemovalId === account.id ? <div className="flex items-center gap-2" role="group" aria-label={`Confirm removal of ${account.name}`}>
                                            <span className="text-xs text-[#9b263c]">Remove user?</span>
                                            <button type="button" onClick={() => removeAccount(account.id)} className="h-9 rounded-md bg-[#9b263c] px-3 text-xs font-semibold text-white hover:bg-[#7d1e32]">Confirm</button>
                                            <button type="button" onClick={() => setPendingRemovalId("")} className="h-9 rounded-md border border-[#dce4e5] px-3 text-xs font-semibold text-[#607071] hover:bg-[#f5f7f8]">Cancel</button>
                                        </div> : <button type="button" onClick={() => removeAccount(account.id)} className="h-9 rounded-md border border-[#e4c5c8] px-3 text-xs font-semibold text-[#9b263c] transition-colors hover:bg-[#fff1f2]" aria-label={`Remove ${account.name}`}>Remove user</button>)}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                    <p className="mt-4 text-[11px] text-[#8a9695]">Prototype accounts and passwords are stored in this browser. Use server-backed authentication and authorization before production.</p>
                </section>}
            </div>
        </main>
    );
}
