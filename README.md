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
<!-- DOCUMENTACIÓN DEL PROYECTO CITYPLUS - FRONTEND                  -->
<!-- ============================================================== -->

# CityPlus — Frontend

Aplicación de gestión de servicios urbanos. Este repositorio contiene exclusivamente el **frontend**, construido con Next.js y Mantine UI.

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
└── app/
    ├── layout.js              # Root layout: MantineProvider (light), Notifications
    ├── page.js                # Orquestador: maneja rol (usuario/dispatcher) y navegación
    ├── styles.module.css      # CSS único: reset global + estilos del navbar
    │
    ├── components/
    │   ├── Navbar.js          # Sidebar de navegación con secciones Servicios y Cuenta
    │   ├── PanicButton.js     # Botón de pánico (vista Usuario)
    │   ├── EmergencyCard.js   # Tarjeta individual de emergencia
    │   └── DispatcherView.js  # Vista Dispatcher: lista de emergencias + polling
    │
    └── lib/
        └── api.js             # Config backend, mock data, helpers de fetch
```

## Vistas

### Vista Usuario (default)

- Página centrada con un **Panic Button** .
- Al presionar: envía un JSON de emergencia y se deshabilita para evitar duplicados.
- Si el envío falla, el botón se rehabilita para reintentar.
- Al enviarse correctamente, aparece un tooltip "Request sent!" y una notificación toast.

**JSON de emergencia enviado:**

```json
{
  "userId": "user-123",
  "location": {
    "lat": -34.6037,
    "lng": -58.3816
  },
  "description": "Necesito ayuda inmediata",
  "severity": "critical"
}
```

### Vista Dispatcher

- Se accede haciendo clic en **"Mi Cuenta"** en el navbar (alterna entre Usuario y Dispatcher).
- Muestra un listado FIFO de tarjetas de emergencia con:
  - Icono de alerta coloreado por severidad
  - Badge de severidad (Crítica, Alta, Media, Baja)
  - Descripción de la emergencia
  - ID y usuario que reportó
- **Polling automático** cada 5 segundos para obtener emergencias activas.
- Al cargar la vista, realiza un GET inicial para obtener el listado.

## Integración con backend

El frontend está preparado para conectarse a un backend real. Toda la lógica de comunicación está centralizada en `app/lib/api.js`.

### Toggle de backend

```js
// app/lib/api.js
export const USE_BACKEND = false;                          // ← cambiar a true
export const API_URL = "https://your-backend-url.com/api"; // ← URL real del backend
export const POLLING_INTERVAL_MS = 5000;                   // ← intervalo de polling
```
## Niveles de severidad

| Clave | Color | Label |
|---|---|---|
| `critical` | Rojo | Crítica |
| `high` | Naranja | Alta |
| `medium` | Amarillo | Media |
| `low` | Azul | Baja |
