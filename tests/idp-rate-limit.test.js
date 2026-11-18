import { describe, it, expect } from "vitest";
import { parseRetryAfter } from "../lib/idp-rate-limit.js";

const headers = (value) => ({ get: (name) => (name === "retry-after" ? value : null) });

describe("parseRetryAfter", () => {
  it("segundos", () => {
    expect(parseRetryAfter(headers("90"))).toBe(90);
  });

  it("fecha HTTP: segundos que faltan", () => {
    const now = Date.parse("2026-11-18T12:00:00Z");
    expect(parseRetryAfter(headers("Wed, 18 Nov 2026 12:02:00 GMT"), now)).toBe(120);
  });

  it("sin header, vacío o ilegible: null", () => {
    expect(parseRetryAfter(headers(null))).toBeNull();
    expect(parseRetryAfter(undefined)).toBeNull();
    expect(parseRetryAfter(headers("pronto"))).toBeNull();
  });
});
