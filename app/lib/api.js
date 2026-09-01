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
    severity: "high",
    status: "pendiente",
    location: { lat: -34.6042, lng: -58.3922 },
    timestamp: "2026-08-25T22:10:00-03:00",
  },
  {
    id: "em-004",
    userId: "user-105",
    description: "suicidio",
    severity: "high",
    status: "validada",
    location: { lat: -34.6042, lng: -58.3922 },
    timestamp: "2026-08-25T22:10:00-03:00",
  },
  {
    id: "em-002",
    userId: "user-205",
    description: "Incendio en edificio residencial, piso 3",
    severity: "medium",
    status: "despachada",
    location: { lat: -34.6118, lng: -58.3816 },
    timestamp: "2026-08-25T22:15:00-03:00",
  },
  {
    id: "em-003",
    userId: "user-087",
    description: "Persona herida en espacio público, Plaza de Mayo",
    severity: "low",
    status: "en_camino",
    location: { lat: -34.6083, lng: -58.3712 },
    timestamp: "2026-08-25T22:22:00-03:00",
  },
  {
    id: "em-005",
    userId: "user-123",
    description: "Necesito ayuda inmediata",
    severity: "high",
    status: "pendiente",
    location: { lat: -34.6037, lng: -58.3816 },
    timestamp: "2026-08-25T22:35:00-03:00",
  },
  {
    id: "em-006",
    userId: "user-450",
    description: "Robo a mano armada en calle Florida",
    severity: "high",
    status: "en_lugar",
    location: { lat: -34.6030, lng: -58.3740 },
    timestamp: "2026-08-25T22:40:00-03:00",
  },
  {
    id: "em-007",
    userId: "user-200",
    description: "Bache peligroso en Av. Santa Fe 2100",
    severity: "low",
    status: "resuelta",
    location: { lat: -34.5950, lng: -58.3990 },
    timestamp: "2026-08-25T22:50:00-03:00",
  },
  {
    id: "em-008",
    userId: "user-330",
    description: "Corte de luz en manzana completa",
    severity: "medium",
    status: "cerrada",
    location: { lat: -34.6200, lng: -58.3700 },
    timestamp: "2026-08-25T23:00:00-03:00",
  },
  {
    id: "em-009",
    userId: "user-512",
    description: "Derrumbe parcial de mampostería en vereda",
    severity: "high",
    status: "pendiente",
    location: { lat: -34.6010, lng: -58.3840 },
    timestamp: "2026-08-25T23:10:00-03:00",
  },
  {
    id: "em-010",
    userId: "user-620",
    description: "Inundación en paso bajo nivel",
    severity: "high",
    status: "pendiente",
    location: { lat: -34.5900, lng: -58.4000 },
    timestamp: "2026-08-25T23:15:00-03:00",
  },
  {
    id: "em-011",
    userId: "user-714",
    description: "Árbol caído obstruyendo tránsito",
    severity: "medium",
    status: "despachada",
    location: { lat: -34.6100, lng: -58.3900 },
    timestamp: "2026-08-25T23:20:00-03:00",
  },
];
// ─────────────────────────────────────────────────────────────────────

// ── Severity config (used for badges and criticality columns) ─────────
export const SEVERITY_CONFIG = {
  low: { key: "low", color: "blue", label: "Baja" },
  medium: { key: "medium", color: "yellow", label: "Media" },
  high: { key: "high", color: "orange", label: "Alta" },
};

// ── Status config (RF-09) ───────────────────────────────────────────
export const STATUS_CONFIG = [
  { key: "pendiente", label: "Pendientes", color: "red" },
  { key: "validada", label: "Validadas", color: "orange" },
  { key: "despachada", label: "Despachadas", color: "yellow" },
  { key: "en_camino", label: "En Camino", color: "cyan" },
  { key: "en_lugar", label: "En Lugar", color: "indigo" },
  { key: "resuelta", label: "Resuelta", color: "teal" },
  { key: "cerrada", label: "Cerrada", color: "gray" },
];

// ── Inyección para pruebas en consola (RF-01 .. RF-04) ───────────────
if (typeof window !== "undefined") {
  window.mockDatabase = MOCK_EMERGENCIES;

  window.simularNuevaEmergencia = (description = "Nueva Emergencia Reportada", severity = "high") => {
    const nueva = {
      id: `em-${Date.now()}`,
      userId: `user-${Math.floor(100 + Math.random() * 900)}`,
      description,
      severity, // "low" | "medium" | "high"
      status: "pendiente", // "pendiente" | "validada" | "despachada" | "en_camino" | "en_lugar" | "resuelta" | "cerrada"
      location: { lat: -34.6037, lng: -58.3816 },
      timestamp: new Date().toISOString(),
    };

    MOCK_EMERGENCIES.unshift(nueva);
    console.log("🚨 Emergencia inyectada en la base falsa. Espera al próximo ciclo de polling...", nueva);
    return nueva;
  };
}

// ── Data fetching helpers ───────────────────────────────────────────

export async function fetchEmergencies() {
  if (USE_BACKEND) {
    try {
      const res = await fetch(`${API_URL}/emergencies`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          return data;
        }
      }
    } catch {
      // Backend list endpoint not yet available, fallback to mocks
    }
  }

  // Fallback mock polling
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
