# Ubicaciones guardadas

Alta, edición y borrado de ubicaciones guardadas del ciudadano (Casa, Trabajo,
otra), persistidas en `localStorage` (`app/lib/saved-locations.js`, clave
`citypass_saved_locations`) hasta que exista un endpoint de perfil en el
backend.

## TODO

`app/(citizen)/reportar/ReportarClient.js` no tiene hoy un selector de
ubicación guardada al reportar un incidente (usa geolocalización automática
vía `getCurrentLocation` de `app/lib/api.js`). Cuando se agregue una forma de
elegir la ubicación al reportar, evaluar dejar elegir una de las ubicaciones
guardadas acá en vez de (o además de) la geolocalización automática. No se
tocó `ReportarClient.js` en este cambio para no pisar trabajo en curso sobre
ese archivo.
