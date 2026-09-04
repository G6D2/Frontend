"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import DispatcherView from "../components/DispatcherView";
import { fetchCurrentUser, getStoredUser } from "../lib/api";
import { isDispatcher } from "../lib/auth";

/** Dashboard dispatcher = kanban (DispatcherView) + Navbar del layout. */
export default function OpsPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = getStoredUser() || (await fetchCurrentUser());
        if (!cancelled && !isDispatcher(user)) {
          router.replace("/inicio");
        }
      } catch {
        if (!cancelled) router.replace("/acceso");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return <DispatcherView />;
}
