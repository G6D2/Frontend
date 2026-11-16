"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CitizenTopBar from "../../components/civic/CitizenTopBar";
import CitizenPageContainer from "../../components/civic/CitizenPageContainer";
import AccountView from "../../components/AccountView";
import { getStoredUser, fetchCurrentUser } from "../../lib/api";

// Perfil y ubicaciones viven en el backend (/api/citizen/*), cifrados en reposo.
const ACCESS_ITEMS = [
  { icon: "person", label: "Datos personales", href: "/perfil/datos" },
  { icon: "location_on", label: "Ubicaciones guardadas", href: "/perfil/ubicaciones" },
  { icon: "help", label: "Ayuda", href: "/perfil/ayuda" },
];

export default function PerfilPage() {
  const router = useRouter();
  // Arranca en null también en el cliente para que el primer render coincida
  // con el HTML del server (sin sessionStorage); el guardado se lee al montar.
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = getStoredUser();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (storedUser) setUser(storedUser);

    fetchCurrentUser()
      .then(setUser)
      .catch(() => router.replace("/acceso"));
  }, [router]);

  const isAnon = user?.loginMethod === "anonima";

  return (
    <>
      <CitizenTopBar title="Mi cuenta" />

      <CitizenPageContainer>
        <AccountView
          user={user}
          accessItems={ACCESS_ITEMS}
          roleFallback="Sin grupo"
          showSignup={isAnon}
        />
      </CitizenPageContainer>
    </>
  );
}
