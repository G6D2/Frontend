import { expect, test } from "@playwright/test";
import { LDAP_PASSWORD } from "./support/env.mjs";
import {
  backendApi,
  devLogin,
  getEmergency,
  mockGeocoding,
  patchEmergency,
  reportEmergency,
  uniqueId,
} from "./support/backend.mjs";

// Datos del test: un vecino nuevo reporta dos emergencias por la API; el
// dispatcher (también nuevo) valida y despacha una y descarta la otra.
const tag = uniqueId("e2e");
const dispatcherUser = uniqueId("e2e-dispatcher");
const cleanup = { reporterToken: null, dispatchedId: null };

test.afterAll(async () => {
  // Deja el backend como estaba: devuelve la emergencia despachada (libera al
  // oficial, que si no queda "ocupado" en una base local que se reusa) y la
  // cancela para que no quede abierta en el tablero.
  if (!cleanup.dispatchedId) return;
  const api = await backendApi();
  const dispatcherToken = await devLogin(api, { sub: dispatcherUser, groups: ["dispatcher"] });
  await patchEmergency(api, dispatcherToken, cleanup.dispatchedId, "return", { reason: "Limpieza e2e" });
  await patchEmergency(api, cleanup.reporterToken, cleanup.dispatchedId, "cancel", { reason: "Limpieza e2e" });
  await api.dispose();
});

test("dispatcher: login, kanban, validar, asignar oficial y descartar con motivo", async ({ page }) => {
  const api = await backendApi();
  const reporterToken = await devLogin(api, { sub: uniqueId("e2e-vecino"), groups: ["citizen"] });
  cleanup.reporterToken = reporterToken;
  const toDispatch = await reportEmergency(api, reporterToken, {
    emergencyType: "medical",
    description: `${tag} persona descompensada en la vereda`,
  });
  const toDiscard = await reportEmergency(api, reporterToken, {
    emergencyType: "fire",
    description: `${tag} humo en un balcón`,
  });
  await mockGeocoding(page);

  // Cada tarjeta del kanban se busca por la descripción única de este test.
  // El tablero de celular también está en el DOM (oculto en escritorio).
  const card = (emergency) =>
    page.getByTestId("emergency-card").filter({ hasText: emergency.description, visible: true });
  const discardReason = "Prueba e2e: era el humo de una parrilla";

  await test.step("entra por la solapa Personal (LDAP) con el Login Federado simulado", async () => {
    await page.goto("/acceso");
    await page.locator("#tab-acceso-ldap").click();
    await page.getByLabel("Usuario LDAP / Correo institucional").fill(dispatcherUser);
    await page.getByLabel("Contraseña", { exact: true }).fill(LDAP_PASSWORD);
    await page.getByRole("button", { name: /Ingresar a Dispatcher View/ }).click();
    await expect(page).toHaveURL(/\/ops$/);
  });

  await test.step("el kanban muestra las dos emergencias pendientes", async () => {
    await expect(page.getByRole("heading", { name: "Emergencias por Estado" })).toBeVisible();
    for (const emergency of [toDispatch, toDiscard]) {
      await expect(card(emergency)).toHaveCount(1);
      await expect(card(emergency).getByRole("button", { name: "Validar" })).toBeVisible();
      await expect(card(emergency).getByRole("button", { name: "Descartar" })).toBeVisible();
    }
  });

  await test.step("valida una emergencia", async () => {
    await card(toDispatch).getByRole("button", { name: "Validar" }).click();
    await expect(page.getByText("Emergencia validada")).toBeVisible();
    await expect(card(toDispatch).getByRole("button", { name: "Asignar Oficial" })).toBeVisible();
    await expect(card(toDispatch).getByRole("button", { name: "Validar" })).toHaveCount(0);
  });

  await test.step("le asigna un oficial disponible", async () => {
    await card(toDispatch).getByRole("button", { name: "Asignar Oficial" }).click();
    const dialog = page.getByRole("dialog", { name: /Asignar Oficial a Emergencia/ });
    await expect(dialog.getByText(toDispatch.description)).toBeVisible();
    // El modal preselecciona el primer oficial disponible.
    await expect(dialog.getByRole("radio").first()).toBeChecked();
    const officerName = (await dialog.getByText(/^Oficial /).first().textContent()).trim();
    await dialog.getByRole("button", { name: /Confirmar Asignación/ }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Oficial Asignado")).toBeVisible();
    await expect(card(toDispatch).getByText(officerName)).toBeVisible();
    await expect(card(toDispatch).getByRole("button", { name: "Asignar Oficial" })).toHaveCount(0);
    cleanup.dispatchedId = toDispatch.id;
  });

  await test.step("descarta la otra con un motivo", async () => {
    await card(toDiscard).getByRole("button", { name: "Descartar" }).click();
    const dialog = page.getByRole("dialog", { name: "Descartar emergencia" });
    const confirm = dialog.getByRole("button", { name: "Descartar", exact: true });
    await expect(confirm).toBeDisabled(); // el motivo es obligatorio
    await dialog.getByRole("textbox").fill(discardReason);
    await confirm.click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Emergencia descartada")).toBeVisible();
    await expect(card(toDiscard)).toHaveCount(0);
  });

  await test.step("la lista y el historial muestran quién hizo cada cambio", async () => {
    // El panel de detalle de escritorio: el bottom sheet también está en el DOM.
    const entries = () => page.getByTestId("history-entry").filter({ visible: true });
    const byDispatcher = `Por Dispatcher (${dispatcherUser})`;

    await page.goto("/ops/lista");
    await page.locator("#ops-lista-search").fill(toDispatch.id);
    await page.locator("tbody tr").filter({ hasText: "DESPACHADA" }).click();
    await expect(entries()).toHaveCount(2);
    await expect(entries().nth(0)).toContainText("VALIDADA");
    await expect(entries().nth(0)).toContainText(byDispatcher);
    await expect(entries().nth(1)).toContainText("DESPACHADA");
    await expect(entries().nth(1)).toContainText("Se asignó un oficial");
    await expect(entries().nth(1)).toContainText(byDispatcher);

    await page.goto("/ops/historial");
    await page.locator("#historial-search").fill(toDiscard.id);
    await page.locator("tbody tr").filter({ hasText: "DESCARTADA" }).click();
    await expect(entries()).toHaveCount(1);
    await expect(entries().first()).toContainText("DESCARTADA");
    await expect(entries().first()).toContainText(discardReason);
    await expect(entries().first()).toContainText(byDispatcher);
  });

  await test.step("el backend guardó el despacho y el descarte con su motivo", async () => {
    const token = await devLogin(api, { sub: dispatcherUser, groups: ["dispatcher"] });
    const dispatched = await getEmergency(api, token, toDispatch.id);
    expect(dispatched.status).toBe("DISPATCHED");
    expect(dispatched.assignedOfficerId).toBeTruthy();

    const discarded = await getEmergency(api, token, toDiscard.id);
    expect(discarded.status).toBe("DISCARDED");
    expect(discarded.statusHistory.at(-1)).toMatchObject({
      newStatus: "DISCARDED",
      reason: discardReason,
      actor: dispatcherUser,
    });
  });

  await api.dispose();
});
