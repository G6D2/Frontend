import { describe, it, expect } from "vitest";
import { detectEdgeBlock } from "../lib/edge-block.js";

const res = (status, headers = {}) => ({ status, headers: { get: (n) => headers[n] ?? null } });

describe("detectEdgeBlock", () => {
  it("cf-mitigated en cualquier status: Cloudflare", () => {
    expect(detectEdgeBlock(res(200, { "cf-mitigated": "challenge" }))).toMatchObject({ source: "cloudflare", status: 200 });
  });

  it("429 en HTML con la página de desafío: Cloudflare", () => {
    expect(
      detectEdgeBlock(res(429, { "content-type": "text/html" }), "<title>Just a moment...</title>")
    ).toMatchObject({ source: "cloudflare", contentType: "text/html" });
  });

  it("429/403 sin JSON y sin marcas: edge", () => {
    expect(detectEdgeBlock(res(429, { "content-type": "text/plain", server: "cloudflare" }), "Too Many Requests")).toMatchObject({ source: "edge" });
    expect(detectEdgeBlock(res(403))).toMatchObject({ source: "edge", status: 403 });
  });

  it("JSON del backend, u otro status: no es bloqueo", () => {
    expect(detectEdgeBlock(res(429, { "content-type": "application/json" }))).toBeNull();
    expect(detectEdgeBlock(res(500, { "content-type": "text/html" }), "<html>")).toBeNull();
  });
});
