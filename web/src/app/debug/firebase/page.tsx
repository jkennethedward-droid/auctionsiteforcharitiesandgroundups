"use client";

import React, { useMemo } from "react";
import { getFirebaseApp } from "@/lib/firebase/client";

function mask(value: unknown) {
  const s = String(value ?? "");
  if (s.length <= 8) return s ? "********" : "(empty)";
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

export default function FirebaseDebugPage() {
  const info = useMemo(() => {
    try {
      const app = getFirebaseApp();
      const opts: any = (app as any).options ?? {};
      return {
        ok: true as const,
        options: {
          apiKey: mask(opts.apiKey),
          authDomain: String(opts.authDomain ?? ""),
          projectId: String(opts.projectId ?? ""),
          storageBucket: String(opts.storageBucket ?? ""),
          messagingSenderId: mask(opts.messagingSenderId),
          appId: mask(opts.appId),
        },
      };
    } catch (e: any) {
      return { ok: false as const, error: e?.message ?? String(e) };
    }
  }, []);

  return (
    <div className="min-h-full bg-[#FFF7ED] px-6 py-10 text-[#1C1917]">
      <main className="mx-auto w-full max-w-2xl rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Firebase debug</h1>
        <p className="mt-2 text-sm text-stone-600">
          This page shows which Firebase config the deployed site is actually using.
        </p>

        {info.ok ? (
          <pre className="mt-6 overflow-auto rounded-xl border border-stone-200 bg-stone-50 p-4 text-xs">
            {JSON.stringify(info.options, null, 2)}
          </pre>
        ) : (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {info.error}
          </div>
        )}

        <div className="mt-6 text-xs text-stone-500">
          Expected projectId: <b>auction-site-26</b> and authDomain:{" "}
          <b>auction-site-26.firebaseapp.com</b>.
        </div>
      </main>
    </div>
  );
}

