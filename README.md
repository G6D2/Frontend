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
    ├── page.js                # Orquestador: maneja rol (usuario/dispatcher) y navegación
    ├── styles.module.css      # CSS único: reset global + estilos navbar + tablero Kanban
    │
    ├── components/
    │   ├── Navbar.js          # Sidebar de navegación con secciones Servicios y Cuenta
    │   ├── PanicButton.js     # Botón de pánico (vista Usuario)
    │   ├── EmergencyCard.js   # Tarjeta individual de emergencia
    │   ├── DispatcherView.js  # Vista Dispatcher: tablero Kanban (estados/criticidad) + polling
    │   └── ViewToggle.js      # Botón para alternar vistas (Estado vs Criticidad)
    │
    └── lib/
        └── api.js             # Config backend, STATUS_CONFIG, SEVERITY_CONFIG, mocks y fetch
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
  "severity": "critical"
}
```

### Vista Dispatcher

- Se accede haciendo clic en **"Mi Cuenta"** en el navbar (alterna entre Usuario y Dispatcher).
- Incluye un botón en la esquina superior derecha para alternar entre dos vistas Kanban:
  1. **Emergencias por Estado (`STATUS_CONFIG`):** 7 columnas correspondientes al ciclo de vida (Pendientes, Validadas, Despachadas, En Camino, En Lugar, Resuelta, Cerrada).
  2. **Emergencias por Criticidad (`SEVERITY_CONFIG`):** 3 columnas (Baja, Media, Alta) que se expanden ocupando todo el ancho de la pantalla.
- **Scroll vertical interno en cada columna:** cuando una categoría tiene múltiples emergencias, la columna cuenta con scroll interno para que no se pierda detalle de las tarjetas ni se rompa el layout.
- **Navbar colapsable:** botón `<` en la barra lateral para ocultarla y ganar espacio de pantalla completa; botón flotante `>` en el extremo izquierdo para expandirla nuevamente.
- **Polling automático** cada 5 segundos para actualizar el listado de emergencias.

## Integración con backend

Toda la lógica de comunicación está centralizada en `app/lib/api.js`. El botón de pánico ya le pega al backend real ([emergencias-backend](https://github.com/G6D2/emergencias-backend)); la vista Dispatcher sigue usando mocks porque el backend todavía no tiene endpoint de listado.

### Configuración

```js
// app/lib/api.js
export const USE_BACKEND = true;         // false = todo mockeado (sin backend)
export const POLLING_INTERVAL_MS = 5000; // intervalo de polling del dispatcher
```

**URL del backend:** no está hardcodeada. Se asume que el backend corre en la **misma máquina que el front, puerto 4000**, y se arma con el hostname con el que abriste la página (`http://<hostname>:4000/api`). Esto es clave cuando el dev server corre en un server remoto y lo abrís por IP: si la URL fuera `localhost:4000`, el browser buscaría el backend en *tu* máquina, no en el server. Para apuntar a otro lado: `NEXT_PUBLIC_API_URL=http://otro-host:4000/api npm run dev`.

## Desarrollo: dev server accedido desde otra máquina

Aprendizajes de correr el front en un server y abrirlo desde otra computadora:

- **Puerto:** `npm run dev -- -p 4001` si el 3000 está ocupado.
- **`allowedDevOrigins` es obligatorio para acceso por IP:** el dev server de Next 16 responde **403 en `/_next/*`** (los chunks de JS) cuando el host de la request no es `localhost`. El síntoma es traicionero: la página carga el HTML y se ve bien, pero React nunca hidrata — botones muertos, sin toasts, sin errores en pantalla; solo se ve en la consola del browser (`net::ERR_ABORTED 403` en los chunks y el websocket de HMR caído). La IP desde la que accedés tiene que estar en `allowedDevOrigins` en `next.config.mjs`.
- Los cambios en `next.config.mjs` requieren reiniciar el dev server (no los toma el hot reload).

## Niveles de severidad

| Clave | Color | Label |
|---|---|---|
| `high` | Naranja | Alta |
| `medium` | Amarillo | Media |
| `low` | Azul | Baja |
