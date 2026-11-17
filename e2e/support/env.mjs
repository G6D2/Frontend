/**
 * Configuración compartida de los tests e2e: la leen playwright.config.mjs,
 * los specs y los servidores simulados de e2e/mocks/.
 *
 * E2E_BACKEND elige contra qué backend corre el BFF:
 *   - "mock" (default, el de CI): e2e/mocks/backend.mjs, en memoria.
 *   - "real": el backend de verdad (G6D2/emergencias-backend) clonado en
 *     E2E_BACKEND_DIR, con Postgres en E2E_DATABASE_URL. Ver README.
 */
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function port(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export const BACKEND_MODE = process.env.E2E_BACKEND === "real" ? "real" : "mock";

export const FRONT_PORT = port("E2E_FRONT_PORT", 4311);
export const BACKEND_PORT = port("E2E_BACKEND_PORT", 4310);
export const IDP_PORT = port("E2E_IDP_PORT", 4312);

// El navegador entra por localhost: con NODE_ENV=production la cookie de
// sesión sale con `secure`, y Chromium solo la acepta sobre http en localhost.
export const FRONT_URL = `http://localhost:${FRONT_PORT}`;
// Servidor a servidor (BFF → backend, tests → backend) va por IPv4 explícito.
export const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;
export const IDP_URL = `http://127.0.0.1:${IDP_PORT}`;

export const BACKEND_DIR = path.resolve(
  frontendDir,
  process.env.E2E_BACKEND_DIR || "../emergencias-backend"
);
export const DATABASE_URL =
  process.env.E2E_DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:55436/emergencias_e2e";

// Contraseña que acepta el Login Federado simulado (e2e/mocks/login-federado.mjs).
// No es un secreto: ese servidor solo existe mientras corren los tests.
export const LDAP_PASSWORD = "e2e-ldap-password";

// Ubicación fija que el navegador le da al botón de pánico (Plaza de Mayo).
export const GEOLOCATION = { latitude: -34.6083, longitude: -58.3712 };

// Dirección que devuelve /api/geocode en los tests (ver mockGeocoding).
export const E2E_ADDRESS = "Av. de Mayo 500, San Nicolás (e2e)";

/**
 * Variables del backend real para los tests: login de demo abierto
 * (DEV_LOGIN_STRICT=false), sin rate limit, sin Kafka y sin jobs de fondo.
 * Las claves de cifrado son fijas y solo de prueba: así una base local que se
 * reusa entre corridas sigue pudiendo descifrar las ubicaciones viejas.
 */
export function realBackendEnv() {
  const testKey = (label) =>
    createHash("sha256").update(`citypass-e2e-${label}`).digest("base64");
  return {
    PORT: String(BACKEND_PORT),
    NODE_ENV: "development",
    LOG_LEVEL: "warn",
    DATABASE_URL,
    DATABASE_SSL: "false",
    AUTH_MODE: "local",
    DEV_LOGIN_STRICT: "false",
    RATE_LIMIT_ENABLED: "false",
    KAFKA_ENABLED: "false",
    KAFKA_CONSUMER_ENABLED: "false",
    OUTBOX_PUBLISHER_ENABLED: "false",
    LOCATION_ENCRYPTION_KEY: testKey("db"),
    BUS_LOCATION_ENCRYPTION_KEY: testKey("bus"),
    INCIDENT_DETECTION_ENABLED: "false",
    LOCATION_RETENTION_ENABLED: "false",
    EMERGENCY_EXPIRATION_ENABLED: "false",
    CITIZEN_PII_RETENTION_ENABLED: "false",
    KEEP_WARM_ENABLED: "false",
  };
}
