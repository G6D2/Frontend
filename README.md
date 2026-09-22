# CityPass+ — Frontend

Responsive Web App de gestión de servicios urbanos y emergencias para la ciudad. El frontend funciona como **BFF (Backend For Frontend)** sobre Next.js App Router: las páginas cliente nunca hablan directamente al backend; todo pasa por Route Handlers que mantienen la sesión en una cookie `httpOnly`.

---

## Inicio rápido

```bash
npm install
npm run dev        # http://localhost:3001
```

> El backend (Express) debe estar corriendo en `http://localhost:3000` (o definir `API_URL`).

---

## Stack tecnológico

| Tecnología | Uso |
|---|---|
| **Next.js 15 (App Router)** | Framework React — SSR, Route Handlers (BFF), middleware |
| **React 19** | UI reactiva |
| **Tailwind CSS v4** | Utilidades de estilo via `@theme` tokens |
| **Material Symbols Outlined** | Iconografía (Google Fonts, variable font) |
| **Vitest** | Tests unitarios |

---

## Arquitectura

```
Browser  ──►  Next.js (BFF)  ──►  Express backend (puerto 3000)
              /api/auth/*             /auth/dev/login
              /api/backend/*          /api/emergencies
                                      /api/officers
                                      /api/user
```

- La cookie `citypass_session` (JWT, `httpOnly`, `sameSite: lax`) es emitida por el BFF y nunca queda expuesta al JS del cliente.
- `middleware.js` protege todas las rutas excepto `/acceso` y `/api/auth/*`.
- `lib/backend-fetch.js` implementa **retry automático** (6 intentos, 4 s entre reintentos) para absorber el cold start de Render (502/503/504).

---

## Cuentas de demo

Definidas en `app/lib/features.js` → `DEMO_ACCOUNTS`. Contraseña unificada: **`abracadabra`**.

| Email | Botón Antipánico | Rol |
|---|---|---|
| `JuanPanico@gmail.com` | ✅ Sí | Ciudadano |
| `LuciaTranquila@gmail.com` | ❌ No | Ciudadano |

### Acceso rápido Dispatcher

En la pantalla de login, debajo del card, hay un botón dorado **"Vista Dispatcher — Demo"** que hace login directo como dispatcher (`DISP-Demo001`) y redirige a `/ops` sin necesidad de ingresar credenciales.

La cuenta dispatcher está definida en `DISPATCHER_DEMO` (también en `features.js`).

---

## Feature flags (`app/lib/features.js`)

| Flag | Valor actual | Descripción |
|---|---|---|
| `ANTIPANIC_MODE` | `"mock"` | `"mock"` → `hasAntipanicButton` viene de `DEMO_ACCOUNTS`; `"backend"` → viene de `GET /api/user` |
| `DEMO_ACCOUNTS` | (ver archivo) | Cuentas ciudadanas de demostración |
| `DISPATCHER_DEMO` | (ver archivo) | Cuenta dispatcher de acceso directo |

> Para conectar con el backend real: cambiar `ANTIPANIC_MODE = "backend"` y asegurarse de que `GET /api/user` devuelva `{ hasAntipanicButton: boolean }`.

---

## Endpoints BFF (`app/api/`)

| Método | Ruta | Estado | Descripción |
|---|---|---|---|
| `POST` | `/api/auth/login` | ✅ Activo | Login vía backend dev (`/auth/dev/login`). Emite cookie de sesión. |
| `POST` | `/api/auth/logout` | ✅ Activo | Borra la cookie de sesión. |
| `GET` | `/api/auth/session` | ✅ Activo | Devuelve el usuario de la sesión actual (para hidratación cliente). |
| `POST` | `/api/auth/register` | 🔲 Stub (501) | Registro real con IdP. Pendiente HU-12. |
| `POST` | `/api/auth/forgot-password` | 🔲 Stub (200 mock) | Recuperación de contraseña. Siempre responde 200 (no revela si el email existe). |
| `GET/POST/PATCH` | `/api/backend/*` | ✅ Activo | Proxy genérico al backend Express. Adjunta el JWT de la cookie. |
| `GET` | `/api/warmup` | ✅ Activo | Pega al backend para despertarlo (Render free tier). |

Los stubs tienen el contrato de request/response documentado en sus archivos para facilitar la integración futura.

---

## Rutas de la aplicación

| Ruta | Quién accede | Descripción |
|---|---|---|
| `/acceso` | Todos (sin sesión) | Login + signup + recuperación de contraseña |
| `/inicio` | Ciudadano | Home con mapa de emergencias y botón antipánico |
| `/mis-alertas` | Ciudadano | Listado de alertas propias con polling automático |
| `/mis-alertas/[id]` | Ciudadano | Detalle de alerta con historial de estados en tiempo real |
| `/perfil` | Ciudadano | Perfil, configuración, CTA de Sign Up |
| `/emergencia/nueva` | Ciudadano | Formulario de nueva emergencia |
| `/ops` | Dispatcher | Panel Kanban de gestión de emergencias ("Estados" restaurado) |
| `/ops/lista` | Dispatcher | Vista lista con métricas clickeables, búsqueda y ordenamiento |
| `/ops/mapa` | Dispatcher | Vista mapa de emergencias |
| `/ops/historial` | Dispatcher | Historial de emergencias con búsqueda, filtros y ordenamiento |
| `/ops/oficiales` | Dispatcher | Gestión de oficiales |

La redirección al home correcta por rol está en `app/lib/auth-roles.js → getHomePathForUser`.

---

## Vistas principales

### Ciudadano (`/inicio`, `/mis-alertas`)

- **Botón Antipánico:** `POST /api/backend/panic` con coordenadas reales del dispositivo (o fallback CABA). Si `hasAntipanicButton = false`, no se renderiza.
- **Mapa de emergencias:** Leaflet con marcadores de las emergencias propias del usuario.
- **Historial de estados en tiempo real (`/mis-alertas/[id]`):** Polling cada 5 s (`CITIZEN_POLLING_INTERVAL_MS`) para sincronizar el historial de estados (`statusHistory`) inmediatamente tras las operaciones del despachador, sin requerir recarga manual. Se suspende en segundo plano con `visibilitychange`.

### Dispatcher (`/ops`, `/ops/lista`, `/ops/historial`)

- **Tablero "Estados" (`/ops`):** Tablero Kanban restaurado accesible desde el navbar, alternando entre vista por Estado (7 columnas) y por Criticidad (3 columnas).
- **Polling optimizado:** Polling cada 60 s (`POLLING_INTERVAL_MS = 60_000`) en vistas operativas para prevenir sobrecarga innecesaria en el backend.
- **Tarjetas de métricas interactivas (`/ops/lista` y `/ops/historial`):** Los indicadores superiores (Total, Pendientes/Cerradas, Activas/Canceladas, Críticas, Descartadas) son clickeables y aplican/quitan filtros rápidamente (comportamiento toggle).
- **Controles de datos (Búsqueda y Ordenamiento):**
  - Barra de búsqueda reactiva multi-criterio en `/ops/lista` (ID, usuario, tipo, ubicación, estado) y `/ops/historial`.
  - Ordenamiento por columnas de 3 estados en `/ops/lista` y `/ops/historial`:
    - 1er clic: Ascendente (`▲`)
    - 2do clic: Descendente (`▼`)
    - 3er clic: Estado original (`○` círculo sutil)
- **Merge incremental:** solo agrega emergencias nuevas al estado local sin resetear.
- **Animación "NUEVO":** pulso rojo durante 6 s en tarjetas recién llegadas.
- **Asignar Oficial:** `GET /api/backend/officers` → modal de selección → `PATCH /api/backend/emergencies/:id`.
- **Herramienta de simulación:** `window.simularNuevaEmergencia("descripción", "high")` disponible en consola.

---

## Flujo de autenticación

```
[Login form]
    │  POST /api/auth/login { sub, groups, hasAntipanicButton, loginMethod }
    ▼
[BFF /api/auth/login]
    │  POST backend /auth/dev/login  →  { access_token }
    │  GET  backend /api/user        →  enriquece user (si disponible)
    │  Si ANTIPANIC_MODE="mock": sobrescribe hasAntipanicButton desde body
    │  Set-Cookie: citypass_session=<JWT>  (httpOnly, sameSite: lax)
    ▼
[Client]  router.replace( getHomePathForUser(user) )
    │      /inicio  →  ciudadano
    │      /ops     →  dispatcher
```

El campo `loginMethod` (`"sesion"` | `"anonima"`) es un dato **solo del frontend** (mock): se guarda en `sessionStorage` vía `api.js → fetchCurrentUser` para que el perfil sepa si mostrar el CTA de Sign Up.

---

## Perfil (`/perfil`) — lógica de Sign Up

| `loginMethod` | Botón "Sign Up" |
|---|---|
| `"anonima"` (cuenta ciudadana sin email) | Activo — redirige a `/acceso?signup=1` |
| `"sesion"` (login con credenciales) | Deshabilitado (gris) — ya tiene cuenta |

---

## Desarrollo desde otra máquina

Si corrés el dev server en una PC y accedés desde otra:

```js
// next.config.mjs
experimental: {
  allowedDevOrigins: ["192.168.X.X"],  // IP de la máquina desde la que accedés
}
```

Sin esto, Next.js 15 devuelve **403** en los chunks `/_next/*`: la página carga el HTML pero React nunca hidrata (botones muertos, sin errores visibles).

---

## Deploy

### Producción (Render)

El CD (`.github/workflows/cd.yml`) dispara el deploy hook en cada push a `main`.

Variables de entorno requeridas:

| Variable | Ejemplo | Descripción |
|---|---|---|
| `API_URL` | `https://emergencias-backend-34go.onrender.com` | URL del backend Express |
| `NODE_ENV` | `production` | Activa cookies `Secure` y build optimizado |
| `BACKEND_WARMUP_PATH` | `/health` | Ruta que pega `/api/warmup` para despertar el backend |
| `BACKEND_WARMUP` | (vacío / `off`) | Poner `off` cuando el backend sea always-on |

### Docker

```bash
docker build -t emergencias-frontend .
docker run --rm -p 3001:3001 -e API_URL=http://host.docker.internal:3000 emergencias-frontend
```

---

## Tests

```bash
npm test               # Vitest (modo watch)
npm run test:run       # Una sola ejecución (CI)
```

Los tests viven en `tests/`. Lógica de negocio pura (sin hooks) en `app/lib/emergencies.js` es candidata principal para cobertura.

---

## Estructura de archivos clave

```
Frontend/
├── middleware.js              # Protección de rutas (session guard)
├── lib/
│   ├── session.js             # JWT, cookie options, userFromJwt
│   ├── backend-fetch.js       # fetch con retry (cold start Render)
│   └── auth.js                # Re-exports de auth-roles
└── app/
    ├── acceso/
    │   └── AccesoForm.js      # Login / signup / forgot-password
    ├── api/
    │   └── auth/
    │       ├── login/         # POST — emite cookie de sesión
    │       ├── logout/        # POST — borra cookie
    │       ├── session/       # GET  — devuelve user actual
    │       ├── register/      # POST — stub 501 (HU-12)
    │       └── forgot-password/ # POST — stub mock 200
    ├── (citizen)/
    │   ├── inicio/            # Home ciudadano + botón antipánico
    │   ├── mis-alertas/       # Listado y detalle en tiempo real ([id])
    │   └── perfil/            # Perfil + CTA Sign Up
    ├── ops/                   # Vista dispatcher (Kanban "Estados", lista, mapa, historial)
    ├── components/
    │   ├── civic/             # MaterialIcon, PanicButton, etc.
    │   └── DispatcherView.js  # Kanban completo del dispatcher
    └── lib/
        ├── api.js             # Todos los fetch al BFF (loginDev, fetchEmergencies…)
        ├── auth-roles.js      # isDispatcher, isCitizen, getHomePathForUser
        ├── features.js        # Feature flags + DEMO_ACCOUNTS + DISPATCHER_DEMO
        └── emergencies.js     # Lógica de negocio pura (sin hooks)
```




---

<!-- ============================================================== -->
<!-- DOCUMENTACIÓN DEL PROYECTO CITYPASS+ - FRONTEND                  -->
<!-- ============================================================== -->

# CityPass+ — Frontend

Responsive Web App de gestión de servicios urbanos. Este repositorio contiene exclusivamente el **frontend**, construido con Next.js y Mantine UI.

## Deploy y Docker

### Producción (Render)

El frontend corre en Render como web service Node (ver `render.yaml`). El CD
(`.github/workflows/cd.yml`) dispara el deploy hook en cada push a `main`.

Variables de entorno del servicio:

| Variable | Valor | Para qué |
|---|---|---|
| `API_URL` | `https://emergencias-backend-34go.onrender.com` | URL del backend que usan el BFF y el login desde el servidor |
| `NODE_ENV` | `production` | Cookies `secure`, build optimizado |
| `BACKEND_WARMUP_PATH` | `/health` | Endpoint que pega `/api/warmup` para despertar el backend |
| `BACKEND_WARMUP` | (vacío) | Poner `off` cuando el backend sea always-on |

`next start` escucha en `$PORT` (Render lo define) y cae a 3001 en local.

### Docker

```bash
docker build -t emergencias-frontend .
docker run --rm -p 3001:3001 -e API_URL=http://host.docker.internal:3000 emergencias-frontend
# http://localhost:3001
```

`host.docker.internal` apunta al backend corriendo en la máquina host; si el
backend también está en Docker, usar el nombre del servicio de la red.

## Stack tecnológico

| Tecnología | Versión | Uso |
|---|---|---|
| **Next.js** | 16.3.3 | Framework React (App Router) |
| **React** | 19.2.8 | UI library |
| **Mantine** | latest | Sistema de componentes y CSS |
| **@tabler/icons-react** | latest | Iconografía |
| **PostCSS** | latest | Procesamiento CSS requerido por Mantine |

## Estructura de archivos

```
Frontend/
├── package.json               # Dependencias y scripts (npm run dev)
├── package-lock.json
├── next.config.mjs            # Configuración de Next.js
├── postcss.config.mjs         # PostCSS requerido por Mantine
├── eslint.config.mjs          # Configuración de ESLint
├── jsconfig.json              # Alias de paths para JS
├── AGENTS.md                  # Reglas para agentes IA (auto-generado por Next.js)
├── CLAUDE.md
├── README.md                  # Esta documentación
│
├── public/
│   └── Images/                # Assets estáticos (logos e imágenes del navbar)
│
└── app/
    ├── layout.js              # Root layout: MantineProvider (light), Notifications
    ├── page.js                # Orquestador: maneja rol (usuario/dispatcher) y navegac    ├── components/
    │   ├── Navbar.js             # Sidebar de navegación con secciones Servicios y Cuenta
    │   ├── PanicButton.js        # Botón de pánico (vista Usuario)
    │   ├── EmergencyCard.js      # Tarjeta individual de emergencia
    │   ├── DispatcherView.js     # Vista Dispatcher: tablero Kanban (estados/criticidad) + polling
    │   ├── ViewToggle.js         # Botón para alternar vistas (Estado vs Criticidad)
    │   └── AssignOfficerModal.js # Modal de asignación de oficial a emergencias validadas
    │
    └── lib/
        └── api.js                # Config backend, STATUS_CONFIG, SEVERITY_CONFIG, mocks, officers y fetch
```

## Vistas

### Vista Usuario (default)

- Página centrada con un **Panic Button** .
- Al presionar: hace `POST /api/panic-button` al backend con coordenadas aleatorias de CABA (lat −34.70 a −34.53, lng −58.53 a −58.35) y se deshabilita mientras envía.
- Al enviarse correctamente, muestra un toast con la respuesta real del backend (`ID <emergencyId> — lat X, lng Y`) y el botón se rehabilita solo a los 2 segundos, para poder disparar varias emergencias seguidas (comportamiento "por ahora", para demos).
- Si el envío falla, muestra un toast rojo con el mensaje de error del backend y el botón se rehabilita para reintentar.

**JSON de emergencia enviado:**

```json
{
  "userId": "user-123",
  "location": {
    "lat": -34.6037,
    "lng": -58.3816
  },
  "description": "Botón de pánico activado",
  "severity": "high"
}
```

### Vista Dispatcher

- Se accede haciendo clic en **"Mi Cuenta"** en el navbar (alterna entre Usuario y Dispatcher), o mediante el botón demo de la pantalla de login.
- **RF-01 (Polling periódico optimizado):** Implementa un `setInterval` que consulta periódicamente (cada 1 minuto / 60 segundos via `POLLING_INTERVAL_MS = 60_000`) las emergencias mediante `fetchEmergencies()` ejecutando un `GET /api/emergencies`.
- **RF-02 (Merge incremental en memoria):** Al recibir los datos, compara los IDs entrantes contra el estado en memoria y agrega únicamente los casos nuevos (`[...newItems, ...currentList]`), sin resetear ni sobrescribir las emergencias existentes que el Dispatcher ya está visualizando.
- **RF-03 (Re-render reactivo):** Al actualizarse el estado en memoria, la columna correspondiente (ej. *Pendientes*) y las métricas se re-renderizan automáticamente.
- **RF-04 (Animación de atención visual):** Aplica una animación temporal de parpadeo/pulso con reborde rojo y badge `"NUEVO"` a las tarjetas recién agregadas durante 6 segundos.
- **RF-05 (Botón Asignar Oficial):** Las tarjetas en estado `validada` renderizan exclusivamente un botón naranja *"Asignar Oficial"*.
- **RF-06 (Consulta de oficiales y Modal):** Al presionar *"Asignar Oficial"*, se realiza una consulta `GET /api/officers` y se abre un modal con los oficiales disponibles, su ubicación y distancia.
- **RF-07 (Confirmación y PATCH):** Al seleccionar un oficial y confirmar, se envía un `PATCH /api/emergencies/:id` con `{ officerId, status: "despachada", assignedOfficer }`.
- **RF-08 (Transición a Despachada):** Con respuesta exitosa (HTTP 200), el estado local de la emergencia se actualiza a `despachada`, moviéndose automáticamente a la columna **Despachadas** y exhibiendo el badge del oficial asignado.
- **Tarjetas de métricas interactivas y filtros (`/ops/lista` y `/ops/historial`):** Selección clickeable en métricas para filtrar emergencias y barra de búsqueda multi-campo reactiva.
- **Ordenamiento por columnas de 3 estados:** En encabezados de tabla (Ascendente `▲`, Descendente `▼`, Sin ordenar `○`).
- **Herramienta de simulación por consola:** Se expone `window.simularNuevaEmergencia(description, severity)` y `window.mockDatabase` para inyectar emergencias en vivo desde la consola del navegador y observar el flujo en tiempo real:
  ```javascript
  window.simularNuevaEmergencia("Incendio en depósito químico", "high");
  ```
- **Vistas Kanban alternables (RF-08, RF-09, RF-09.2):** Botón toggle para alternar entre **Emergencias por Estado** (7 columnas) y **Emergencias por Criticidad** (3 columnas con ancho 100%).
- **Scroll vertical independiente:** Cada columna cuenta con scroll interno para soportar decenas de emergencias sin romper el diseño del tablero.

## Integración con backend

Toda la lógica de comunicación está centralizada en `app/lib/api.js`.

### Configuración

```js
// app/lib/api.js
export const USE_BACKEND = true;                 // false = todo mockeado (sin backend)
export const POLLING_INTERVAL_MS = 60_000;       // intervalo de polling del dispatcher (1 min)
export const CITIZEN_POLLING_INTERVAL_MS = 5_000; // intervalo de polling del ciudadano (5 s)
```

**URL del backend:** no está hardcodeada. Se asume que el backend corre en la **misma máquina que el front, puerto 4000**, y se arma con el hostname con el que abriste la página (`http://<hostname>:4000/api`). Para apuntar a otro lado: `NEXT_PUBLIC_API_URL=http://otro-host:4000/api npm run dev`.

### Endpoints y Contratos

#### 1. `GET /api/emergencies`
Retorna el array de emergencias activas:
```json
[
  {
    "id": "em-001",
    "userId": "user-101",
    "description": "Accidente de tránsito en Av. Corrientes y Callao",
    "severity": "high",
    "status": "pendiente",
    "location": { "lat": -34.6042, "lng": -58.3922 },
    "timestamp": "2026-08-25T22:10:00-03:00"
  }
]
```

#### 2. `GET /api/officers`
Retorna el listado de oficiales disponibles para asignación:
```json
[
  {
    "id": "of-001",
    "name": "Oficial Carlos Gómez",
    "badgeNumber": "CP-4021",
    "location": "Av. 9 de Julio y Corrientes",
    "distance": "350 m",
    "status": "disponible"
  }
]
```

#### 3. `PATCH /api/emergencies/:id`
Asigna un oficial a una emergencia validada y actualiza su estado:
```json
{
  "officerId": "of-002",
  "status": "despachada",
  "assignedOfficer": "Oficial Mariana López"
}
```

### Niveles de severidad (`severity`)

| Clave | Color | Label |
|---|---|---|
| `high` | Naranja | Alta |
| `medium` | Amarillo | Media |
| `low` | Azul | Baja |

### Estados (`status`)

| Clave | Color | Label |
|---|---|---|
| `pendiente` | Rojo | Pendientes |
| `validada` | Naranja | Validadas |
| `despachada` | Amarillo | Despachadas |
| `en_camino` | Cian | En Camino |
| `en_lugar` | Índigo | En Lugar |
| `resuelta` | Verde azulado | Resuelta |
| `cerrada` | Gris | Cerrada |

## Desarrollo: dev server accedido desde otra máquina

Aprendizajes de correr el front en un server y abrirlo desde otra computadora:

- **Puerto:** `npm run dev -- -p 4001` si el 3000 está ocupado.
- **`allowedDevOrigins` es obligatorio para acceso por IP:** el dev server de Next 16 responde **403 en `/_next/*`** (los chunks de JS) cuando el host de la request no es `localhost`. El síntoma es traicionero: la página carga el HTML y se ve bien, pero React nunca hidrata — botones muertos, sin toasts, sin errores en pantalla; solo se ve en la consola del browser (`net::ERR_ABORTED 403` en los chunks y el websocket de HMR caído). La IP desde la que accedés tiene que estar en `allowedDevOrigins` en `next.config.mjs`.
- Los cambios en `next.config.mjs` requieren reiniciar el dev server (no los toma el hot reload).

## Tests

Hay dos suites de Vitest, separadas porque miden cosas distintas:

| | Unit (`tests/*.test.js`) | Integración (`tests/integration/*.test.js`) |
|---|---|---|
| Qué prueban | Funciones puras de `lib/**` y `app/lib/**` (JWT, sesión, fetch con reintentos, geocoding) | Los Route Handlers del BFF completos (`app/api/**/route.js`), invocados como funciones con un `Request` real |
| Config | `vitest.config.mjs` | `vitest.integration.config.mjs` |
| Cobertura | Sí, umbral 80% (ver "Scope del umbral" abajo — **no es 80% de toda la app**) | No corren con `--coverage`; no cuentan para el umbral de unit |
| Comando | `npm run test:coverage` (o `npm test` sin cobertura) | `npm run test:integration` |

Ambas corren en CI (`.github/workflows/ci.yml`, job `lint-and-test`): primero las unit con cobertura, después las de integración.

### Scope del umbral 80%

El threshold del 80% que aparece en `vitest.config.mjs` **no cubre toda la app**. Cubre solo librerías puras de JavaScript en dos carpetas:

- `lib/**/*.js` (funciones puras server-side / util)
- `app/lib/**/*.js` (funciones puras client-side / util)

Y de esas dos carpetas, quedan **excluidas** por diseño (`coverage.exclude` en `vitest.config.mjs`):

| Archivo | Motivo |
|---|---|
| `app/lib/auth.js` | Browser-only (`sessionStorage`, `window`), no unit-testable en node |
| `app/lib/api.js` | HTTP client con redirects de `window.location`, es concern de integración |
| `app/lib/geocoding.js` | Browser fetch + caché client-side, concern de integración |

> **Nota:** `app/lib/features.js` estuvo excluido mientras eran solo constantes. Se removió del exclude cuando se agregó `findDemoAccount()` (PR #38, Log-in-funcional) junto con `tests/features.test.js`. Cualquier lógica ejecutable nueva en ese archivo cae bajo el umbral del 80%.

Lo que **no está en el umbral en absoluto** (queda invisible para el gate del 80%):

- Componentes React (`app/components/**`) — sin tests unit
- Páginas (`app/**/page.js`, `app/**/layout.js`) — sin tests unit
- Route Handlers del BFF (`app/api/**/route.js`) — cubiertos por la suite de integración del BFF, que **no cuenta para el threshold**

**Respuesta canónica para la presentación:** el quality gate del 80% aplica **sobre librerías unitarias cubiertas** (`lib/**` + `app/lib/**` menos exclusiones), **no sobre todo el frontend**. Los componentes, páginas y Route Handlers tienen otra estrategia (integración BFF con mocks, sin threshold; deuda de E2E con Playwright para la UI real).

### Cómo agregar un caso de integración nuevo

Los tests de integración importan el handler directo desde su `route.js` y lo invocan con un `Request` de la Web API — no hay servidor HTTP levantado. Los helpers están en `tests/integration/helpers.js`:

- **`mockNextCookies(cookiesFn, initial?)`**: hay que declarar `vi.mock("next/headers", () => ({ cookies: vi.fn() }))` al principio del test (se hoistea, así que va antes de los imports) e importar `cookies` desde `next/headers`; después, en cada test, `mockNextCookies(cookies, { citypass_session: token })` deja un jar en memoria listo para leer/escribir/borrar esa cookie. Sin esto, `cookies()` de `next/headers` explota fuera de un request real de Next.
- **`mockBackend(routes)`**: reemplaza `global.fetch` por una tabla `"METODO /path": respuesta`. `respuesta` puede ser `{ status, body }` o un array de respuestas para simular una secuencia (por ejemplo `[502, 502, 200]` para probar los reintentos de `lib/backend-fetch.js`). Devuelve `{ calls }` para assertar sobre lo que el BFF le mandó al backend (headers, body, URL con query string incluida).
- **`makeRequest(url, { method, body, headers })`**: arma el `Request` que recibe el handler.

Un test típico:

```js
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
import { cookies } from "next/headers";
import { POST } from "../../app/api/auth/login/route.js";
import { mockNextCookies, mockBackend, makeRequest } from "./helpers.js";

it("caso nuevo", async () => {
  mockNextCookies(cookies);
  mockBackend({ "POST /auth/dev/login": { status: 200, body: { access_token: "..." } } });
  const res = await POST(makeRequest("http://localhost/api/auth/login", { method: "POST", body: {} }));
  expect(res.status).toBe(200);
});
```

Si una ruta nueva importa con el alias `@/...`, no hace falta nada extra: `vitest.integration.config.mjs` ya resuelve `@` a la raíz del proyecto (necesario porque `jsconfig.json` solo le sirve al editor, no a Vitest).

La suite de integración de hoy cubre login, session, el proxy `/api/backend/[...path]` y geocode como ejemplos — no es cobertura exhaustiva del BFF. Queda como deuda técnica agregar tests para `logout` y `warmup`, y tests end-to-end (Playwright) del flujo ciudadano completo y del dispatcher.

### Alcance actual y lo que NO está automatizado

Para no vender más de lo que hay, la matriz completa de lo que se testea automáticamente hoy es:

| Nivel | ¿Existe? | Detalle |
|---|---|---|
| **Unit** (funciones puras) | ✅ | Vitest con env `node`, umbral 80% sobre `lib/**` y `app/lib/**` (ver "Scope del umbral") |
| **Integración BFF** | ✅ | Vitest con `Request` reales, backend + cookies + `global.fetch` mockeados. No cuenta para el umbral. |
| **Component testing (browser)** | ❌ | No hay `@testing-library/react`, ni env `jsdom`/`happy-dom`, ni tests sobre componentes de `app/components/**` |
| **E2E / UI automatizado** | ❌ | No hay Playwright, Cypress, Selenium ni WebDriver. Sin script `test:e2e` en `package.json`. |
| **Smoke test contra Render** | ❌ | Ningún workflow ni comando dispara clicks contra la URL real del deploy |
| **Visual regression** | ❌ | Sin snapshots ni chromatic ni Percy |
| **Accessibility automatizado** | ❌ | Sin axe/pa11y en CI |

Antes de la demo se cubren manualmente por checklist (`npm run dev` local + revisión a ojo). Roadmap sugerido: agregar **Playwright** con 2-3 smoke tests que cubran login citizen + login dispatcher + POST panic-button, corriendo contra el backup site de Render en cada CI de main.

**Respuesta canónica para la presentación:** "Hoy la estrategia de testing automatizado es **unit + integración BFF**. E2E / component / smoke / visual / a11y son **deuda técnica reconocida**; la vía elegida para pagarla es Playwright." No decir "tests E2E" ni "browser testing" en el discurso hasta que exista al menos un `.spec.js` de Playwright en el repo.
