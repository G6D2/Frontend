// ── Backend integration toggle ──────────────────────────────────────
// La ia hizo este facil sistema para probar el funcionamiento del frontend
// y facilitar la integracion del back. Cuando integremos el back, cambiamos la url
// y el use_backend a true.
export const USE_BACKEND = true;
// El backend corre en la misma máquina que el front (puerto 4000), pero el browser
// puede estar en otra: usamos el hostname con el que se abrió la página en vez de
// hardcodear localhost. En SSR no hay window; el fetch real siempre corre en el cliente.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined"
    ? `http://${window.location.hostname}:4000/api`
    : "http://localhost:4000/api");
export const POLLING_INTERVAL_MS = 5000;
// ─────────────────────────────────────────────────────────────────────

// ── Mock data (used when USE_BACKEND = false) ───────────────────────
export const MOCK_EMERGENCIES = [
  {
    id: "em-001",
    userId: "user-101",
    description: "Accidente de tránsito en Av. Corrientes y Callao",
    severity: "critical",
    location: { lat: -34.6042, lng: -58.3922 },
    timestamp: "2026-08-25T22:10:00-03:00",
  },
  {
    id: "em-004",
    userId: "user-105",
    description: "suicidio",
    severity: "high",
    location: { lat: -34.6042, lng: -58.3922 },
    timestamp: "2026-08-25T22:10:00-03:00",
  },
  {
    id: "em-002",
    userId: "user-205",
    description: "Incendio en edificio residencial, piso 3",
    severity: "medium",
    location: { lat: -34.6118, lng: -58.3816 },
    timestamp: "2026-08-25T22:15:00-03:00",
  },
  {
    id: "em-003",
    userId: "user-087",
    description: "Persona herida en espacio público, Plaza de Mayo",
    severity: "low",
    location: { lat: -34.6083, lng: -58.3712 },
    timestamp: "2026-08-25T22:22:00-03:00",
  }
];
// ─────────────────────────────────────────────────────────────────────

export const SEVERITY_CONFIG = {
  critical: { color: "red", label: "Crítica" },
  high: { color: "orange", label: "Alta" },
  medium: { color: "yellow", label: "Media" },
  low: { color: "blue", label: "Baja" },
};

// ── Data fetching helpers ───────────────────────────────────────────

export async function fetchEmergencies() {
  // El backend todavía no tiene endpoint de listado de emergencias,
  // así que seguimos devolviendo los mocks aunque USE_BACKEND sea true.
  console.log("Polling emergencies (mock):", MOCK_EMERGENCIES.length, "active");
  return MOCK_EMERGENCIES;
}

export async function submitEmergency(payload) {
  if (USE_BACKEND) {
    const res = await fetch(`${API_URL}/panic-button`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(data?.message || "Error al enviar la emergencia.");
    }

    return data;
  }
  console.log(payload);
  return { success: true };
}
