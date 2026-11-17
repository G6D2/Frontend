/**
 * Datos de prueba de los tests e2e. Cada test crea sus propios usuarios y
 * emergencias hablándole directo al backend (simulado o real); nada sale de
 * datos reales ni de las cuentas demo del seed.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { expect, request } from "@playwright/test";
import { BACKEND_DIR, BACKEND_MODE, BACKEND_URL, DATABASE_URL, E2E_ADDRESS } from "./env.mjs";

/** Sufijo único por corrida, para no chocar con datos de corridas anteriores. */
export function uniqueId(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Cliente HTTP contra el backend (no pasa por el BFF ni por el navegador). */
export function backendApi() {
  return request.newContext({ baseURL: BACKEND_URL });
}

async function okJson(response, what) {
  const text = await response.text();
  expect(response.ok(), `${what}: HTTP ${response.status()} ${text}`).toBe(true);
  return JSON.parse(text);
}

/** Token del login de demo del backend de prueba (acepta cualquier sub y grupo). */
export async function devLogin(api, { sub, groups }) {
  const data = await okJson(
    await api.post("/auth/dev/login", { data: { sub, preferred_username: sub, groups } }),
    `dev login de ${sub}`
  );
  return data.access_token;
}

/**
 * En el backend no hay API para habilitar el botón de pánico de una cuenta
 * (en producción lo decide el claim has_antipanic_button). Con el backend
 * real se marca por SQL, con el `pg` del propio backend clonado; con el
 * simulado, por su endpoint de prueba.
 */
async function grantSosButton(api, email) {
  if (BACKEND_MODE === "mock") {
    await okJson(await api.post("/__e2e/antipanic", { data: { email } }), "habilitar SOS");
    return;
  }
  const requireFromBackend = createRequire(path.join(BACKEND_DIR, "package.json"));
  const { Client } = requireFromBackend("pg");
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const { rowCount } = await client.query(
      "UPDATE auth_users SET has_antipanic_button = true WHERE lower(email) = lower($1)",
      [email]
    );
    expect(rowCount, `cuenta ${email} en auth_users`).toBe(1);
  } finally {
    await client.end();
  }
}

/** Cuenta ciudadana nueva (POST /auth/register), con botón de pánico si se pide. */
export async function createCitizenAccount(api, { withSos = false } = {}) {
  const name = uniqueId("e2e-ciudadano");
  const account = { email: `${name}@e2e.citypass.test`, password: `pw-${name}`, name };
  await okJson(
    await api.post("/auth/register", {
      data: { email: account.email, password: account.password, preferred_username: name },
    }),
    `registro de ${account.email}`
  );
  if (withSos) await grantSosButton(api, account.email);
  return account;
}

/** Alta de una emergencia como lo hace /reportar (POST /api/panic-button). */
export async function reportEmergency(api, token, { emergencyType, description }) {
  const data = await okJson(
    await api.post("/api/panic-button", {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        location: { latitude: -34.6037, longitude: -58.3816 },
        emergencyType,
        description,
        address: E2E_ADDRESS,
      },
    }),
    `alta de "${description}"`
  );
  return data.data;
}

export async function getEmergency(api, token, id) {
  const data = await okJson(
    await api.get(`/api/emergencies/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
    `detalle de ${id}`
  );
  return data.data;
}

/** PATCH /api/emergencies/:id/<action> sin validar la respuesta (para limpiar). */
export function patchEmergency(api, token, id, action, body = {}) {
  return api.patch(`/api/emergencies/${id}/${action}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: body,
  });
}

/**
 * /api/geocode del BFF le pregunta la dirección a BigDataCloud y Nominatim.
 * En los tests se responde desde el navegador con una dirección fija: el
 * resultado no depende de servicios externos ni de la red del runner.
 */
export async function mockGeocoding(page) {
  await page.route(
    (url) => url.pathname === "/api/geocode",
    (route) => route.fulfill({ json: { label: E2E_ADDRESS } })
  );
}
