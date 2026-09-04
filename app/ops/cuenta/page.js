"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MaterialIcon from "../../components/civic/MaterialIcon";
import {
  getStoredUser,
  fetchCurrentUser,
  logout,
} from "../../lib/api";
import { isDispatcher } from "../../lib/auth";

export default function OpsCuentaPage() {
  const router = useRouter();
  const [user, setUser] = useState(getStoredUser());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const next = getStoredUser() || (await fetchCurrentUser());
        if (cancelled) return;
        if (!isDispatcher(next)) {
          router.replace("/inicio");
          return;
        }
        setUser(next);
      } catch {
        if (!cancelled) router.replace("/acceso");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="p-4 md:p-8 max-w-xl mx-auto w-full flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Mi cuenta</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Sesión del operador de emergencias.
        </p>
      </div>

      <div className="flex flex-col items-center gap-4 py-4">
        <div className="w-20 h-20 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container text-2xl font-bold">
          {(user?.username || "OP").slice(0, 2).toUpperCase()}
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-primary">
            {user?.username || "Dispatcher"}
          </h2>
          <p className="text-sm text-on-surface-variant font-mono">
            {user?.sub || "—"}
          </p>
          <p className="text-xs text-on-surface-variant mt-1">
            {(user?.groups || []).join(", ") || "dispatcher"}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={async () => {
          await logout();
          router.push("/acceso");
        }}
        className="w-full flex items-center justify-center gap-2 bg-surface text-secondary font-semibold text-sm tracking-wide py-4 rounded-xl border border-outline-variant hover:bg-error-container transition-colors min-h-[56px]"
      >
        <MaterialIcon name="logout" />
        Cerrar sesión
      </button>
    </main>
  );
}
