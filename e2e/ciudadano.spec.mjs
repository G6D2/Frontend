import { expect, test } from "@playwright/test";
import { E2E_ADDRESS, GEOLOCATION } from "./support/env.mjs";
import { backendApi, createCitizenAccount, mockGeocoding } from "./support/backend.mjs";

// El botón de pánico pide la ubicación del navegador: se otorga el permiso
// con una ubicación fija.
test.use({ geolocation: GEOLOCATION, permissions: ["geolocation"] });

test("ciudadano: login, botón de pánico, Mis alertas, detalle y cancelar", async ({ page }) => {
  const api = await backendApi();
  const citizen = await createCitizenAccount(api, { withSos: true });
  await api.dispose();
  await mockGeocoding(page);

  const cancelReason = "Prueba e2e: fue una falsa alarma";
  let emergencyId;

  await test.step("entra con email y contraseña", async () => {
    await page.goto("/acceso");
    await page.getByLabel("Correo electrónico").fill(citizen.email);
    await page.getByLabel("Contraseña", { exact: true }).fill(citizen.password);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/inicio$/);
  });

  await test.step("toca el botón de pánico y espera la cuenta regresiva", async () => {
    // El botón late sin parar (animación pulse-sos, con scale): Playwright
    // nunca lo ve "estable", así que el click va sin esa espera.
    const sos = page.getByRole("button", { name: "Botón Antipánico" });
    await expect(sos).toBeVisible();
    await sos.click({ force: true });
    await expect(page.getByText(/Enviando en \d… tocá Cancelar para no enviar\./)).toBeVisible();
    // 3 s de cuenta regresiva y después el alta: la app abre el detalle.
    await expect(page).toHaveURL(/\/mis-alertas\/[0-9a-f-]{36}$/, { timeout: 15_000 });
    emergencyId = new URL(page.url()).pathname.split("/").pop();
    await expect(page.getByRole("heading", { name: "PENDIENTE" })).toBeVisible();
    await expect(page.getByText(E2E_ADDRESS)).toBeVisible();
  });

  await test.step("la alerta aparece en Mis alertas", async () => {
    await page.getByRole("link", { name: "Mis alertas", exact: true }).click();
    await expect(page).toHaveURL(/\/mis-alertas$/);
    await expect(page.getByRole("button", { name: "En curso (1)" })).toBeVisible();
    await expect(page.getByText("PENDIENTE", { exact: true })).toBeVisible();
  });

  await test.step("abre el detalle desde la lista", async () => {
    await page.getByRole("link", { name: /Ver detalles/ }).click();
    await expect(page).toHaveURL(new RegExp(`/mis-alertas/${emergencyId}$`));
    await expect(page.getByRole("heading", { name: "PENDIENTE" })).toBeVisible();
  });

  await test.step("cancela la asistencia con un motivo", async () => {
    await page.getByRole("button", { name: /Cancelar asistencia/ }).click();
    const dialog = page.getByRole("dialog", { name: "¿Cancelar la asistencia?" });
    await dialog.getByLabel("Motivo (opcional)").fill(cancelReason);
    await dialog.getByRole("button", { name: /Sí, cancelar asistencia/ }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading", { name: "CANCELADA" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Cancelar asistencia/ })).toHaveCount(0);
  });

  await test.step("la cancelación quedó guardada en el backend", async () => {
    // Recargar trae el detalle de nuevo del backend (el historial también).
    await page.reload();
    await expect(page.getByRole("heading", { name: "CANCELADA" })).toBeVisible();
    await expect(page.getByText(cancelReason)).toBeVisible();

    await page.getByRole("link", { name: "Mis alertas", exact: true }).click();
    await expect(page.getByRole("button", { name: "En curso (0)" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Finalizadas (1)" })).toBeVisible();
  });
});
