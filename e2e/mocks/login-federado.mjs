/**
 * Login Federado (Grupo 2) simulado para los tests e2e.
 *
 * El dispatcher entra por la solapa "Personal Municipal (LDAP)" de /acceso:
 * el BFF (app/api/auth/login/route.js) le manda usuario y contraseña a
 * CITYPASS_IDP_AUTH_URL, que en los tests apunta acá. En CI no hay LDAP del
 * Grupo 2, así que este servidor hace de IdP: acepta cualquier usuario con la
 * contraseña de prueba (LDAP_PASSWORD) y le pide el token al login de demo
 * del backend (POST /auth/dev/login con grupo dispatcher, que el backend de
 * prueba acepta porque corre con DEV_LOGIN_STRICT=false). Así el token que
 * guarda la cookie lo firmó y lo valida el mismo backend contra el que corre
 * el test, sea el simulado o el real.
 *
 * Uso: node e2e/mocks/login-federado.mjs (puerto E2E_IDP_PORT, 4312 por defecto).
 */
import http from "node:http";
import { BACKEND_URL, IDP_PORT, LDAP_PASSWORD } from "../support/env.mjs";

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    return {};
  }
}

async function login(req, res) {
  const { username, password } = await readJson(req);
  if (typeof username !== "string" || !username.trim() || password !== LDAP_PASSWORD) {
    send(res, 401, { error: "invalid_credentials", message: "Usuario o contraseña inválidos" });
    return;
  }

  const backendRes = await fetch(`${BACKEND_URL}/auth/dev/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      sub: username.trim(),
      preferred_username: username.trim(),
      groups: ["dispatcher"],
    }),
  });
  const data = await backendRes.json().catch(() => null);
  if (!backendRes.ok || !data?.access_token) {
    send(res, 502, { error: "bad_gateway", message: `El backend no emitió el token (HTTP ${backendRes.status})` });
    return;
  }
  // Sin refresh_token: el BFF trata la sesión como local y no intenta renovarla.
  send(res, 200, {
    access_token: data.access_token,
    token_type: "Bearer",
    expires_in: data.expires_in,
  });
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
  try {
    if (req.method === "GET" && pathname === "/health") {
      send(res, 200, { status: "ok", mock: "login-federado" });
    } else if (req.method === "POST" && pathname === "/auth/login") {
      await login(req, res);
    } else {
      send(res, 404, { error: "not_found", message: "Ruta no disponible" });
    }
  } catch (error) {
    console.error(error);
    send(res, 502, { error: "bad_gateway", message: error.message });
  }
});

server.listen(IDP_PORT, () => {
  console.log(`[e2e] Login Federado simulado en http://localhost:${IDP_PORT}`);
});
