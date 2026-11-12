import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

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
const evidence = "../docs/pedagogy";

for (const [width, height] of [
  [1920, 1080],
  [1366, 768],
  [1024, 768],
  [768, 1024],
  [390, 844],
]) {
  test(`guías abiertas, teclado y tooltips sin desbordamiento a ${width}×${height}`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.getByText("PostgreSQL conectado")).toBeVisible();
    await mkdir(evidence, { recursive: true });
    for (const name of pages) {
      await page.evaluate((name) => {
        location.hash = encodeURIComponent(name);
      }, name);
      await expect(page.locator(".breadcrumb")).toContainText(
        name === "Modelo" ? "Modelo" : name,
      );
      const guide = page.locator(".info-panel");
      await expect(guide).toHaveCount(1);
      const toggle = guide.getByRole("button", { name: "¿Cómo funciona?" });
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await toggle.focus();
      await page.keyboard.press("Enter");
      const opened = guide.getByRole("button", { name: "Ocultar explicación" });
      await expect(opened).toHaveAttribute("aria-expanded", "true");
      await expect(guide.locator(".learning-details")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        name,
      ).toBe(true);
      for (const trigger of await guide.locator(".help-trigger").all()) {
        await trigger.scrollIntoViewIfNeeded();
        await trigger.focus();
        const tooltip = page.getByRole("tooltip");
        await expect(tooltip).toBeVisible();
        await expect(trigger).toHaveAttribute(
          "aria-describedby",
          (await tooltip.getAttribute("id")) as string,
        );
        const box = await tooltip.boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
        await page.keyboard.press("Escape");
        await expect(tooltip).toHaveCount(0);
        await expect(trigger).toBeFocused();
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      if (width === 1366 || width === 390)
        await page.screenshot({
          path: `${evidence}/${name}-${width}-guia.png`,
          fullPage: true,
        });
      await opened.focus();
      await page.keyboard.press("Space");
      await expect(guide.locator(".learning-details")).toBeHidden();
      await expect(
        guide.getByRole("button", { name: "¿Cómo funciona?" }),
      ).toBeFocused();
    }
    expect(errors).toEqual([]);
  });
}

test("parámetros con descripción, prioridad y reproducibilidad real", async ({
  page,
  request,
}) => {
  await page.goto("/#Simulaci%C3%B3n");
  await expect(page.getByText("PostgreSQL conectado")).toBeVisible();
  for (const input of await page
    .locator("main form input, main form select")
    .all()) {
    const id = await input.getAttribute("aria-describedby");
    expect(id).toBeTruthy();
    await expect(page.locator(`[id="${id}"]`)).not.toBeEmpty();
  }
  await page
    .locator(".info-panel")
    .getByRole("button", { name: "¿Cómo funciona?" })
    .click();
  await expect(page.locator(".info-panel")).toContainText(
    "C NO interrumpe la consulta de A",
  );
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Ayuda: horizonte", exact: true }),
  ).toBeFocused();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await expect(page.locator(".info-panel")).toContainText(
    "1.440 minutos = 24 horas",
  );
  await expect(page.locator(".info-panel")).toContainText(
    "144 generados, 130 atendidos, 130 egresados, 14 pendientes",
  );
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/simulations/run") &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Ejecutar simulación", exact: true })
    .click();
  const run = await (await response).json();
  expect(run.metrics).toMatchObject({
    generated: 144,
    treated: 130,
    discharged: 130,
    active_at_end: 14,
  });
  await expect(page.locator(".metric")).toHaveCount(5);
  const repeat = await request.post("/api/simulations/run", {
    data: run.config,
  });
  expect((await repeat.json()).metrics).toEqual(run.metrics);
  const seed100 = await request.post("/api/simulations/run", {
    data: { ...run.config, seed: 100 },
  });
  expect((await seed100.json()).metrics).toMatchObject({
    generated: 143,
    treated: 119,
    discharged: 117,
    active_at_end: 26,
  });
  const metricHelp = page
    .locator(".metric")
    .getByRole("button", { name: "Ayuda: Wq", exact: true });
  await metricHelp.hover();
  await expect(page.getByRole("tooltip")).toContainText("Promedio ≠");
  await page.mouse.move(0, 0);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
});

test("ejemplos auditados, percentiles y fuentes no se confunden con la corrida", async ({
  page,
}) => {
  await page.goto("/#Comparar%20escenarios");
  await page
    .locator(".info-panel")
    .getByRole("button", { name: "¿Cómo funciona?" })
    .click();
  await expect(page.locator(".info-panel")).toContainText("30 réplicas");
  await expect(page.getByRole("table").first()).toContainText("88,33");
  await expect(page.locator(".info-panel")).toContainText(
    "No existe todavía una función de costos",
  );
  await page.goto("/#Resultados");
  await page
    .locator(".info-panel")
    .getByRole("button", { name: "¿Cómo funciona?" })
    .click();
  await expect(page.locator(".info-panel")).toContainText(
    "no el p95 de las medias entre repeticiones",
  );
  await expect(page.locator(".info-panel")).toContainText(
    "terminaron la consulta médica",
  );
  await page.goto("/#Teor%C3%ADa");
  await page
    .locator(".info-panel")
    .getByRole("button", { name: "¿Cómo funciona?" })
    .click();
  await expect(page.locator(".info-panel")).toContainText("50,73 min");
  await page
    .locator(".info-panel")
    .getByRole("button", { name: "Ayuda: Wq", exact: true })
    .focus();
  await expect(page.getByRole("tooltip")).toContainText("teórico");
  await expect(page.getByRole("tooltip")).not.toContainText("triage");
  await page.keyboard.press("Escape");
  await expect(page.locator(".info-panel")).toContainText(
    "2,5 pacientes en promedio",
  );
  await page.getByLabel("Llegadas por hora").fill("9");
  await page.getByLabel("Servicio medio (min)").fill("18");
  await page.getByLabel("Servidores c").fill("2");
  await page.getByRole("button", { name: "Calcular M/M/c" }).click();
  await expect(page.locator(".theory-output")).toContainText("INESTABLE");
  await expect(page.locator(".theory-output .telemetry-grid")).toHaveCount(0);
});
