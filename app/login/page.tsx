"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeName, readAccounts, sessionStorageKey } from "../auth/accessControl";

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const signIn = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    const account = readAccounts().find((user) => normalizeName(user.name) === normalizeName(name) && user.password === password);
    if (!account) {
      setError("That name or password is not valid.");
      setLoading(false);
      return;
    }

    localStorage.setItem(sessionStorageKey, JSON.stringify({ id: account.id, name: account.name }));
    localStorage.setItem("token", `mock_token_${account.id}_${Date.now()}`);
    router.push("/");
  };

  return (
    <main className="min-h-screen bg-white lg:grid lg:grid-cols-2">
      <section className="flex min-h-[38vh] items-center justify-center bg-[#951d43] px-8 py-12 text-white lg:min-h-screen lg:px-16">
        <div className="w-full max-w-md">
          <div className="mx-auto mb-8 grid h-20 w-20 place-items-center rounded-3xl border border-white/20 bg-white/10 text-4xl lg:mx-0">▣</div>
          <h1 className="font-serif text-5xl font-bold tracking-tight">Hulubeje</h1>
          <p className="mt-3 text-sm font-semibold tracking-[0.22em] text-white/70 uppercase">Tip management system</p>
          <div className="mt-12 space-y-5 text-sm text-white/90">
            {["Waiter tip management", "QR-based payments", "Branch-level control"].map((item) => <p key={item} className="flex items-center gap-3"><span className="grid h-5 w-5 place-items-center rounded-full bg-white/20 text-xs">✓</span>{item}</p>)}
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-14 md:px-16">
        <form onSubmit={signIn} className="w-full max-w-md">
          <h2 className="font-serif text-3xl font-bold text-[#171614]">Welcome back</h2>
          <p className="mt-2 text-sm text-[#766d65]">Sign in to your Hulubeje account</p>
          <label htmlFor="name" className="mt-9 block text-sm font-semibold text-[#3f3b37]">Name</label>
          <input id="name" autoComplete="username" value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter your name" className="mt-2 h-12 w-full rounded-xl border border-[#d8cec7] px-4 text-sm outline-none focus:border-[#951d43] focus:ring-2 focus:ring-[#f4d9d4]" />
          <label htmlFor="password" className="mt-5 block text-sm font-semibold text-[#3f3b37]">Password</label>
          <div className="relative mt-2">
            <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className="h-12 w-full rounded-xl border border-[#d8cec7] px-4 pr-12 text-sm outline-none focus:border-[#951d43] focus:ring-2 focus:ring-[#f4d9d4]" />
            <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#8a8179]" aria-label="Toggle password visibility">{showPassword ? "Hide" : "Show"}</button>
          </div>
          {error && <p className="mt-3 text-sm text-[#b42318]" role="alert">{error}</p>}
          <button type="submit" disabled={loading || !name || !password} className="mt-7 h-12 w-full rounded-xl bg-[#951d43] text-sm font-semibold text-white transition-colors hover:bg-[#7d1838] disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Signing in..." : "Sign In"}</button>
        </form>
      </section>
    </main>
  );
}
