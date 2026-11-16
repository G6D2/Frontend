"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser, fetchCurrentUser } from "../../lib/api";
import { isDispatcher } from "../../lib/auth";
import PageHeader from "../../components/PageHeader";
import AccountView from "../../components/AccountView";
import CitizenPageContainer from "../../components/civic/CitizenPageContainer";

export default function OpsCuentaPage() {
  const router = useRouter();
  // Arranca en null también en el cliente para que el primer render coincida
  // con el HTML del server (sin sessionStorage); el efecto de abajo lee el
  // guardado al montar.
  const [user, setUser] = useState(null);

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
    <>
      <PageHeader title="Mi cuenta" />
      <CitizenPageContainer>
        {/* El dispatcher no tiene accesos propios en Mi cuenta todavía
            (accessItems queda vacío: AccountView no renderiza esa sección). */}
        <AccountView user={user} roleFallback="Dispatcher" />
      </CitizenPageContainer>
    </>
  );
}
