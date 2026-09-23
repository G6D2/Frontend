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
| **Vitest** | Tests unitarios (Quality Gate 80% sobre librerías) y de integración (BFF) |

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
- `middleware.js` actúa como **session guard** (valida existencia y vigencia de la sesión para redirigir a `/acceso` o al home correspondiente). **Toda la protección de roles y autorización reside en el backend**: el middleware del frontend no restringe rutas según el rol del usuario; la seguridad y control de acceso a los datos y operaciones se valida exclusivamente en el backend al verificar el JWT en cada petición.
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

> **Aclaración sobre roles y seguridad:** La tabla anterior refleja la asignación de vistas prevista a nivel de navegación y UX. El frontend no restringe rutas según el rol del usuario; **toda la protección de roles y autorización reside de forma estricta en el backend**, que valida los claims del JWT en cada petición.

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

## Tests y Calidad de Código

El frontend implementa una estrategia de pruebas que desacopla la lógica pura de la integración del BFF, aplicando un **Quality Gate del 80% exclusivamente sobre librerías unitarias**:

```bash
npm run test:coverage     # Tests unitarios con reporte (Quality Gate: 80% de cobertura sobre librerías)
npm run test:integration  # Tests de integración del BFF (Route Handlers en tests/integration/)
npm test                  # Tests unitarios en una sola corrida sin reporte de cobertura
npm run test:watch        # Tests unitarios en modo interactivo (watch)
```

> 📌 **Detalle de la estrategia:** Para consultar el alcance exacto del umbral del 80%, la documentación separada de los tests de integración del BFF y la declaración formal de deuda técnica por ausencia de tests E2E, dirigirse a la sección [Estrategia de testing, Quality Gate y Deuda Técnica](#estrategia-de-testing-quality-gate-y-deuda-técnica).

---

## Estructura de archivos clave

```
Frontend/
├── middleware.js              # Guard de sesión activa (la autorización de roles reside en el backend)
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

### Vista Usuario / Ciudadano (Botón de Pánico / SOS)

- **Comportamiento demostrable visualmente en la interfaz:**
  - El botón de pánico se ubica de forma central y destacada en `/inicio` (`app/(citizen)/inicio/InicioClient.js`).
  - Al presionarse, inicia una cuenta regresiva visible de 3 segundos con efecto visual pulsante.
  - El botón "Cancelar" se enfoca de inmediato en pantalla y permite interrumpir el conteo en cualquier momento (operable también mediante la tecla `Escape`).
  - La UI exhibe claramente las transiciones de estado: cuenta regresiva activa, indicador de envío y toasts de confirmación o fallo.
- **Geolocalización y despacho al backend:** Obtiene la posición real del dispositivo (con fallback CABA) y resuelve la dirección aproximada vía geocodificación inversa (`lib/geocoding.js`), enviando `POST /api/backend/panic` a través de `triggerPanicButton` en `app/lib/api.js`.
- **Lógica desacoplada y testeable:** La máquina de estados y timers del SOS reside en `app/lib/sosController.js`, testeada con timers simulados en `tests/sos-controller.test.js`.
- *(Alcance:* Se documentan únicamente los atributos observables y demostrables en la interfaz; no se declaran niveles de contraste certificados ni métricas formales de accesibilidad al no contar con mediciones automatizadas en el pipeline).*

**Payload de emergencia enviado al backend:**

```json
{
  "latitude": -34.6037,
  "longitude": -58.3816,
  "severity": "critical",
  "emergencyType": "panic",
  "address": "Av. Corrientes 1234, CABA"
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

**Decisión arquitectónica de sincronización:** Se adoptó **Polling periódico** como la **decisión arquitectónica actual** para la sincronización de estado (60 s en vistas operativas del dispatcher y 5 s en el detalle de alertas del ciudadano, con suspensión en segundo plano vía `document.visibilitychange`). Esta arquitectura prioriza simplicidad de despliegue, tolerancia a caídas temporales y bajo consumo de infraestructura sin mantener conexiones abiertas permanentes. La adopción de **Server-Sent Events (SSE) o WebSockets queda documentada como una evolución futura** para etapas posteriores donde el volumen de despacho o la concurrencia requieran streaming bidireccional o eventos push con latencia sub-segundo.

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

## Estrategia de testing, Quality Gate y Deuda Técnica

La arquitectura de pruebas del frontend está estructurada separando con claridad las responsabilidades de cada suite, estableciendo un **Quality Gate del 80% sobre librerías unitarias**, **documentando por separado los tests de integración del BFF** y **declarando formalmente la falta de tests E2E como deuda técnica**.

| Nivel | Qué evalúa | Configuración | Quality Gate / Umbral | Comando |
|---|---|---|---|---|
| **Unitario** | Funciones puras de lógica y utilidades (`lib/**`, `app/lib/**`) | `vitest.config.mjs` | **80% sobre librerías unitarias** (Statements, Branches, Functions, Lines) | `npm run test:coverage` |
| **Integración** | Route Handlers del BFF (`app/api/**/route.js`) con `Request` real | `vitest.integration.config.mjs` | Sin umbral de cobertura (validación funcional de endpoints) | `npm run test:integration` |
| **E2E / UI** | Flujos completos de usuario en navegador real | *Pendiente (Playwright)* | **Deuda técnica declarada** (sin tests automatizados actualmente) | *(Manual por checklist)* |

Ambas suites automatizadas corren en el pipeline de CI (`.github/workflows/ci.yml`, job `lint-and-test`): primero se ejecutan los tests unitarios verificando el cumplimiento estricto del umbral del 80%, y a continuación se ejecutan los tests de integración del BFF.

---

### 1. Tests Unitarios y Quality Gate (80% sobre librerías unitarias)

> [!IMPORTANT]
> **Definición del Quality Gate:** El umbral del 80% configurado en `vitest.config.mjs`, exigido en CI y reportado en SonarCloud aplica **exclusivamente sobre librerías unitarias** (`lib/**` y `app/lib/**`), **no sobre todo el frontend**.
>
> Afirmar que el frontend tiene un 80% de cobertura global es un error conceptual: los componentes visuales de React, las páginas y los layouts no forman parte de este umbral.

#### Scope del umbral 80%

El threshold del 80% en las 4 métricas (Statements, Branches, Functions, Lines) cubre de forma estricta la lógica de negocio pura y utilidades contenidas en:
- `lib/**/*.js`: funciones puras de servidor / utilidades de infraestructura (ej. decodificación de JWT y sesión en `session.js`, reintentos de cold start en `backend-fetch.js`, store reactivo en `backend-waiting-store.js`).
- `app/lib/**/*.js`: funciones puras de cliente sin acoplamiento a React (ej. cálculo de criticidades y estados en `emergencies.js`, banderas y cuentas demo en `features.js`, gestión de datos personales y ubicaciones guardadas).

#### Exclusiones del umbral de librerías
Incluso dentro de las carpetas de librerías, quedan **excluidas por diseño** (`coverage.exclude` en `vitest.config.mjs`) aquellos módulos acoplados al navegador o que corresponden conceptualmente a integración:

| Archivo excluido | Motivo de exclusión |
|---|---|
| `app/lib/auth.js` | Browser-only (`sessionStorage`, `window`), no unit-testable en entorno Node. |
| `app/lib/api.js` | Cliente HTTP acoplado a redirecciones de `window.location`; su comportamiento se valida en integración. |
| `app/lib/geocoding.js` | Fetch de cliente con caché en memoria del navegador; testeado mediante mocks de integración. |

> **Nota:** `app/lib/features.js` estuvo inicialmente excluido mientras contenía solo constantes estáticas. Tras agregarse la función utilitaria `findDemoAccount()` (PR #38, Log-in-funcional), se retiró del exclude y quedó formalmente bajo el umbral del 80% junto a su suite `tests/features.test.js`.

#### Elementos del frontend que NO están bajo el Quality Gate Unitario
Para total claridad técnica, lo siguiente queda fuera del umbral del 80% de unit tests:
- **Componentes React (`app/components/**`):** Botones, modales, vistas complejas (`DispatcherView.js`), tarjetas de emergencia. No cuentan con tests unitarios basados en DOM virtual.
- **Páginas y Layouts (`app/**/page.js`, `app/**/layout.js`):** Enrutamiento y estructura visual del App Router de Next.js.
- **Route Handlers (`app/api/**/route.js`):** Endpoints del BFF, cuya validación se realiza en la suite de integración sin cómputo de porcentaje de cobertura unitaria.
- **Configuración SonarCloud:** La propiedad `sonar.sources=lib,app/lib` en `sonar-project.properties` formaliza que el análisis estático y de cobertura del repositorio audita exclusivamente las librerías unitarias.

---

### 2. Tests de Integración del BFF (Documentados por separado)

Los tests de integración viven en `tests/integration/` y se gestionan como una **suite completamente separada** de los tests unitarios.

#### Propósito y diferenciación técnica
A diferencia de los tests unitarios que aíslan funciones puras, los tests de integración evalúan el funcionamiento completo de los **Route Handlers del BFF** (`app/api/**/route.js`).
Verifican:
- El procesamiento de peticiones HTTP invocando directamente los handlers exportados (`GET`, `POST`) con instancias reales de `Request` de la Web API.
- La lectura, emisión y borrado seguro de la cookie `citypass_session` (`httpOnly`, `sameSite: lax`).
- El reenvío transparente de peticiones y headers hacia el backend de Express (incluyendo `Authorization: Bearer <token>` e `Idempotency-Key`).
- La absorción de códigos de error y respuestas de contingencia (401 por sesión expirada, 502/503 por cold start de Render).

#### Configuración separada (`vitest.integration.config.mjs`)
Los tests de integración cuentan con su propia configuración dedicada:
- **Aislamiento de métricas:** No se ejecutan con `--coverage` ni aportan al threshold del 80% de unit tests, evitando distorsionar las métricas de lógica pura.
- **Resolución de alias `@/`:** Configura `resolve.alias` apuntando a la raíz del proyecto para resolver los imports absolutos de Next.js (`@/...`), necesario porque Vitest no utiliza el `jsconfig.json` del editor.
- **Entorno `node`:** Se ejecutan en Node.js sin necesidad de levantar un servidor HTTP en un puerto real, logrando máxima velocidad y reproducibilidad en CI.

Comando de ejecución:
```bash
npm run test:integration
```

#### Helpers de integración (`tests/integration/helpers.js`)
Para testear los Route Handlers fuera del runtime de Next.js, se utilizan helpers especializados:

1. **`mockNextCookies(cookiesFn, initial?)`:**
   Mapea `cookies()` de `next/headers` a un jar de cookies en memoria. Permite verificar que el handler lea (`get`), guarde (`set`) o destruya (`delete`) cookies como `citypass_session` sin requerir una conexión HTTP activa.
   > Se requiere declarar `vi.mock("next/headers", () => ({ cookies: vi.fn() }))` al tope del archivo de test.
2. **`mockBackend(routes)`:**
   Intercepta `global.fetch` para simular las respuestas del backend Express mediante un mapa `"METODO /path": respuesta`. Permite testear secuencias de respuestas (ej. `[502, 502, 200]` para comprobar los reintentos automáticos de `lib/backend-fetch.js`) y expone `{ calls }` para validar los headers, URLs y payloads enviados.
3. **`makeRequest(url, { method, body, headers })`:**
   Genera una instancia de `Request` estándar con body JSON y encabezados adecuados para pasarla directamente al Route Handler.

#### Cobertura actual de la suite de integración
La suite de integración actual cubre los siguientes flujos clave del BFF:
- **`login.test.js`:** Endpoint `POST /api/auth/login`. Valida la autenticación, la recepción del token del backend y la emisión de la cookie de sesión protegida.
- **`session.test.js`:** Endpoint `GET /api/auth/session`. Valida la lectura de la cookie activa y la devolución del usuario autenticado.
- **`backend-proxy.test.js`:** Proxy genérico `ALL /api/backend/[...path]`. Valida el reenvío de peticiones al backend agregando el token de sesión y tolerando fallos de red.
- **`geocode.test.js`:** Endpoints de geocodificación del BFF. Valida la normalización y respuesta de coordenadas.

#### Cómo agregar un caso de integración nuevo
Ejemplo estándar para probar un Route Handler:

```js
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
import { cookies } from "next/headers";
import { POST } from "../../app/api/auth/login/route.js";
import { mockNextCookies, mockBackend, makeRequest } from "./helpers.js";

it("autentica con éxito y emite cookie de sesión", async () => {
  mockNextCookies(cookies);
  mockBackend({
    "POST /auth/dev/login": { status: 200, body: { access_token: "jwt-de-prueba" } }
  });

  const res = await POST(makeRequest("http://localhost/api/auth/login", {
    method: "POST",
    body: { email: "ciudadano@demo.com", password: "pass" },
  }));

  expect(res.status).toBe(200);
});
```

---

### 3. Declaración de Deuda Técnica: Falta de Tests End-to-End (E2E)

> [!CAUTION]
> **Declaración formal de Deuda Técnica:**
> El proyecto reconoce y documenta de forma explícita la **ausencia de tests automatizados End-to-End (E2E) y de pruebas de componentes en navegador** como una **deuda técnica asumida**.

#### Justificación y contexto de la deuda
Durante los sprints del MVP se priorizó asegurar la lógica pura de negocio mediante el Quality Gate del 80% en librerías unitarias y la estabilidad de la capa de transporte mediante tests de integración del BFF.

La automatización de pruebas E2E con navegadores reales (Playwright/Cypress) requiere desplegar y orquestar en CI el entorno completo (base de datos relacional, backend en Express, servicio de Next.js y navegadores headless con soporte de WebSockets/polling). Esta inversión de tiempo fue postergada conscientemente para priorizar la funcionalidad completa del sistema.

#### Matriz de alcance actual y Deuda Técnica

| Nivel de prueba | ¿Está automatizado? | Situación en el repositorio |
|---|---|---|
| **Librerías Unitarias (funciones puras)** | ✅ Sí | Umbral obligatorio del 80% en CI sobre `lib/**` y `app/lib/**`. |
| **Integración BFF (Route Handlers)** | ✅ Sí | Suite independiente `tests/integration/` con mocks de cookies y backend. |
| **Componentes UI (React)** | ❌ No (**Deuda técnica**) | Sin `@testing-library/react` ni entorno `jsdom`/`happy-dom`. |
| **E2E / Interfaz en Navegador** | ❌ No (**Deuda técnica**) | Sin Playwright ni Cypress. Sin script `test:e2e` en `package.json`. |
| **Smoke test contra Producción** | ❌ No (**Deuda técnica**) | Sin scripts automáticos interactuando con la URL desplegada en Render. |
| **Regresión Visual y Accesibilidad** | ❌ No (**Deuda técnica**) | Sin snapshots (Percy/Chromatic) ni auditorías axe en CI. |

#### Mitigación actual (Validación Manual)
Previo a demostraciones y entregas, la interfaz gráfica y los flujos integrados se validan **manualmente** mediante un checklist de humo:
1. Verificación en entorno local (`npm run dev`): disparo del Botón Antipánico, visualización de alerta en el Kanban `/ops`, modal de asignación de oficial y descarte.
2. Verificación en despliegue activo (Render): inicio de sesión de roles demo, renderizado de mapas interactivos con Leaflet y toasts de Mantine Notifications.

#### Plan de pago de deuda técnica (Roadmap Playwright)
Para saldar esta deuda técnica, el roadmap del equipo contempla:
1. **Configuración de Playwright:** Incorporar `@playwright/test` y definir `playwright.config.js` con soporte para navegadores Chromium y Firefox.
2. **Implementación de 3 flujos críticos automatizados:**
   - **Flujo Ciudadano:** Inicio de sesión, activación del Botón Antipánico (SOS) y verificación de la alerta en `/mis-alertas`.
   - **Flujo Despachador:** Acceso al tablero Kanban `/ops`, movimiento de columnas de incidentes y asignación de oficiales.
   - **Flujo de Seguridad (Middleware):** Verificación de redirecciones al intentar acceder a rutas privadas sin cookie de sesión activa.
3. **Pipeline en CI:** Ejecución de smoke tests E2E contra el entorno de staging de Render en cada merge a la rama `main`.

---

### Resumen para revisiones técnicas y defensas
- **Quality Gate:** El 80% aplica **sobre librerías unitarias** (`lib/**` + `app/lib/**` menos exclusiones), **nunca sobre todo el frontend**.
- **Tests de Integración:** Se gestionan y documentan por separado; prueban el BFF sin estar atados al umbral de unit.
- **Tests E2E:** No existen en esta etapa; su ausencia está formalmente registrada como **deuda técnica asumida**, con Playwright como tecnología elegida para su pago.
