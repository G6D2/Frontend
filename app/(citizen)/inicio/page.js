import InicioClient from "./InicioClient";

/** Server Component: la auth la cubre middleware (cookie httpOnly). */
export default function InicioPage() {
  return <InicioClient />;
}
