# Ubicaciones guardadas

Alta, edición y borrado de ubicaciones frecuentes del ciudadano vía
`GET/POST/PATCH/DELETE /api/citizen/saved-locations` (backend cifrado en
reposo). El front solo limpia restos legacy de `localStorage`
(`citypass_saved_locations`) si quedaban de versiones anteriores.

## TODO

`app/(citizen)/reportar/ReportarClient.js` no tiene hoy un selector de
ubicación guardada al reportar un incidente (usa geolocalización automática
vía `getCurrentLocation` de `app/lib/api.js`). Cuando se agregue, evaluar
elegir una de estas ubicaciones además de / en vez de la geolocalización
automática.
