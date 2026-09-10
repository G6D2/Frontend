import { describe, it, expect, beforeEach } from "vitest";
import { reverseGeocodeServer, buildLabel, cacheKey, _resetGeocodeState } from "../lib/geocode-server.js";

function nominatimMock(responses = {}) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const status = responses.status ?? 200;
    if (responses.throw) throw new Error("boom");
    return {
      ok: status === 200,
      status,
      json: async () => responses.body ?? { address: { road: "Av. Corrientes", house_number: "1000", city: "Buenos Aires" } },
    };
  };
  return { fetchImpl, calls };
}

const fastDeps = (extra) => ({ sleep: async () => {}, now: () => 1_000_000, ...extra });

describe("geocode-server", () => {
  beforeEach(() => _resetGeocodeState());

  it("arma la etiqueta corta y cae a display_name", () => {
    expect(buildLabel({ address: { road: "Corrientes", house_number: "1000", city: "CABA" } })).toBe("Corrientes, 1000, CABA");
    expect(buildLabel({ display_name: "Obelisco, CABA" })).toBe("Obelisco, CABA");
    expect(buildLabel({})).toBeNull();
  });

  it("redondea la clave de caché a 4 decimales", () => {
    expect(cacheKey(-34.60371234, -58.38161234)).toBe("-34.6037,-58.3816");
  });

  it("cachea y agrupa pedidos con la misma coordenada", async () => {
    const { fetchImpl, calls } = nominatimMock();
    const deps = fastDeps({ fetchImpl });
    const [a, b] = await Promise.all([
      reverseGeocodeServer(-34.60371, -58.38161, deps),
      reverseGeocodeServer(-34.60372, -58.38162, deps),
    ]);
    const c = await reverseGeocodeServer(-34.6037, -58.3816, deps);
    expect(a).toBe("Av. Corrientes, 1000, Buenos Aires");
    expect(b).toBe(a);
    expect(c).toBe(a);
    expect(calls).toHaveLength(1);
  });

  it("serializa las salidas a Nominatim respetando el intervalo mínimo", async () => {
    const { fetchImpl, calls } = nominatimMock();
    let clock = 10_000;
    const waits = [];
    const deps = { fetchImpl, now: () => clock, sleep: async (ms) => { waits.push(ms); clock += ms; } };
    await Promise.all([
      reverseGeocodeServer(-34.6, -58.3, deps),
      reverseGeocodeServer(-34.7, -58.4, deps),
      reverseGeocodeServer(-34.8, -58.5, deps),
    ]);
    expect(calls).toHaveLength(3);
    expect(waits.filter((w) => w > 0)).toHaveLength(2);
    expect(Math.min(...waits.filter((w) => w > 0))).toBeGreaterThanOrEqual(1100);
  });

  it("devuelve null si Nominatim responde 503 o lanza, y no cachea el fallo", async () => {
    const bad = nominatimMock({ status: 503 });
    expect(await reverseGeocodeServer(-34.6, -58.3, fastDeps({ fetchImpl: bad.fetchImpl }))).toBeNull();
    const boom = nominatimMock({ throw: true });
    expect(await reverseGeocodeServer(-34.6, -58.3, fastDeps({ fetchImpl: boom.fetchImpl }))).toBeNull();
    const ok = nominatimMock();
    expect(await reverseGeocodeServer(-34.6, -58.3, fastDeps({ fetchImpl: ok.fetchImpl }))).toBe("Av. Corrientes, 1000, Buenos Aires");
    expect(ok.calls).toHaveLength(1);
  });
});
