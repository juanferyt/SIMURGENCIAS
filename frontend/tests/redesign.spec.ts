import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const evidence = "../docs/pedagogy/regression";
const number = (v: number) =>
  new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format(v);
test("corrida real: fidelidad, persistencia, pacientes y comparación", async ({
  page,
  request,
}) => {
  await page.goto("/#Simulaci%C3%B3n");
  await expect(page.getByText("PostgreSQL conectado")).toBeVisible();
  await page.getByLabel("Semilla aleatoria").fill("42");
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/simulations/run") &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Ejecutar simulación", exact: true })
    .click();
  const run = await (await response).json();
  await expect(page.locator(".metric")).toHaveCount(5);
  await expect(
    page.locator(".metric").filter({ hasText: "Espera de consulta" }),
  ).toContainText(number(run.metrics.mean_wait_minutes));
  await expect(
    page.locator(".metric").filter({ hasText: "Utilización médica" }),
  ).toContainText(number(run.metrics.doctor_utilization * 100));
  const persisted = await request.get(`/api/simulations/${run.id}`);
  expect(await persisted.json()).toEqual(run);
  const repeatResponse = await request.post("/api/simulations/run", {
    data: run.config,
  });
  const repeated = await repeatResponse.json();
  expect(repeated.metrics).toEqual(run.metrics);
  expect(repeated.patients).toEqual(run.patients);
  await page.getByRole("tab", { name: "Pacientes", exact: true }).click();
  const first = run.patients[0];
  await expect(
    page.locator("main table").first().locator("tbody tr").first(),
  ).toContainText(number(first.arrival));
  await page
    .getByRole("navigation", { name: "Principal" })
    .getByRole("button", { name: "Historial", exact: true })
    .click();
  await page
    .getByRole("button", { name: `Abrir corrida ${run.id.slice(0, 8)}` })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Resultados de simulación",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".result-meta")).toContainText(run.id.slice(0, 8));
  const compareResponse = page.waitForResponse((r) =>
    r.url().endsWith("/api/simulations/compare"),
  );
  await page.getByRole("button", { name: "Comparar este escenario" }).click();
  const comparison = await (await compareResponse).json();
  await expect(page.locator(".comparison-chart")).toHaveCount(3);
  for (const scenario of comparison.scenarios) {
    const row = page
      .getByRole("row")
      .filter({
        has: page.locator("td:first-child", {
          hasText: new RegExp(`^${scenario.config.doctors}$`),
        }),
      });
    await expect(row.first()).toContainText(
      number(scenario.metrics.mean_wait_minutes),
    );
  }
  await mkdir(evidence, { recursive: true });
  await page.setViewportSize({width:1366,height:768});
  await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Comparar escenarios',exact:true}).click();
  await page.screenshot({path:`${evidence}/comparacion-real-1366.png`,fullPage:true});
  await writeFile(
    `${evidence}/real-validation.json`,
    JSON.stringify(
      {
        health: await (await request.get("/api/health")).json(),
        id: run.id,
        config: run.config,
        metrics: run.metrics,
        persistedExactly: true,
        repeatedMetricsExactly: true,
        repeatedPatientsExactly: true,
        scenarios: comparison.scenarios.map((r: any) => ({
          id: r.id,
          doctors: r.config.doctors,
          metrics: r.metrics,
        })),
      },
      null,
      2,
    ),
  );
});

test("once páginas en cinco resoluciones y capturas", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const pages = [
    "Inicio",
    "Simulación",
    "Resultados",
    "Historial",
    "Comparar escenarios",
    "Teoría",
    "Telemetría",
    "Modelo",
    "Laboratorio",
    "Metodología",
    "Documentación",
  ];
  await mkdir(evidence, { recursive: true });
  for (const [width, height] of [
    [1920, 1080],
    [1366, 768],
    [1024, 768],
    [768, 1024],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(page.getByText("PostgreSQL conectado")).toBeVisible();
    await expect(page.locator(".overview-strip").first()).toBeVisible();
    // Select a real persisted run for the results screen.
    await page.getByRole("button", { name: "Consultar corrida" }).click();
    for (const name of pages) {
      await page.evaluate((name) => {
        location.hash = encodeURIComponent(name);
        window.scrollTo(0, 0);
      }, name);
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator(".loading-state")).toHaveCount(0);
      await page.waitForTimeout(80);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${name} a ${width}`,
      ).toBe(true);
      if (
        (width === 1366 &&
          [
            "Inicio",
            "Simulación",
            "Resultados",
            "Modelo",
            "Teoría",
            "Laboratorio",
            "Comparar escenarios",
          ].includes(name)) ||
        (width === 390 && ["Inicio", "Simulación", "Resultados"].includes(name))
      ) {
        await page.screenshot({
          path: `${evidence}/${name}-${width}.png`,
          fullPage: true,
        });
      }
    }
  }
  expect(errors).toEqual([]);
});

test("teoría inestable y controles de navegación por teclado", async ({
  page,
}) => {
  await page.goto("/#Teor%C3%ADa");
  await page.getByLabel("Llegadas por hora").fill("60");
  await page.getByRole("button", { name: "Calcular M/M/c" }).click();
  await expect(page.locator(".theory-output")).toContainText("INESTABLE");
  await expect(page.locator(".theory-output")).toContainText(
    "no alcanza estado estable",
  );
  await expect(page.locator(".theory-output .telemetry-grid")).toHaveCount(0);
  await page.getByRole("button", { name: "Colapsar navegación" }).click();
  await expect(page.locator(".app")).toHaveClass("app collapsed");
  await page.getByRole("button", { name: "Expandir navegación" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await expect(page.locator(".sidebar")).toHaveClass("sidebar open");
  await page.keyboard.press("Escape");
  await expect(page.locator(".sidebar")).toHaveClass("sidebar");
  await expect(page.getByRole("button", { name: "Abrir menú" })).toBeFocused();
});
