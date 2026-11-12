import { test, expect } from "@playwright/test";

test("navegación, simulación persistida, comparación y notebook", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByText("API operativa")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "SIMURGENCIAS",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Modelo DES", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Flujo del proceso" }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Simulación", exact: true })
    .click();
  const runResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/simulations/run") &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Ejecutar simulación", exact: true })
    .click();
  const actualRun = await (await runResponse).json();
  await expect(
    page.getByRole("heading", { name: "Evolución de la cola" }),
  ).toBeVisible();
  await expect(
    page.getByText("Experimento completado y guardado en PostgreSQL."),
  ).toBeVisible();
  const number = (v: number) =>
    new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format(v);
  await expect(
    page.locator(".metric").filter({ hasText: "p95 espera de pacientes" }),
  ).toContainText(number(actualRun.metrics.p95_wait_minutes));
  await expect(
    page.locator(".metric").filter({ hasText: "Throughput de egreso" }),
  ).toContainText(number(actualRun.metrics.throughput_per_hour));
  await page.getByRole("button", { name: "Comparar este escenario" }).click();
  await expect(page.locator(".comparison-chart").first()).toBeVisible();
  await expect(page.locator(".comparison-chart svg").first()).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar JSON" }).click();
  expect((await downloadEvent).suggestedFilename()).toMatch(
    /simurgencias-.+\.json/,
  );
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Teoría de colas", exact: true })
    .click();
  await page.getByRole("button", { name: "Calcular M/M/c" }).click();
  await expect(page.locator(".theory-output")).toContainText("0,75");
  await expect(page.getByText("L observado", { exact: true })).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Laboratorio SimPy", exact: true })
    .click();
  await expect(page.locator(".notebook-cell")).toHaveCount(12);
  const notebookEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar .ipynb" }).click();
  expect((await notebookEvent).suggestedFilename()).toBe(
    "SIMURGENCIAS_Entrega_1.ipynb",
  );
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Documentación", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Contratos principales" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("gestión de paciente sintético y transición", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("API operativa")).toBeVisible();
  const code = `E2E-${Date.now()}`;
  await page.getByLabel("Código sintético").fill(code);
  await page.getByRole("button", { name: "Registrar ingreso" }).click();
  const row = page.getByRole("row").filter({ hasText: code });
  await expect(row).toContainText("Ingreso");
  await row.getByRole("button", { name: "Triage" }).click();
  await expect(row.getByRole("button", { name: "Espera" })).toBeVisible();
});

test("vista móvil sin desbordamiento", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Simulación", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Ejecutar simulación", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
