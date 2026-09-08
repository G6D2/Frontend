This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

---

<!-- ============================================================== -->
<!-- DOCUMENTACIÓN DEL PROYECTO CITYPASS+ - FRONTEND                  -->
<!-- ============================================================== -->

# CityPass+ — Frontend

Aplicación de gestión de servicios urbanos. Este repositorio contiene exclusivamente el **frontend**, construido con Next.js y Mantine UI.

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

- Se accede haciendo clic en **"Mi Cuenta"** en el navbar (alterna entre Usuario y Dispatcher).
- **RF-01 (Polling periódico):** Implementa un `setInterval` que consulta periódicamente (cada 5 segundos configurables) las emergencias mediante `fetchEmergencies()` ejecutando un `GET /api/emergencies`.
- **RF-02 (Merge incremental en memoria):** Al recibir los datos, compara los IDs entrantes contra el estado en memoria y agrega únicamente los casos nuevos (`[...newItems, ...currentList]`), sin resetear ni sobrescribir las emergencias existentes que el Dispatcher ya está visualizando.
- **RF-03 (Re-render reactivo):** Al actualizarse el estado en memoria, la columna correspondiente (ej. *Pendientes*) y las métricas se re-renderizan automáticamente.
- **RF-04 (Animación de atención visual):** Aplica una animación temporal de parpadeo/pulso con reborde rojo y badge `"NUEVO"` a las tarjetas recién agregadas durante 6 segundos.
- **RF-05 (Botón Asignar Oficial):** Las tarjetas en estado `validada` renderizan exclusivamente un botón naranja *"Asignar Oficial"*.
- **RF-06 (Consulta de oficiales y Modal):** Al presionar *"Asignar Oficial"*, se realiza una consulta `GET /api/officers` (o fallback a `MOCK_OFFICERS`) y se abre un modal con los oficiales disponibles, su ubicación y distancia.
- **RF-07 (Confirmación y PATCH):** Al seleccionar un oficial y confirmar, se envía un `PATCH /api/emergencies/:id` con `{ officerId, status: "despachada", assignedOfficer }`.
- **RF-08 (Transición a Despachada):** Con respuesta exitosa (HTTP 200), el estado local de la emergencia se actualiza a `despachada`, moviéndose automáticamente a la columna **Despachadas** y exhibiendo el badge del oficial asignado.
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
export const USE_BACKEND = true;         // false = todo mockeado (sin backend)
export const POLLING_INTERVAL_MS = 5000; // intervalo de polling del dispatcher
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
