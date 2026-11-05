import { describe, it, expect } from "vitest";
import { checkCsrf, isJsonRequest, isSameOrigin } from "../lib/csrf.js";

function post(headers = {}) {
  return new Request("http://localhost/api/auth/login", { method: "POST", headers });
}

describe("csrf", () => {
  describe("isSameOrigin", () => {
    it("acepta Origin con el mismo host que la request", () => {
      expect(isSameOrigin(post({ Host: "citypass.test", Origin: "https://citypass.test" }))).toBe(true);
      expect(isSameOrigin(post({ Host: "localhost:3001", Origin: "http://localhost:3001" }))).toBe(true);
    });

    it("usa X-Forwarded-Host (primer valor) si lo pone el proxy", () => {
      const req = post({
        Host: "10.0.0.5:3001",
        "X-Forwarded-Host": "citypass.test, proxy.interno",
        Origin: "https://citypass.test",
      });
      expect(isSameOrigin(req)).toBe(true);
    });

    it("rechaza otro host, otro puerto, Origin: null y Origin sin Host", () => {
      expect(isSameOrigin(post({ Host: "citypass.test", Origin: "https://evil.example" }))).toBe(false);
      expect(isSameOrigin(post({ Host: "citypass.test", Origin: "https://citypass.test.evil.example" }))).toBe(false);
      expect(isSameOrigin(post({ Host: "localhost:3001", Origin: "http://localhost:4000" }))).toBe(false);
      expect(isSameOrigin(post({ Host: "citypass.test", Origin: "null" }))).toBe(false);
      expect(isSameOrigin(post({ Origin: "https://citypass.test" }))).toBe(false);
    });

    it("sin Origin: pasa salvo que Sec-Fetch-Site diga otro sitio", () => {
      expect(isSameOrigin(post({ Host: "citypass.test" }))).toBe(true);
      expect(isSameOrigin(post({ "Sec-Fetch-Site": "same-origin" }))).toBe(true);
      expect(isSameOrigin(post({ "Sec-Fetch-Site": "cross-site" }))).toBe(false);
      expect(isSameOrigin(post({ "Sec-Fetch-Site": "same-site" }))).toBe(false);
    });
  });

  describe("isJsonRequest", () => {
    it("acepta application/json con o sin charset", () => {
      expect(isJsonRequest(post({ "Content-Type": "application/json" }))).toBe(true);
      expect(isJsonRequest(post({ "Content-Type": "Application/JSON; charset=utf-8" }))).toBe(true);
    });

    it("rechaza los Content-Type de una simple request y la ausencia de header", () => {
      for (const type of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data"]) {
        expect(isJsonRequest(post({ "Content-Type": type }))).toBe(false);
      }
      expect(isJsonRequest(post())).toBe(false);
    });
  });

  describe("checkCsrf", () => {
    it("devuelve null si la request pasa", () => {
      const req = post({ Host: "citypass.test", Origin: "https://citypass.test", "Content-Type": "application/json" });
      expect(checkCsrf(req)).toBeNull();
    });

    it("403 si el origen no coincide (antes de mirar el Content-Type)", async () => {
      const res = checkCsrf(post({ Host: "citypass.test", Origin: "https://evil.example", "Content-Type": "text/plain" }));
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "Forbidden", message: "Origen no permitido" });
    });

    it("415 si no es JSON, salvo con { json: false }", () => {
      const req = post({ Host: "citypass.test", Origin: "https://citypass.test", "Content-Type": "text/plain" });
      expect(checkCsrf(req).status).toBe(415);
      expect(checkCsrf(req, { json: false })).toBeNull();
    });
  });
});
