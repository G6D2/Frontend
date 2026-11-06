# CityPass+ Emergencias: frontend

Frontend del módulo **Emergencias y Seguridad** de CityPass+ (TPO de Desarrollo de Aplicaciones II, UADE, Grupo 6). Es una web app responsive en **Next.js 16.4.3 con App Router** que funciona como **BFF (Backend For Frontend)**: el navegador nunca le habla al backend directo. Todo pasa por los Route Handlers de `app/api/`, que guardan el JWT en una cookie `httpOnly` y lo reenvían al backend ([`G6D2/emergencias-backend`](https://github.com/G6D2/emergencias-backend)).

Este README describe lo que hace `main` hoy. Si algo de acá no coincide con el código, manda el código.

---

## Inicio rápido

Requisitos:

- **Node 22** (`engines: "22.x"`). En Node 24 también corre, pero `npm ci` avisa `EBADENGINE`.
- El backend corriendo en `http://localhost:3000` (su puerto por defecto), o `API_URL` apuntando a otro.

```bash
npm ci
npm run dev                                   # http://localhost:3001
API_URL=http://otro-host:3000 npm run dev     # backend en otro lado
```

| Script | Qué hace |
|---|---|
| `npm run dev` | Dev server en el puerto 3001 |
| `npm run build` / `npm start` | Build de producción y `next start` en `$PORT` (3001 si no está definido) |
| `npm run lint` | ESLint con `eslint-config-next` |
| `npm test` | Tests unitarios, una corrida |
| `npm run test:coverage` | Tests unitarios con cobertura y umbral del 80% |
| `npm run test:integration` | Tests de integración del BFF |
| `npm run test:watch` | Tests unitarios en modo watch |

---

## Stack

| Tecnología | Versión | Uso |
|---|---|---|
| Next.js (App Router) | 16.4.3 | Páginas, Route Handlers del BFF y `middleware.js` |
| React | 19.2.8 | UI |
| Mantine | 9.x | Layout, tablero kanban del dispatcher y notificaciones |
| Tailwind CSS | 4.x | Pantallas del ciudadano y del dispatcher (tokens en `globals.css`) |
| Leaflet | 1.9 | Mapa del dispatcher (`/ops/mapa`) |
| @tabler/icons-react y Material Symbols | | Iconos |
| Vitest | 4.x | Tests unitarios e integración del BFF (entorno `node`) |

---

## Arquitectura

```
Navegador ──► Next.js (este repo) ──────────────────────► Backend Express (emergencias-backend)
              │ middleware.js     guard de sesión y de rol
              │ /api/auth/*       login, registro, sesión, logout ──► /auth/login, /auth/dev/login,
              │                                                        /auth/register, /api/user
              │ /api/backend/*    proxy con el JWT de la cookie ───► /api/*
              │ /api/geocode      geocoding inverso con caché ─────► BigDataCloud, Nominatim de respaldo
              └ /api/warmup       despierta al backend dormido ────► BACKEND_WARMUP_PATH
```

- El JWT vive en la cookie `citypass_session` (`httpOnly`, `sameSite: lax`, `secure` en producción y vencimiento igual al `exp` del token). El JS del navegador no lo ve.
- El backend es la autoridad: verifica la firma del JWT y los `groups` en cada request. El middleware del front no verifica la firma: decide redirecciones mirando solo `exp` y `groups` (ver [Middleware](#middleware)).
- `lib/backend-fetch.js` reintenta 502, 503, 504 y errores de red hasta 6 veces, con 4 s entre intentos, para absorber el arranque en frío de Render.

---

## Variables de entorno

| Variable | Default | Para qué |
|---|---|---|
| `API_URL` | `http://localhost:3000` | URL base del backend, **sin `/api` y sin barra final**. El BFF le agrega el path completo: `/auth/login`, `/api/emergencies`, etc. (ver `lib/session.js`). Solo se lee en el servidor. |
| `NODE_ENV` | | En `production` la cookie de sesión sale con `secure`. |
| `PORT` | `3001` | Puerto de `npm start`. Render lo define solo. |
| `BACKEND_WARMUP_PATH` | `/` | Path que pega `/api/warmup`. En Render es `/health`. |
| `BACKEND_WARMUP` | | `off` desactiva `/api/warmup` (para cuando el backend sea always-on). |

`lib/session.js` todavía acepta `NEXT_PUBLIC_API_URL` como segundo fallback de `API_URL`. Es un resto viejo: no hace falta y no conviene usarlo.

---

## Páginas

`/` redirige a `/acceso`. Las columnas de acceso son las que aplica `middleware.js` (ver más abajo).

| Ruta | Quién entra | Qué hay |
|---|---|---|
| `/acceso` | Sin sesión (con sesión redirige al home del rol) | Login con email y contraseña, registro, recuperar contraseña y atajos demo |
| `/inicio` | Ciudadano | Botón SOS (solo si `hasAntipanicButton`) y acceso a reportar |
| `/reportar` | Ciudadano | Reporte de incidente por categoría: médica, incendio, infraestructura, disturbio o evento, otro |
| `/mis-alertas` | Ciudadano | Mis emergencias, refresco cada 5 s |
| `/mis-alertas/[id]` | Ciudadano | Detalle con historial de estados (refresco cada 5 s, pausado con la pestaña oculta) y cancelar con confirmación |
| `/perfil`, `/perfil/datos`, `/perfil/ubicaciones`, `/perfil/ayuda` | Ciudadano | Cuenta, datos personales y ubicaciones guardadas (en el backend, cifrados) y ayuda |
| `/ops` | Dispatcher | Tablero kanban (Mantine) con una columna por estado: validar, descartar y asignar oficial |
| `/ops/lista` | Dispatcher | Lista ordenada por prioridad, con métricas que filtran, búsqueda, orden por columna y panel de detalle |
| `/ops/asignar/[id]` | Dispatcher | Elegir oficial disponible para una emergencia validada |
| `/ops/mapa` | Dispatcher | Mapa Leaflet con las emergencias de `GET /api/emergencies` (hasta 100) |
| `/ops/historial` | Dispatcher | Emergencias cerradas, canceladas, descartadas y resueltas, en una sola llamada |
| `/ops/oficiales` | Dispatcher | Catálogo de oficiales y su estado |
| `/ops/cuenta` | Dispatcher | Mi cuenta y logout |
| `/ops/emergencias` | Dispatcher | Redirige a `/ops/lista` |

Las vistas del dispatcher (kanban, lista y mapa) refrescan cada 60 s (`POLLING_INTERVAL_MS`).

**No hay vistas de oficial.** El backend ya tiene el grupo `officer` y las rutas para que el oficial avance el estado (`en-route`, `on-scene`, `resolve`), pero el front no tiene pantallas ni código que las use. Un token de oficial cae en `/inicio`, como un ciudadano.

---

## BFF (`app/api/`)

| Método | Ruta | Qué hace |
|---|---|---|
| `POST` | `/api/auth/login` | Con `{email, password}` llama a `POST /auth/login`. Con `{sub, groups}` (atajos demo) llama a `POST /auth/dev/login`. Después completa el usuario con `GET /api/user` y setea la cookie. |
| `POST` | `/api/auth/register` | `POST /auth/register` con email, contraseña y nombre. Setea la cookie. |
| `GET` | `/api/auth/session` | Usuario de la sesión: `GET /api/user` o, si falla, los claims del JWT. |
| `POST` | `/api/auth/logout` | Borra la cookie. |
| `POST` | `/api/auth/forgot-password` | **Stub:** responde 200 siempre y no llama al backend. |
| `GET` `POST` `PUT` `PATCH` `DELETE` | `/api/backend/[...path]` | Proxy al backend (ver abajo). |
| `GET` | `/api/geocode?lat=&lng=` | Dirección legible de una coordenada (`lib/geocode-server.js`): caché de 24 h, agrupa pedidos iguales, BigDataCloud primero y Nominatim de respaldo. |
| `GET` | `/api/warmup` | Pega a `BACKEND_WARMUP_PATH` para despertar al backend. Lo llama `BackendWarmup` al cargar la app. |

### Proxy `/api/backend/[...path]`

- Exporta `GET`, `POST`, `PUT`, `PATCH` y `DELETE`. `HEAD` y `OPTIONS` no están exportados.
- `/api/backend/<path>?<query>` va a `${API_URL}/<path>?<query>` sin tocar el path. Por eso el front llama a `/api/backend/api/emergencies`, que termina en `/api/emergencies` del backend.
- Agrega `Authorization: Bearer <JWT de la cookie>` y reenvía `Content-Type`, `Idempotency-Key` y el body (salvo en GET y HEAD).
- Si la cookie no está o venció, responde 401 sin llamar al backend. Si el backend responde 401, borra la cookie.
- Reintenta 502, 503, 504 y errores de red en todos los métodos. En POST, PUT y PATCH genera un `Idempotency-Key` que se mantiene entre reintentos, pero **el backend hoy no lo usa**: si un POST llegó a procesarse antes del 502, el reintento puede duplicarlo.

Lo que el front consume por el proxy:

| Endpoint del backend | Desde |
|---|---|
| `POST /api/panic-button` | SOS de `/inicio` y reportes de `/reportar` |
| `GET /api/emergencies` (con `status`, `page`, `limit`, `sortBy`, `order`) y `GET /api/emergencies/:id` | Ciudadano y dispatcher |
| `PATCH /api/emergencies/:id/cancel` | Ciudadano, desde el detalle |
| `PATCH /api/emergencies/:id/validate`, `/discard`, `/assign` | Dispatcher |
| `GET /api/officers` (con `status=disponible` en el modal de asignar) | Dispatcher |
| `GET`/`PUT /api/citizen/profile` y `GET`/`POST`/`PATCH`/`DELETE /api/citizen/saved-locations` | Perfil del ciudadano |

El backend tiene más rutas que el front todavía no usa: `PATCH /api/emergencies/:id/close` y `/return` (dispatcher), `/en-route`, `/on-scene` y `/resolve` (oficial), `GET /api/incidents` y `GET /api/outbox-events`.

### Middleware

`middleware.js` corre en todas las rutas salvo `/_next/static`, `/_next/image` y las imágenes. Una sesión es válida si la cookie existe y el `exp` del JWT no venció (con 30 s de margen). No verifica la firma.

| Caso | Respuesta |
|---|---|
| `/api/backend/*` o `/api/auth/session` sin sesión válida | 401 JSON `{ error: "Unauthorized" }`. Si la cookie estaba pero vencida, la borra. |
| `/acceso` con sesión válida | Redirige al home del rol: `/ops` para el dispatcher y `/inicio` para cualquier otro grupo (ciudadano u oficial) |
| Ruta de ciudadano o de `/ops` sin sesión válida | Redirige a `/acceso` y borra la cookie vencida |
| `/ops/*` con sesión que no es de dispatcher (ciudadano, oficial o sin grupos) | Redirige a `/inicio` |
| `/inicio`, `/reportar`, `/mis-alertas/*` o `/perfil/*` con sesión de dispatcher | Redirige a `/ops` |
| Todo lo demás | Pasa |

El filtro por rol es de navegación: evita que cada usuario caiga en pantallas que no son suyas. La autorización real la hace el backend en cada request.

Dos cosas a tener en cuenta:

- `/api/geocode` no exige sesión. El comentario del route dice que sí, pero ni el middleware ni el route lo chequean.
- En Next 16 la convención `middleware` está deprecada en favor de `proxy` (`next build` lo avisa). Sigue funcionando y el renombre queda pendiente.

---

## Login y sesión

**Email y contraseña.** Es el login principal. `/acceso` llama a `/api/auth/login` con `{email, password}`, y el BFF lo manda a `POST /auth/login` del backend, que valida contra `auth_users` (contraseñas con bcrypt). El registro (`/api/auth/register`) crea el usuario y deja la sesión iniciada.

**Atajos demo** en `/acceso`:

| Atajo | Qué hace | Backend |
|---|---|---|
| Chip **JuanPanico** | Rellena `juanpanico@gmail.com` y la contraseña `abracadabra` | `POST /auth/login` |
| Chip **LuciaTranquila** | Rellena `luciatranquila@gmail.com` y `abracadabra` | `POST /auth/login` |
| **Iniciar con cuenta ciudadana** | Entra como `U000042` (ciudadano sin botón SOS) | `POST /auth/dev/login` con `sub` |
| **Vista Dispatcher** | Entra como `DISP-Demo001` (dispatcher) | `POST /auth/dev/login` con `sub` |

- **La contraseña demo está en el bundle de JS.** `fillDemo` en `app/acceso/AccesoForm.js` tiene `"abracadabra"` escrito en el código, así que cualquiera que abra las DevTools la ve. Son cuentas públicas de demo, sembradas por la migración V16 del backend. No reutilizar esa contraseña en ningún lado.
- `/auth/dev/login` exige `sub`. Con `NODE_ENV=production` o `DEV_LOGIN_STRICT=true` en el backend, solo acepta los `sub` de su allowlist demo (`U000042`, `CIT-JuanPanico`, `CIT-LuciaTranquila`, `DISP-Demo001`, `of-001` y `of-002`). Si no, acepta cualquiera.
- `hasAntipanicButton` sale del backend (`GET /api/user`) porque `ANTIPANIC_MODE = "backend"` en `app/lib/features.js`. El modo `"mock"` es solo para demos locales sin backend.
- `loginMethod` (`"sesion"` o `"anonima"`) existe solo en el front, en `sessionStorage`. No viaja al backend.

---

## Ciudadano y dispatcher

**SOS (`/inicio`).** Al tocar el botón arranca una cuenta regresiva de 3 s, cancelable con el botón o con Escape (`app/lib/sosController.js`). Después pide la ubicación del dispositivo y busca la dirección, con un tope de 2,5 s para no demorar la alerta, y manda:

```json
POST /api/backend/api/panic-button
{
  "location": { "latitude": -34.6037, "longitude": -58.3816 },
  "severity": "critical",
  "emergencyType": "panic",
  "address": "Av. Corrientes 1234, CABA"
}
```

- Si no hay geolocalización (sin permiso, sin soporte o timeout), la alerta se aborta y se avisa. Nunca se mandan coordenadas inventadas.
- `/reportar` usa el mismo endpoint con `emergencyType` `medical`, `fire`, `infrastructure`, `disturbance` u `other`. El backend los normaliza a su catálogo (`MEDICA`, `INCENDIO`, ...) y deriva la severidad del tipo: ignora el `severity` que manda el front.

**Estados.** Son los de la máquina de estados del backend (`src/domain/emergency-status.js`):

```
PENDING ──► VALIDATED ──► DISPATCHED ──► EN_ROUTE ──► ON_SCENE ──► RESOLVED ──► CLOSED
   │            │              │
   │            │              └──► VALIDATED   (devolver para reasignar)
   ├──► CANCELLED ◄──┘   (el ciudadano cancela desde PENDING o VALIDATED)
   └──► DISCARDED        (el dispatcher descarta desde PENDING)
```

Desde el front, el ciudadano cancela y el dispatcher valida, descarta y asigna oficial. `app/lib/emergencies.js` además acepta para mostrar algunos alias viejos que el backend no emite: `CREATED` (default de la tabla antes de la migración V5), `ON_SITE` y los nombres en minúscula y en castellano.

---

## Tests y cobertura

```bash
npm run test:coverage     # unitarios + cobertura con umbral del 80%
npm run test:integration  # integración del BFF
```

| Suite | Qué cubre | Config | Umbral |
|---|---|---|---|
| Unitarios | `lib/**`, `app/lib/**` (menos `app/lib/auth.js`, que depende de `sessionStorage`) y `middleware.js` | `vitest.config.mjs` | 80% en statements, branches, functions y lines |
| Integración del BFF | Route Handlers de `app/api/**` invocados con `Request` reales | `vitest.integration.config.mjs` | Sin umbral |

Números al 05/11/2026 (Node 22): **259 tests unitarios** en 15 archivos y **29 de integración** en 5. Cobertura de unit: **97,28% statements, 88,86% branches, 97,98% functions y 99,14% lines**. `middleware.js` está al 100%.

- Las dos suites corren en entorno `node` y pasan en Node 20, 22 y 24. Desde Node 21, `navigator` es un global de solo lectura: los tests que lo necesitan usan `vi.stubGlobal` y lo restauran con `vi.unstubAllGlobals()`.
- Los tests de integración (`tests/integration/`) mockean `global.fetch` (el backend) y `next/headers` (las cookies) con los helpers de `tests/integration/helpers.js`. No levantan servidor ni backend real. Cubren login (email y contraseña, y atajos demo con `sub`), registro, sesión, el proxy y geocode. Quedan sin test `logout`, `warmup` y `forgot-password`.
- El umbral del 80% es sobre las librerías y el middleware, no sobre todo el frontend. Los componentes React, las páginas y los layouts no tienen tests.
- SonarCloud analiza `lib` y `app/lib` (`sonar.sources` en `sonar-project.properties`). Todavía no incluye `middleware.js`.
- **Deuda declarada:** no hay tests E2E ni de componentes (ni Playwright ni Testing Library), ni smoke tests contra el deploy. Antes de cada demo se prueba a mano: login de cada rol, SOS, validar, asignar y descartar.

---

## CI/CD y deploy

- **CI** (`.github/workflows/ci.yml`) corre en cada PR a `main` y en cada push a `main`, sobre **Node 22**. Valida que el PR tenga título y descripción, y después corre `npm ci`, lint, build, tests unitarios con cobertura y tests de integración. Publica la cobertura en el resumen del run y en un comentario del PR. SonarCloud corre si existe `SONAR_TOKEN` y no bloquea. Si algo falla, avisa por mail.
- **CD** (`.github/workflows/cd.yml`) se dispara cuando termina un CI de un push a `main`. Si salió bien, llama al deploy hook de Render. No instala Node.
- **Activate backup** (`.github/workflows/activate-backup.yml`) es manual: despliega el frontend de respaldo y espera a que `/api/warmup` responda `warmed: true`.
- **Render** (`render.yaml`): build `npm ci && npm run build`, start `npm run start`, health check `/acceso`. Render toma la versión de Node de `engines` en `package.json` (`22.x`), salvo que el servicio tenga `NODE_VERSION` configurada.

Docker (la misma receta, con `node:22-alpine`):

```bash
docker build -t emergencias-frontend .
docker run --rm -p 3001:3001 -e API_URL=http://host.docker.internal:3000 emergencias-frontend
```

`host.docker.internal` apunta al backend que corre en la máquina host. Si el backend también corre en Docker, usar el nombre del servicio en la red.

---

## Dev server desde otra máquina

El dev server de Next responde **403 en `/_next/*`** cuando el host del request no es `localhost`. La página carga el HTML pero React nunca hidrata: los botones no hacen nada y no aparecen errores en pantalla, solo en la consola del navegador. La IP desde la que se accede tiene que estar en `allowedDevOrigins` de `next.config.mjs`, que hoy tiene la IP de Tailscale y la de la LAN del equipo. Los cambios en `next.config.mjs` requieren reiniciar el dev server.

---

## Estructura

```
├── middleware.js             guard de sesión y de rol
├── lib/                      solo servidor
│   ├── session.js            cookie, API_URL, lectura del JWT
│   ├── jwt.js                decode y vencimiento (sin verificar firma)
│   ├── backend-fetch.js      reintentos e Idempotency-Key
│   └── geocode-server.js     geocoding con caché y cola
├── app/
│   ├── acceso/               login, registro y atajos demo
│   ├── (citizen)/            inicio, reportar, mis-alertas, perfil
│   ├── ops/                  vistas del dispatcher
│   ├── api/                  BFF: auth, backend (proxy), geocode, warmup
│   ├── components/           componentes compartidos, civic/ y ops/
│   └── lib/                  lógica de cliente sin React: api.js, emergencies.js,
│                             features.js, sosController.js, auth-roles.js, ...
└── tests/                    unitarios; tests/integration/ es el BFF
```
