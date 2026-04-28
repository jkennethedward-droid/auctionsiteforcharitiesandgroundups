import { Suspense } from "react";
import LoginClient from "./ui";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center bg-[#FFF7ED] px-6 py-24 text-[#1C1917]">
          <main className="w-full max-w-lg rounded-2xl bg-white p-10 shadow-sm">
            <div className="text-sm text-stone-600">Loading…</div>
          </main>
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  );
}

