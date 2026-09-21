"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CitizenTopBar from "../../components/civic/CitizenTopBar";
import CitizenPageContainer from "../../components/civic/CitizenPageContainer";
import AccountView from "../../components/AccountView";
import { getStoredUser, fetchCurrentUser } from "../../lib/api";

// TODO(back): hoy vive en localStorage; migrar a endpoints reales cuando
// exista el perfil de ciudadano.
const ACCESS_ITEMS = [
  { icon: "person", label: "Datos personales", href: "/perfil/datos" },
  { icon: "location_on", label: "Ubicaciones guardadas", href: "/perfil/ubicaciones" },
  { icon: "help", label: "Ayuda", href: "/perfil/ayuda" },
];

export default function PerfilPage() {
  const router = useRouter();
  const [user, setUser] = useState(getStoredUser());

  useEffect(() => {
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
