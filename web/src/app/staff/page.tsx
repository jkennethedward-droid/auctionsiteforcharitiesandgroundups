"use client";

import { useEffect, useMemo, useState } from "react";
import {
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signOut,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { getStaffDomains } from "@/lib/siteConfig";
import { upsertUserProfile } from "@/lib/users";
import { useAuth } from "@/components/AuthProvider";
import { getRoleClaim } from "@/lib/claims";

const EMAIL_STORAGE_KEY = "gwh_staff_email";

function continueUrl(path: string) {
  // Build a fully-qualified URL (required by Firebase email link auth).
  return new URL(path, window.location.href).toString();
}

function emailDomainAllowed(email: string, allowedDomains: string[]) {
  const lower = email.trim().toLowerCase();
  return allowedDomains.some((d) => lower.endsWith(d.toLowerCase()));
}

export default function StaffPage() {
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
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [stage, setStage] = useState<"request" | "finishing" | "profile" | "ready" | "pending">("request");
  const [sendingLink, setSendingLink] = useState(false);
  const [mode, setMode] = useState<"staff" | "admin">("staff");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminBusy, setAdminBusy] = useState(false);

  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) return;

    getRoleClaim(user, true).then((role) => {
      if (role === "staff") router.replace("/staff/uploader");
    });
  }, [loading, router, user]);

  useEffect(() => {
    getStaffDomains()
      .then((d) => setAllowedDomains(d))
      .catch(() => setAllowedDomains([]));
  }, []);

  useEffect(() => {
    const href = window.location.href;
    if (!firebaseAuth) return;
    if (!isSignInWithEmailLink(firebaseAuth, href)) return;

    setStage("finishing");
    const savedEmail = window.localStorage.getItem(EMAIL_STORAGE_KEY) ?? "";
    const emailForLink = savedEmail || window.prompt("Confirm your work email to finish sign-in") || "";

    if (!emailForLink) {
      setError("Email is required to finish sign-in.");
      setStage("request");
      return;
    }

    signInWithEmailLink(firebaseAuth, emailForLink, href)
      .then(async (cred) => {
        window.localStorage.removeItem(EMAIL_STORAGE_KEY);
        setMessage("Signed in. Please complete your staff profile.");
        setStage("profile");

        await upsertUserProfile(cred.user.uid, {
          name: cred.user.displayName ?? "",
          email: cred.user.email ?? emailForLink,
        });
      })
      .catch((e) => {
        setError(e?.message ?? "Failed to finish sign-in.");
        setStage("request");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendStaffLink() {
    if (!firebaseAuth) {
      setError("Site is missing Firebase config. Ask admin to set NEXT_PUBLIC_FIREBASE_* in Vercel.");
      return;
    }
    setError(null);
    setMessage(null);
    setSendingLink(true);

    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError("Enter your work email.");
      setSendingLink(false);
      return;
    }
    if (!emailDomainAllowed(trimmed, allowedDomains)) {
      setError("This email is not authorised for staff access.");
      setSendingLink(false);
      return;
    }

    try {
      const url = continueUrl("/staff");
      await sendSignInLinkToEmail(firebaseAuth, trimmed, { url, handleCodeInApp: true });
      window.localStorage.setItem(EMAIL_STORAGE_KEY, trimmed);
      setMessage("Staff login link sent. Check your inbox.");
    } catch (e: any) {
      setError(e?.message ?? "Failed to send staff login link.");
    } finally {
      setSendingLink(false);
    }
  }

  async function saveStaffProfile() {
    if (!firebaseAuth) {
      setError("Site is missing Firebase config. Ask admin to set NEXT_PUBLIC_FIREBASE_* in Vercel.");
      return;
    }
    setError(null);
    setMessage(null);

    const u = firebaseAuth.currentUser;
    if (!u) {
      setError("You are not signed in.");
      setStage("request");
      return;
    }

    const trimmedName = name.trim();
    const trimmedDept = department.trim();
    if (!trimmedName) return setError("Please enter your name.");
    if (!trimmedDept) return setError("Please enter your department.");

    await upsertUserProfile(u.uid, {
      name: trimmedName,
      email: u.email ?? "",
      department: trimmedDept,
      role: "staff",
    });

    const role = await getRoleClaim(u, true);
    if (role === "staff") {
      setStage("ready");
      setMessage("Approved. You can access the staff uploader.");
      router.replace("/staff/uploader");
      return;
    }

    setStage("pending");
    setMessage("Profile saved. Your account is pending admin approval for staff access.");
  }

  async function doSignOut() {
    if (!firebaseAuth) return;
    await signOut(firebaseAuth);
    setStage("request");
    setEmail("");
    setName("");
    setDepartment("");
    setMessage(null);
    setError(null);
  }

  async function adminLogin() {
    if (!firebaseAuth) {
      setError("Site is missing Firebase config. Ask admin to set NEXT_PUBLIC_FIREBASE_* in Vercel.");
      return;
    }
    setError(null);
    setMessage(null);
    setAdminBusy(true);
    try {
      const cred = await signInWithEmailAndPassword(firebaseAuth, adminEmail.trim(), adminPassword);
      const role = await getRoleClaim(cred.user, true);
      if (role !== "admin") {
        await signOut(firebaseAuth);
        throw new Error("This account is not authorised as admin.");
      }
      router.replace("/admin/dashboard");
    } catch (e: any) {
      setError(e?.message ?? "Admin login failed.");
    } finally {
      setAdminBusy(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-[#FFF7ED] px-6 py-24 text-[#1C1917]">
      <main className="w-full max-w-lg rounded-2xl bg-white p-10 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Staff / Admin</h1>
        <p className="mt-2 text-sm text-stone-600">
          Sign in with your work email. Your domain must be whitelisted.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-stone-50 p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode("staff")}
            className={`h-10 rounded-xl font-semibold ${
              mode === "staff" ? "bg-white shadow-sm" : "text-stone-600 hover:text-stone-900"
            }`}
          >
            Staff
          </button>
          <button
            type="button"
            onClick={() => setMode("admin")}
            className={`h-10 rounded-xl font-semibold ${
              mode === "admin" ? "bg-white shadow-sm" : "text-stone-600 hover:text-stone-900"
            }`}
          >
            Admin
          </button>
        </div>

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

        {mode === "admin" ? (
          <div className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium">Admin email</label>
              <input
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 outline-none focus:border-[#F97316]"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                type="email"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Password</label>
              <input
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 outline-none focus:border-[#F97316]"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
              />
            </div>
            <button
              className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#F97316] px-5 text-sm font-semibold text-white hover:bg-[#EA580C] disabled:opacity-60"
              onClick={adminLogin}
              disabled={adminBusy}
              type="button"
            >
              {adminBusy ? "Signing in…" : "Sign in as admin"}
            </button>
          </div>
        ) : stage === "profile" ? (
          <div className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <input
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 outline-none focus:border-[#F97316]"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Department</label>
              <input
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 outline-none focus:border-[#F97316]"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />
            </div>
            <button
              className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#F97316] px-5 text-sm font-semibold text-white hover:bg-[#EA580C]"
              onClick={saveStaffProfile}
            >
              Save staff profile
            </button>
          </div>
        ) : stage === "pending" ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-stone-700">
              You’re signed in, but your <b>staff role</b> hasn’t been assigned yet. Ask an admin to approve you in the dashboard.
            </p>
            <button
              className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-stone-200 bg-white px-5 text-sm font-semibold text-stone-900 hover:bg-stone-50"
              onClick={doSignOut}
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium">Work email</label>
              <input
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 outline-none focus:border-[#F97316]"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
              />
              <p className="mt-2 text-xs text-stone-500">
                Allowed domains: {allowedDomains.length ? allowedDomains.join(", ") : "(none set yet)"}
              </p>
            </div>
            <button
              className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#F97316] px-5 text-sm font-semibold text-white hover:bg-[#EA580C]"
              onClick={sendStaffLink}
              disabled={sendingLink || stage === "finishing"}
            >
              {sendingLink ? "Sending…" : "Send staff login link"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

