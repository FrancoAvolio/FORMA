import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

const COMPLETE_CHAT_REQUEST =
  "Quiero hipertrofia, soy intermedio, tengo 4 días y 60 minutos. " +
  "Entreno en gimnasio con barra, mancuernas, poleas y máquinas. " +
  "No tengo dolor ni restricciones.";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const resetMarker = "forma:e2e:storage-reset";
    if (window.sessionStorage.getItem(resetMarker) === "done") return;

    window.localStorage.clear();
    window.sessionStorage.clear();
    window.sessionStorage.setItem(resetMarker, "done");
  });
});

test("landing page leads to filtered exercise details and a safe media state", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Crear mi rutina" })).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page, "landing page");
  await page.getByRole("link", { name: "Explorar ejercicios" }).first().click();

  await expect(page).toHaveURL(/\/ejercicios$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Explorar ejercicios" }),
  ).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page, "exercise explorer");

  const search = page.getByRole("searchbox");
  await search.fill("press");
  await page.getByRole("button", { name: "Aplicar filtros" }).click();

  await expect(page).toHaveURL(/\/ejercicios\?.*q=press/);
  await expect(page.getByText(/ejercicios? encontrados?/)).toBeVisible();

  const firstDetailLink = page.getByRole("link", { name: /Ver t/ }).first();
  await expect(firstDetailLink).toBeVisible();
  await firstDetailLink.click();
  await expect(page).toHaveURL(/\/ejercicios\/[^/]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const animationControl = page.getByRole("button", { name: /Ver demostraci/ });
  await expect(animationControl).toBeVisible();
  await expect(page.locator('img[src*="/api/exercise-media/images/"]')).toBeVisible();

  const attribution = page.getByLabel(/Atribuci/);
  await expect(attribution).toContainText("licencia separada");
  await expect(attribution.getByRole("link", { name: /condiciones y auditor/ })).toBeVisible();
});

test("guided form generates, replaces one exercise, saves, and reopens without AI", async ({
  page,
}) => {
  test.slow();
  await generateWithGuidedForm(page);
  await expectNoSeriousAccessibilityViolations(page, "generated routine");

  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveCount(4);

  await tabs.nth(1).click();
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
  const untouchedDayExercises = await activeExerciseLinks(page);

  await tabs.nth(0).click();
  await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
  const originalExercises = await activeExerciseLinks(page);
  expect(originalExercises.length).toBeGreaterThan(1);

  const firstExercise = activeDay(page).locator("ol > li").first();
  await firstExercise.getByRole("button", { name: "Reemplazar" }).click();
  await expect(
    firstExercise.getByRole("button", { name: "Cerrar sustituciones" }),
  ).toBeVisible();

  const replacementOption = firstExercise.locator("ul button").first();
  await expect(replacementOption).toBeVisible();
  await replacementOption.click();
  await expect(page.getByRole("status")).toContainText(
    "Cambio aplicado y rutina revalidada.",
  );

  const replacedExercises = await activeExerciseLinks(page);
  expect(replacedExercises).toHaveLength(originalExercises.length);
  expect(replacedExercises[0]).not.toBe(originalExercises[0]);
  expect(replacedExercises.slice(1)).toEqual(originalExercises.slice(1));
  await expect(
    page.getByRole("heading", { level: 2, name: "Rutina validada" }),
  ).toBeVisible();

  await tabs.nth(1).click();
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
  expect(await activeExerciseLinks(page)).toEqual(untouchedDayExercises);

  const routineTitle = await page.getByRole("heading", { level: 1 }).textContent();
  expect(routineTitle).toBeTruthy();

  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Rutina guardada en este navegador.",
  );

  await page.goto("/guardadas");
  await expect(
    page.getByRole("heading", { level: 1, name: "Rutinas guardadas" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Abrir rutina/ }).click();

  await expect(page).toHaveURL(/\/rutina$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(routineTitle!);
  await expect(
    page.getByRole("heading", { level: 2, name: "Rutina validada" }),
  ).toBeVisible();

  await page.getByRole("tab").nth(0).click();
  expect(await activeExerciseLinks(page)).toEqual(replacedExercises);
});

test("the configured Mock provider creates a routine from chat", async ({ page }) => {
  test.slow();
  await page.goto("/crear/chat");
  await fillChatComposer(page, COMPLETE_CHAT_REQUEST);
  await page.getByRole("button", { name: "Enviar mensaje" }).click();

  await expect(page.getByText(/Ya tengo un perfil estructurado completo/)).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Perfil de rutina" }),
  ).toBeVisible();
  await expect(page.getByText(/mock/).first()).toBeVisible();
  await expect(page.getByText("4 por semana")).toBeVisible();

  await completeChatSafetyCheck(page);

  const generate = page.getByRole("button", {
    name: "Generar rutina validada",
  });
  await expect(generate).toBeEnabled();
  await generate.click();

  await expect(page).toHaveURL(/\/rutina$/, { timeout: 20_000 });
  await expect(
    page.getByRole("heading", { level: 2, name: "Rutina validada" }),
  ).toBeVisible();
});

test("provider failure preserves the request and offers the guided fallback", async ({
  page,
}) => {
  const requestText = "Quiero una rutina de fuerza tres días por semana.";
  await page.route("**/api/ai/interpret", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        provider: { id: "mock", model: "deterministic-fixture-v1" },
        error: {
          code: "provider_unavailable",
          title: "El asistente conversacional no está disponible",
          message:
            "Tu información sigue guardada. Podés completar la rutina mediante el formulario.",
          action: "guided_form",
          canRetry: true,
        },
      }),
    });
  });

  await page.goto("/crear/chat");
  await fillChatComposer(page, requestText);
  await page.getByRole("button", { name: "Enviar mensaje" }).click();

  const fallback = page.getByRole("region", { name: /Conversaci/ }).getByRole("alert");
  await expect(fallback).toContainText("no está disponible");
  await expect(fallback).toContainText("información sigue guardada");
  await expect(page.getByText(requestText)).toBeVisible();

  await fallback.getByRole("link", { name: "Continuar con formulario" }).click();
  await expect(page).toHaveURL(/\/crear$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Armemos tu perfil de rutina." }),
  ).toBeVisible();

  await page.goto("/crear/chat");
  await expect(page.getByText(requestText)).toBeVisible();
});

test("unsupported medical and rehabilitation requests are blocked", async ({ page }) => {
  await page.goto("/crear/chat");
  await fillChatComposer(
    page,
    "Me lesioné ayer y quiero que me armes una rehabilitación para el hombro.",
  );
  await page.getByRole("button", { name: "Enviar mensaje" }).click();

  await expect(page.getByText(/FORMA no puede evaluar lesiones/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Generar rutina validada" }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: /terminar el mismo perfil/ })).toBeVisible();
});

test.describe("reduced motion", () => {
  test("keeps motion minimal and never restores animated media automatically", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/ejercicios/0017");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(
      true,
    );

    const transitionDurationsMs = await page
      .getByRole("link", { name: /Volver al cat/ })
      .evaluate((element) =>
        getComputedStyle(element)
          .transitionDuration.split(",")
          .map((duration) => {
            const value = Number.parseFloat(duration);
            return duration.trim().endsWith("ms") ? value : value * 1_000;
          }),
      );
    expect(Math.max(...transitionDurationsMs)).toBeLessThanOrEqual(0.011);

    const animationControl = page.getByRole("button", { name: /Ver demostraci/ });
    await expect(animationControl).toBeVisible();
    await animationControl.click();
    await expect(page.getByRole("button", { name: "Detener" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator('img[src*="/api/exercise-media/videos/"]')).toBeVisible();

    await page.reload();
    await expect(page.getByRole("button", { name: /Ver demostraci/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect(page.locator('img[src*="/api/exercise-media/images/"]')).toBeVisible();
  });
});

test("local-private media serves the real thumbnail and animation", async ({
  page,
  request,
}) => {
  await page.goto("/ejercicios/0017");
  const thumbnail = page.locator('img[src*="/api/exercise-media/images/0017-"]');
  await expect(thumbnail).toBeVisible();
  await expect(page.getByText(/Gym visual/).first()).toBeVisible();

  const thumbnailUrl = await thumbnail.getAttribute("src");
  expect(thumbnailUrl).toBeTruthy();
  const thumbnailResponse = await request.get(new URL(thumbnailUrl!, page.url()).toString());
  expect(thumbnailResponse.ok()).toBe(true);
  expect(thumbnailResponse.headers()["content-type"]).toMatch(/^image\/jpeg/);

  const animationResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/exercise-media/videos/0017-") && response.ok(),
  );
  await page.getByRole("button", { name: /Ver demostraci/ }).click();
  await animationResponse;
  await expect(page.locator('img[src*="/api/exercise-media/videos/0017-"]')).toBeVisible();
});

test("disabled-media fixture keeps the placeholder layout usable", async ({ page }) => {
  test.skip(
    process.env.PLAYWRIGHT_EXPECT_DISABLED_MEDIA !== "true",
    "Point PLAYWRIGHT_BASE_URL at a server with EXERCISE_MEDIA_MODE=disabled and set PLAYWRIGHT_EXPECT_DISABLED_MEDIA=true.",
  );

  await page.goto("/ejercicios/0017");
  await expect(page.getByText("Media no disponible", { exact: true })).toBeVisible();
  await expect(
    page.locator('img[src="/exercises/placeholders/exercise-media.svg"]'),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Ver demostraci/ })).toHaveCount(0);
  await expect(page.getByLabel(/Atribuci/)).toContainText("licencia separada");
});

test("mobile project exposes the persistent core navigation", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobile-only responsive navigation assertion.");
  await page.goto("/");

  const mobileNavigation = page.getByRole("navigation", { name: /Navegaci.*m.vil/ });
  await expect(mobileNavigation).toBeVisible();
  await expect(mobileNavigation.getByRole("link", { name: "Crear" })).toBeVisible();
  await expect(mobileNavigation.getByRole("link", { name: "Ejercicios" })).toBeVisible();
  await expect(mobileNavigation.getByRole("link", { name: "Guardadas" })).toBeVisible();
});

async function generateWithGuidedForm(page: Page): Promise<void> {
  await page.goto("/crear");

  await expect(
    page.getByRole("heading", { level: 1, name: "Armemos tu perfil de rutina." }),
  ).toBeVisible();

  await proveGuidedFormHydration(page);
  await page.getByRole("button", { name: /Hipertrofia/ }).click();
  await expect(page.getByRole("button", { name: /Hipertrofia/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await continueForm(page, 2);

  await page.getByRole("button", { name: /Intermedio/ }).click();
  await expect(page.getByRole("button", { name: /Intermedio/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await continueForm(page, 3);

  const availability = page.getByRole("combobox");
  await availability.nth(0).selectOption("4");
  await availability.nth(1).selectOption("60");
  await page.getByRole("button", { name: /Gimnasio comercial/ }).click();
  await continueForm(page, 4);

  await expect(page.getByRole("checkbox").first()).toBeChecked();
  await continueForm(page, 5);
  await continueForm(page, 6);

  const safeAnswers = page.getByRole("radio", { name: "No", exact: true });
  await expect(safeAnswers).toHaveCount(6);
  for (let index = 0; index < 6; index += 1) {
    await safeAnswers.nth(index).check();
  }
  await page
    .getByRole("checkbox", { name: /Confirmo que estas respuestas/ })
    .check();
  await continueForm(page, 7);

  const generate = page.getByRole("button", { name: "Generar rutina" });
  await expect(generate).toBeEnabled();
  await generate.click();

  await expect(page).toHaveURL(/\/rutina$/, { timeout: 20_000 });
  await expect(
    page.getByRole("heading", { level: 2, name: "Rutina validada" }),
  ).toBeVisible();
}

async function proveGuidedFormHydration(page: Page): Promise<void> {
  const proof = page.getByRole("button", { name: /Fuerza/ });
  await expect(async () => {
    await proof.click();
    await expect(proof).toHaveAttribute("aria-pressed", "true", { timeout: 500 });
  }).toPass({ timeout: 10_000 });
}

async function continueForm(page: Page, expectedStep: number): Promise<void> {
  const button = page.getByRole("button", { name: "Continuar" });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page.getByRole("progressbar", { name: /Progreso del formulario/ })).toHaveAttribute(
    "aria-valuenow",
    String(expectedStep),
  );
}

async function fillChatComposer(page: Page, text: string): Promise<void> {
  const composer = page.getByRole("textbox", {
    name: "Mensaje para describir la rutina",
  });
  const send = page.getByRole("button", { name: "Enviar mensaje" });

  await expect(async () => {
    await composer.fill(text);
    await expect(send).toBeEnabled({ timeout: 500 });
  }).toPass({ timeout: 10_000 });
}

async function completeChatSafetyCheck(page: Page): Promise<void> {
  const safeAnswers = page.getByRole("radio", { name: "No", exact: true });
  await expect(safeAnswers).toHaveCount(6);
  for (let index = 0; index < 6; index += 1) {
    await safeAnswers.nth(index).check();
  }
  await page.getByRole("checkbox", { name: /Estas respuestas describen/ }).check();
}

function activeDay(page: Page): Locator {
  return page.locator('section[aria-labelledby="active-day-title"]');
}

async function activeExerciseLinks(page: Page): Promise<string[]> {
  return activeDay(page)
    .locator('ol > li a[href^="/ejercicios/"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
}

async function expectNoSeriousAccessibilityViolations(
  page: Page,
  state: string,
): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const violations = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  const summary = violations
    .map(
      (violation) =>
        `${violation.id} [${violation.impact}]: ${violation.help} ` +
        `(${violation.nodes.length} node${violation.nodes.length === 1 ? "" : "s"}: ` +
        `${violation.nodes
          .map(
            (node) =>
              `${node.target.join(" ")} — ${node.failureSummary ?? "No failure summary."}`,
          )
          .join("; ")})`,
    )
    .join("\n");

  expect(
    violations.length,
    `${state} has serious or critical accessibility violations${summary ? `:\n${summary}` : "."}`,
  ).toBe(0);
}
