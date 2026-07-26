"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getStoredAuthToken } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { ADMIN_ROUTES } from "@/lib/adminPaths";

/**
 * Ensures the current session is an authenticated ADMIN.
 * Redirects to the secret admin login when missing/invalid.
 */
export function useRequireAdmin() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getStoredAuthToken();
    const user = getStoredUser();

    if (!token || !user || user.role !== "ADMIN") {
      router.replace(ADMIN_ROUTES.login);
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
  }, [router]);

  return ready;
}
