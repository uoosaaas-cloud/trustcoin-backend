"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Static-export safe home redirect (server `redirect()` breaks prerendered HTML). */
export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/register");
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F6F7FB] text-sm text-slate-500">
      Redirecting…
    </main>
  );
}
