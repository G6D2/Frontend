"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser, fetchCurrentUser } from "../../lib/api";
import PageHeader from "../../components/PageHeader";
import AccountView from "../../components/AccountView";
import CitizenPageContainer from "../../components/civic/CitizenPageContainer";

// Mi cuenta del oficial: misma vista que ciudadano y dispatcher. El acceso
// por rol lo resuelve el middleware (solo un oficial llega a /oficial/*).
export default function OficialCuentaPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const next = getStoredUser() || (await fetchCurrentUser());
        if (!cancelled) setUser(next);
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
        <AccountView user={user} roleFallback="Oficial" />
      </CitizenPageContainer>
    </>
  );
}
