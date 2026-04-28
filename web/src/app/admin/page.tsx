"use client";

import { useEffect, useMemo, useState } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { useAuth } from "@/components/AuthProvider";
import { getRoleClaim } from "@/lib/claims";

export default function AdminPage() {
  // Avoid initializing Firebase during server prerender/build.
  const firebaseAuth = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      return getFirebaseAuth();
    } catch {
      return null;
    }
  }, []);
  const router = useRouter();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (!firebaseAuth) {
      setError("Site is missing Firebase config. Ask admin to set NEXT_PUBLIC_FIREBASE_* in Vercel.");
      return;
    }
    if (loading) return;
    if (!user) return;

    setChecking(true);
    getRoleClaim(user, true)
      .then((role) => {
        const ok = role === "admin";
        setAuthorized(ok);
        if (ok) router.replace("/admin/dashboard");
      })
      .finally(() => setChecking(false));
  }, [loading, router, user]);

  async function login() {
    if (!firebaseAuth) {
      setError("Site is missing Firebase config. Ask admin to set NEXT_PUBLIC_FIREBASE_* in Vercel.");
      return;
    }
    setError(null);
    setMessage(null);
    setChecking(true);
    setAuthorized(false);
    try {
      const cred = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      const role = await getRoleClaim(cred.user, true);
      if (role !== "admin") {
        await signOut(firebaseAuth);
        setError("This account is not authorised as admin.");
        return;
      }
      setAuthorized(true);
      setMessage("Admin login successful.");
      router.replace("/admin/dashboard");
    } catch (e: any) {
      setError(e?.message ?? "Login failed.");
    } finally {
      setChecking(false);
    }
  }

  async function logout() {
    if (!firebaseAuth) return;
    await signOut(firebaseAuth);
    setAuthorized(false);
    setMessage("Signed out.");
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-[#FFF7ED] px-6 py-24 text-[#1C1917]">
      <main className="w-full max-w-lg rounded-2xl bg-white p-10 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="mt-2 text-sm text-stone-600">
          Email + password login. Requires custom claim <code>role=admin</code>.
        </p>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="mt-6 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
            {message}
          </div>
        ) : null}

        {authorized ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm">
              You are signed in as <b>Admin</b>.
            </div>
            <button
              className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-stone-200 bg-white px-5 text-sm font-semibold text-stone-900 hover:bg-stone-50"
              onClick={logout}
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium">Email</label>
              <input
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 outline-none focus:border-[#F97316]"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Password</label>
              <input
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 outline-none focus:border-[#F97316]"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
              />
            </div>
            <button
              className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#F97316] px-5 text-sm font-semibold text-white hover:bg-[#EA580C] disabled:opacity-60"
              onClick={login}
              disabled={checking}
            >
              {checking ? "Checking..." : "Sign in"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

