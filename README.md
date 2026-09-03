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
    ├── components/
    │   ├── Navbar.js             # Sidebar de navegación con secciones Servicios y Cuenta (rotación 3 roles)
    │   ├── PanicButton.js        # Botón de pánico (vista Usuario)
    │   ├── EmergencyCard.js      # Tarjeta individual de emergencia
    │   ├── DispatcherView.js     # Vista Dispatcher: tablero Kanban (estados/criticidad) + polling
    │   ├── ViewToggle.js         # Botón para alternar vistas (Estado vs Criticidad)
    │   ├── AssignOfficerModal.js # Modal de asignación de oficial a emergencias validadas
    │   └── OfficerView.js        # Vista Oficial: mapa táctico, información vital y patrullaje normal
    │
    └── lib/
        └── api.js                # Config backend, STATUS_CONFIG, SEVERITY_CONFIG, mocks, officers y fetch
```

## Vistas y Roles

Se alterna entre las tres vistas haciendo clic repetidamente en **"Mi Cuenta"** en el navbar:
`Usuario` ➔ `Dispatcher` ➔ `Oficial` ➔ `Usuario`

### 1. Vista Usuario (default)

- Página centrada con un **Panic Button**.
- Al presionar: hace `POST /api/panic-button` al backend con coordenadas aleatorias de CABA (lat −34.70 a −34.53, lng −58.53 a −58.35) y se deshabilita mientras envía.
- Al enviarse correctamente, muestra un toast con la respuesta real del backend (`ID <emergencyId> — lat X, lng Y`) y el botón se rehabilita solo a los 2 segundos para poder disparar varias emergencias seguidas.
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

### 2. Vista Dispatcher

- Tablero Kanban con dos modos de visualización: **Estados** (7 columnas) y **Criticidad** (3 columnas).
- **RF-01 (Polling periódico):** `setInterval` cada 5 segundos ejecutando `fetchEmergencies()` (`GET /api/emergencies`).
- **RF-02 (Merge incremental en memoria):** Compara IDs entrantes contra memoria y agrega únicamente casos nuevos (`[...newItems, ...currentList]`), sin reiniciar ni sobrescribir las existentes.
- **RF-03 (Re-render reactivo):** La columna correspondiente y métricas se re-renderizan automáticamente.
- **RF-04 (Animación de atención visual):** Parpadeo/pulso con reborde rojo y badge `"NUEVO"` durante 6 segundos.
- **RF-05 (Botón Asignar Oficial):** Las tarjetas en estado `validada` renderizan exclusivamente el botón naranja *"Asignar Oficial"*.
- **RF-06 (Consulta de oficiales y Modal):** Consulta `GET /api/officers` (o `MOCK_OFFICERS`) y abre un modal con oficiales disponibles, ubicación y distancia.
- **RF-07 (Confirmación y PATCH):** Envía `PATCH /api/emergencies/:id` con `{ officerId, status: "despachada", assignedOfficer }`.
- **RF-08 (Transición a Despachada):** Actualiza el estado local a `despachada`, moviendo la tarjeta a **Despachadas** con el badge del oficial asignado.

### 3. Vista Oficial en Terreno (OfficerView)

- **RF-01 (Carga de datos):** Al ingresar, ejecuta un `GET` a la API (`GET /api/officer/assigned-emergency`) enviando el token de sesión en la cabecera `Authorization: Bearer <token>` (con fallback automático a los mocks en `app/lib/api.js` buscando emergencias en estado `despachada` o `en_camino`).
  
  **Código exacto de consulta:**
  ```javascript
  // app/lib/api.js -> fetchAssignedEmergency()
  export async function fetchAssignedEmergency() {
    if (USE_BACKEND) {
      try {
        const sessionToken = "mock-officer-session-token";
        const res = await fetch(`${API_URL}/officer/assigned-emergency`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
        });
        if (res.ok) {
          return await res.json();
        }
      } catch {
        // Fallback a mocks
      }
    }
    return MOCK_EMERGENCIES.find(
      (e) => e.status === "despachada" || e.status === "en_camino"
    ) || null;
  }
  ```

- **RF-02 (Renderizado de Mapa):** Si hay una emergencia asignada, se reserva un contenedor en blanco de 360px donde se integrará la librería de mapas.
  *(Incluye el comentario `// TODO: Integrar Leaflet.js o Google Maps API con marcador interactivo en coords: lat, lng` para la futura integración del mapa).*

- **RF-03 (Información Vital):** Debajo del mapa, renderiza dinámicamente:
  - **Tipo de incidente / Descripción**
  - **Nivel de prioridad / Severidad** (`Baja`, `Media`, `Alta`)
  - **Dirección y Coordenadas GPS**
  - **Identificador de emergencia y datos del reportante / hora**
  - **Botón de acción:** Botón centrado *"Pedir Refuerzos"* (color rojo) que eleva automáticamente la criticidad de la emergencia a `High` independientemente de su valor original.

- **RF-04 (Estado Vacío / Fallback):** Si el oficial no tiene ninguna emergencia asignada (`null`), oculta el mapa y muestra el componente visual de estado vacío con un escudo verde y el mensaje:
  > **"Patrullaje normal - Sin emergencias asignadas"**  
  > *Actualmente no tienes incidentes despachados a tu unidad. Mantén el patrullaje preventivo y la comunicación abierta con el centro de despacho.*

- **Simulaciones por consola:**
  ```javascript
  // Simular oficial SIN emergencias (activa estado vacío de patrullaje normal)
  window.simularAsignacionOficial(false);

  // Simular oficial CON emergencia asignada
  window.simularAsignacionOficial(true);
  ```

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
Retorna el listado de oficiales disponibles para asignación.

#### 3. `GET /api/officer/assigned-emergency`
Retorna la emergencia actualmente asignada al oficial autenticado (o `null`):
```json
[
{
  "id": "em-002",
  "userId": "user-205",
  "description": "Incendio en edificio residencial, piso 3",
  "severity": "medium",
  "status": "despachada",
  "location": {
    "lat": -34.6118,
    "lng": -58.3816
  },
  "timestamp": "2026-08-25T22:15:00-03:00",
  "assignedOfficer": "Oficial Carlos Gómez"
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
