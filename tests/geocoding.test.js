import { describe, it, expect, vi, afterEach } from "vitest";
import {
  APPROXIMATE_LOCATION_LABEL,
  formatEmergencyLocation,
  resolveEmergencyAddress,
  reverseGeocode,
} from "../app/lib/geocoding";

describe("resolveEmergencyAddress", () => {
  it("returns no label and no geocode for null/undefined emergency", () => {
    expect(resolveEmergencyAddress(null)).toEqual({
      label: null,
      needsGeocode: false,
    });
    expect(resolveEmergencyAddress(undefined)).toEqual({
      label: null,
      needsGeocode: false,
    });
  });

  it("prioritizes the backend address field over everything else", () => {
    expect(
      resolveEmergencyAddress({
        address: "Av. Corrientes 1000, CABA",
        locationLabel: "otra cosa",
        latitude: -34.6,
        longitude: -58.4,
      })
    ).toEqual({ label: "Av. Corrientes 1000, CABA", needsGeocode: false });
  });

  it("ignores a blank/whitespace-only address and keeps looking", () => {
    expect(
      resolveEmergencyAddress({
        address: "   ",
        locationLabel: "Legado",
      })
    ).toEqual({ label: "Legado", needsGeocode: false });
  });

  it("falls back to the legacy locationLabel when address is null", () => {
    expect(
      resolveEmergencyAddress({
        address: null,
        locationLabel: "Plaza de Mayo",
      })
    ).toEqual({ label: "Plaza de Mayo", needsGeocode: false });
  });

  it("requests client-side geocoding when address is null but coords are valid", () => {
    expect(
      resolveEmergencyAddress({
        address: null,
        latitude: -34.6037,
        longitude: -58.3816,
      })
    ).toEqual({ label: null, needsGeocode: true });
  });

  it("requests client-side geocoding when address is absent (older fixtures)", () => {
    expect(
      resolveEmergencyAddress({
        latitude: -34.6037,
        longitude: -58.3816,
      })
    ).toEqual({ label: null, needsGeocode: true });
  });

  it("prioritizes locationAnonymized over address/coords", () => {
    expect(
      resolveEmergencyAddress({
        locationAnonymized: true,
        address: "no debería usarse",
        latitude: -34.6,
        longitude: -58.4,
      })
    ).toEqual({ label: "Ubicación anonimizada (retención)", needsGeocode: false });
  });

  it("prioritizes locationUnavailable over address/coords", () => {
    expect(
      resolveEmergencyAddress({
        locationUnavailable: true,
        address: "no debería usarse",
      })
    ).toEqual({ label: "Sin ubicación", needsGeocode: false });
  });

  it("returns 'Sin ubicación' when there's no address and no valid coords", () => {
    expect(
      resolveEmergencyAddress({
        address: null,
        latitude: null,
        longitude: null,
      })
    ).toEqual({ label: "Sin ubicación", needsGeocode: false });
  });
});


describe("reverseGeocode (dedupe en vuelo)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("devuelve null sin llamar a fetch si las coords no son finitas", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await reverseGeocode(NaN, 10)).toBeNull();
    expect(await reverseGeocode(10, undefined)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("dispara un solo fetch para llamadas concurrentes de la misma coordenada", async () => {
    let resolveFetch;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );

    // Coordenada única para no chocar con el caché de otros tests.
    const lat = -34.10001;
    const lng = -58.20002;
    const p1 = reverseGeocode(lat, lng);
    const p2 = reverseGeocode(lat, lng);

    resolveFetch({ ok: true, json: async () => ({ label: "Calle Falsa 123" }) });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe("Calle Falsa 123");
    expect(r2).toBe("Calle Falsa 123");
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Una tercera llamada ya con la dirección cacheada tampoco vuelve a pegar.
    expect(await reverseGeocode(lat, lng)).toBe("Calle Falsa 123");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("no cachea el fallo cuando el fetch lanza (timeout/red) y permite reintentar", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ label: "Recuperado" }) });

    const lat = -34.50005;
    const lng = -58.60006;
    // El error se traga en silencio y devuelve null (GeoLabel cae a coords).
    expect(await reverseGeocode(lat, lng)).toBeNull();
    // Como no se cacheó, el segundo intento vuelve a pegar y ahora resuelve.
    expect(await reverseGeocode(lat, lng)).toBe("Recuperado");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("no cachea el fallo: permite reintentar cuando la respuesta no trae dirección", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ label: "Segundo intento OK" }) });

    const lat = -34.30003;
    const lng = -58.40004;
    expect(await reverseGeocode(lat, lng)).toBeNull();
    // Como no se cacheó el fallo, el segundo llamado vuelve a intentar.
    expect(await reverseGeocode(lat, lng)).toBe("Segundo intento OK");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

describe("formatEmergencyLocation (nunca lat/lng)", () => {
  const coords = { latitude: -34.6035, longitude: -58.3925 };

  it("dirección del backend con el barrio", () => {
    expect(
      formatEmergencyLocation({ ...coords, address: "Av. Corrientes 1800", barrio: "BALVANERA" })
    ).toBe("Av. Corrientes 1800 · Balvanera");
  });

  it("no repite el barrio si la dirección ya lo nombra (sin importar tildes)", () => {
    expect(
      formatEmergencyLocation({ ...coords, barrio: "SAN NICOLAS" }, "San Nicolás, Buenos Aires")
    ).toBe("San Nicolás, Buenos Aires");
  });

  it("usa el locationLabel legado o la dirección geocodificada si el backend no mandó address", () => {
    expect(formatEmergencyLocation({ ...coords, address: " ", locationLabel: "Plaza de Mayo" })).toBe("Plaza de Mayo");
    expect(formatEmergencyLocation({ ...coords, address: null }, "Av. Córdoba 1000")).toBe("Av. Córdoba 1000");
  });

  it("sin dirección: el barrio; sin ninguno: ubicación aproximada", () => {
    expect(formatEmergencyLocation({ ...coords, barrio: "VILLA DEL PARQUE" }, null)).toBe("Villa del Parque");
    expect(formatEmergencyLocation(coords, null)).toBe(APPROXIMATE_LOCATION_LABEL);
    expect(formatEmergencyLocation(null)).toBe("Ubicación aproximada");
  });

  it("anonimizada o indescifrable: el barrio si está, si no el aviso", () => {
    expect(formatEmergencyLocation({ locationAnonymized: true, barrio: "PALERMO" })).toBe(
      "Palermo (ubicación anonimizada)"
    );
    expect(formatEmergencyLocation({ locationAnonymized: true })).toBe("Ubicación anonimizada (retención)");
    expect(formatEmergencyLocation({ locationUnavailable: true, barrio: "PALERMO" })).toBe("Palermo");
    expect(formatEmergencyLocation({ locationUnavailable: true })).toBe("Sin ubicación");
  });

  it("nunca devuelve coordenadas", () => {
    const text = formatEmergencyLocation({ ...coords, address: null, barrio: null }, null);
    expect(text).not.toMatch(/-?\d+\.\d+/);
  });
});
