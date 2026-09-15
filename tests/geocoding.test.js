import { describe, it, expect } from "vitest";
import { resolveEmergencyAddress } from "../app/lib/geocoding";

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
