"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { getSiteConfig } from "@/lib/siteConfig";
import { getUserProfile, upsertUserProfile } from "@/lib/users";
import { useAuth } from "@/components/AuthProvider";

const EMAIL_STORAGE_KEY = "gwh_login_email";
const RETURN_TO_KEY = "gwh_return_to";

export default function LoginClient() {
  const firebaseAuth = getFirebaseAuth();
  const { user, loading } = useAuth();
  const searchParams = useSearchParams();
  const returnTo = useMemo(() => searchParams.get("returnTo") ?? "/", [searchParams]);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [stage, setStage] = useState<"request" | "finishing" | "profile" | "done">(
    "request",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) return;

    // If already signed in and profile exists, skip login UI.
    getUserProfile(user.uid)
      .then((p) => {
        if (p?.name && p?.phone) window.location.href = returnTo;
      })
      .catch(() => {});
  }, [loading, returnTo, user]);

  useEffect(() => {
    const href = window.location.href;
    if (!isSignInWithEmailLink(firebaseAuth, href)) return;

    setStage("finishing");
    const savedEmail = window.localStorage.getItem(EMAIL_STORAGE_KEY) ?? "";
    const emailForLink =
      savedEmail || window.prompt("Confirm your email to finish sign-in") || "";

    if (!emailForLink) {
      setError("Email is required to finish sign-in.");
      setStage("request");
      return;
    }

    signInWithEmailLink(firebaseAuth, emailForLink, href)
      .then(async (cred) => {
        window.localStorage.removeItem(EMAIL_STORAGE_KEY);
        const finalReturnTo = window.localStorage.getItem(RETURN_TO_KEY) ?? returnTo;
        window.localStorage.removeItem(RETURN_TO_KEY);

        await upsertUserProfile(cred.user.uid, {
          name: cred.user.displayName ?? "",
          email: cred.user.email ?? emailForLink,
        });

        setMessage("Signed in. Please complete your profile.");
        setStage("profile");
        window.localStorage.setItem(RETURN_TO_KEY, finalReturnTo);
      })
      .catch((e) => {
        setError(e?.message ?? "Failed to finish sign-in.");
        setStage("request");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendLink() {
    setError(null);
    setMessage(null);

    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError("Enter your email.");
      return;
    }

    const site = await getSiteConfig().catch(() => null);
    const url = `${process.env.NEXT_PUBLIC_APP_URL}/login?returnTo=${encodeURIComponent(
      returnTo,
    )}`;

    await sendSignInLinkToEmail(firebaseAuth, trimmed, {
      url,
      handleCodeInApp: true,
    });

    window.localStorage.setItem(EMAIL_STORAGE_KEY, trimmed);
    window.localStorage.setItem(RETURN_TO_KEY, returnTo);
    setMessage(
      `Login link sent. Check your inbox${
        site?.eventTitle ? ` for “${site.eventTitle}”` : ""
      }.`,
    );
  }

  async function saveProfile() {
    setError(null);
    setMessage(null);

    const u = firebaseAuth.currentUser;
    if (!u) {
      setError("You are not signed in.");
      setStage("request");
      return;
    }

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName) return setError("Please enter your name.");
    if (!trimmedPhone) return setError("Please enter your phone number.");

    await upsertUserProfile(u.uid, {
      name: trimmedName,
      email: u.email ?? "",
      phone: trimmedPhone,
      role: "public",
    });

    const finalReturnTo = window.localStorage.getItem(RETURN_TO_KEY) ?? "/";
    setStage("done");
    window.location.href = finalReturnTo;
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-[#FFF7ED] px-4 py-12 text-[#1C1917] sm:px-6 sm:py-24">
      <main className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-sm sm:p-10">
        <h1 className="text-2xl font-semibold tracking-tight">Log in</h1>
        <p className="mt-2 text-sm text-stone-600">
          We’ll email you a magic link. No password needed.
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

        {stage === "profile" ? (
          <div className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <input
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 outline-none focus:border-[#F97316]"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Phone number</label>
              <input
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 outline-none focus:border-[#F97316]"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +65 9123 4567"
              />
              <p className="mt-2 text-xs text-stone-500">
                We’ll use this to contact you if you win.
              </p>
            </div>
            <button
              className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#F97316] px-5 text-sm font-semibold text-white hover:bg-[#EA580C]"
              onClick={saveProfile}
            >
              Save profile
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
                placeholder="you@example.com"
                type="email"
                autoComplete="email"
              />
            </div>
            <button
              className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#F97316] px-5 text-sm font-semibold text-white hover:bg-[#EA580C] disabled:opacity-60"
              onClick={sendLink}
              disabled={stage === "finishing"}
            >
              Send login link
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

