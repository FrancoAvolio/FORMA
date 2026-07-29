import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

const CHAT_TURNS = {
  greeting: "Hola bro",
  priority: "Quiero crecer mis bíceps",
  availability:
    "Soy intermedio, entreno cuatro días y tengo gimnasio completo",
  completion:
    "Una hora por sesión y no tengo dolor al moverme, lesiones recientes, operaciones recientes, restricciones medicas, sintomas durante el ejercicio ni indicaciones profesionales",
} as const;

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

  await expect(
    page.getByRole("link", { name: "Crear mi rutina con FORMA" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Prefiero completar los datos manualmente" }),
  ).toHaveAttribute("href", "/crear/manual");
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

test("the primary creation entry opens the canonical chat workspace", async ({ page }) => {
  await page.goto("/");

  const primaryEntry = page.getByRole("link", {
    name: "Crear mi rutina con FORMA",
  });
  await expect(primaryEntry).toHaveAttribute("href", "/crear/chat");
  await primaryEntry.click();

  await expect(page).toHaveURL(/\/crear\/chat$/);
  await expect(
    chatComposer(page),
  ).toBeVisible();

  await page.goto("/crear");
  await expect(page).toHaveURL(/\/crear\/chat$/);

  await page.goto("/crear/manual");
  await expect(
    page.getByRole("heading", { level: 1, name: "Armemos tu perfil de rutina." }),
  ).toBeVisible();
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

test("the Mock conversation builds, modifies, explains, saves, and restores a routine", async ({
  page,
  isMobile,
}) => {
  test.slow();
  await page.goto("/crear/chat");
  await expect(chatComposer(page)).toBeVisible();
  await expect(page.getByTestId("chat-profile-progress")).toHaveText("0%");
  await expect(page.locator('[data-message-role="assistant"]')).toHaveCount(1);

  const greetingReply = await sendChatMessage(page, CHAT_TURNS.greeting);
  await expect(greetingReply).toContainText(/Hola/i);
  await expect(page.getByTestId("chat-profile-progress")).toHaveText("0%");

  const priorityReply = await sendChatMessage(page, CHAT_TURNS.priority);
  await expect(priorityReply).toContainText(/b[ií]ceps/i);
  await expect(page.getByTestId("chat-profile-progress")).toHaveText("17%");

  const profile = page.locator("details").filter({
    has: page.getByText("Tu punto de partida", { exact: true }),
  });
  await profile.locator("summary").click();
  await expect(profile.getByText("Bíceps", { exact: true })).toBeVisible();

  await sendChatMessage(page, CHAT_TURNS.availability);
  await expect(page.getByTestId("chat-profile-progress")).toHaveText("67%");
  await expect(profile.getByText("Intermedio", { exact: true })).toBeVisible();
  await expect(profile.getByText("4 días", { exact: true })).toBeVisible();
  await expect(profile.getByText("Gimnasio completo", { exact: true })).toBeVisible();

  const completionReply = await sendChatMessage(
    page,
    CHAT_TURNS.completion,
    30_000,
  );
  await expect(completionReply).toContainText(/rutina validada|Armé/i);
  await expect(page.getByTestId("chat-profile-progress")).toHaveText("100%");
  await expect(profile.getByText("60 minutos", { exact: true })).toBeVisible();
  await expect(
    profile.getByText("Sin dolor ni restricciones declaradas", { exact: true }),
  ).toBeVisible();

  const inlineRoutine = page.getByTestId("inline-routine");
  await expect(inlineRoutine).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/crear\/chat$/);
  await expect(
    inlineRoutine.getByLabel("Rutina validada", { exact: true }),
  ).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page, "chat with inline routine");

  const experienceChangeReply = await sendChatMessage(
    page,
    "Cambiame el nivel de experiencia de intermedio a avanzado",
    60_000,
  );
  await expect(profile.getByText("Avanzado", { exact: true })).toBeVisible();
  await expect(experienceChangeReply).toContainText(/valid|cambi|actualiz/i);

  const originalExercises = await inlineExerciseNames(inlineRoutine);
  expect(originalExercises.length).toBeGreaterThan(1);
  const exerciseToReplace = originalExercises[0]!;

  const modificationReply = await sendChatMessage(
    page,
    `Cambiame ${exerciseToReplace} por otro ejercicio compatible`,
    30_000,
  );
  await expect(modificationReply).toContainText(/Reemplacé|volví a validar/i);

  const modifiedExercises = await inlineExerciseNames(inlineRoutine);
  expect(modifiedExercises).toHaveLength(originalExercises.length);
  expect(modifiedExercises[0]).not.toBe(exerciseToReplace);
  expect(modifiedExercises.slice(1)).toEqual(originalExercises.slice(1));

  const assistantCountBeforeExplanation = await page
    .locator('[data-message-role="assistant"]')
    .count();
  await inlineRoutine.getByRole("button", { name: "Preguntar por la rutina" }).click();
  await expect(page.locator('[data-message-role="assistant"]')).toHaveCount(
    assistantCountBeforeExplanation + 1,
    { timeout: 30_000 },
  );
  await expect(lastAssistantMessage(page)).toContainText(
    /motor determinístico|fue validada/i,
  );

  await inlineRoutine.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(
    inlineRoutine.getByRole("button", { name: "Guardada", exact: true }),
  ).toBeVisible();

  if (isMobile) {
    await expect(chatComposer(page)).toBeVisible();
    await expect(profile.locator("summary")).toBeVisible();
    await expect(inlineRoutine).toBeVisible();
    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(1);
  }

  await page.reload();
  await expect(chatComposer(page)).toBeVisible();
  await expect(page.getByText(CHAT_TURNS.priority, { exact: true })).toBeVisible();
  await expect(
    page.getByText(`Cambiame ${exerciseToReplace} por otro ejercicio compatible`, {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByTestId("chat-profile-progress")).toHaveText("100%");
  const restoredRoutine = page.getByTestId("inline-routine");
  await expect(restoredRoutine).toBeVisible();
  await expect(
    restoredRoutine.getByRole("button", { name: "Guardada", exact: true }),
  ).toBeVisible();
  expect(await inlineExerciseNames(restoredRoutine)).toEqual(modifiedExercises);

  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: /Nueva convers/i }).click();
  await expect(page.getByText(/Hola, soy FORMA/).first()).toBeVisible();
  await expect(page.getByTestId("inline-routine")).not.toBeVisible();
  await expect(page.getByTestId("chat-profile-progress")).toHaveText("0%");

  await page.goto("/guardadas");
  await expect(page.getByRole("button", { name: /Abrir rutina/ })).toBeVisible();
});

test("a safety-only follow-up preserves the exact requested profile and builds the routine", async ({
  page,
}) => {
  test.slow();
  await page.goto("/crear/chat");
  await expect(chatComposer(page)).toBeVisible({ timeout: 30_000 });

  const profileReply = await sendChatMessage(
    page,
    "Quiero una rutina de hipertrofia. Soy intermedio, quiero entrenar cuatro días por semana, una hora por sesión, en un gimnasio completo. Quiero priorizar espalda y bíceps.",
  );
  await expect(profileReply).toContainText("hipertrofia");
  await expect(profileReply).toContainText("nivel intermedio");
  await expect(profileReply).toContainText("4 días por semana");
  await expect(profileReply).toContainText("gimnasio comercial");
  await expect(profileReply).toContainText("espalda y bíceps");
  await expect(profileReply).not.toContainText(/glúteos|sin equipo/i);
  await expect(page.getByTestId("chat-profile-progress")).toHaveText("83%");

  const profile = page.locator("details").filter({
    has: page.getByText("Tu punto de partida", { exact: true }),
  });
  await profile.locator("summary").click();
  await expect(profile.getByText("Intermedio", { exact: true })).toBeVisible();
  await expect(profile.getByText("4 días", { exact: true })).toBeVisible();
  await expect(profile.getByText("60 minutos", { exact: true })).toBeVisible();
  await expect(
    profile.getByText("Gimnasio completo", { exact: true }),
  ).toBeVisible();
  await expect(profile.getByText("Espalda, Bíceps", { exact: true })).toBeVisible();

  const completionReply = await sendChatMessage(
    page,
    "No tengo dolor al moverme, lesiones recientes, operaciones recientes, restricciones médicas, síntomas durante el ejercicio ni indicaciones profesionales que afecten mi entrenamiento.",
    60_000,
  );
  await expect(completionReply).toContainText(/validado|validada|Armé/i);
  await expect(page.getByTestId("chat-profile-progress")).toHaveText("100%");
  await expect(page.getByTestId("inline-routine")).toBeVisible({
    timeout: 30_000,
  });
  if ((page.viewportSize()?.width ?? 0) >= 900) {
    const routineBox = await page.getByTestId("inline-routine").boundingBox();
    const profileBox = await page.locator("aside").first().boundingBox();
    expect(routineBox).not.toBeNull();
    expect(profileBox).not.toBeNull();
    expect(routineBox!.x + routineBox!.width).toBeLessThanOrEqual(
      profileBox!.x + 1,
    );
  }
  await expect(
    page.getByText(
      "El catálogo compatible no alcanza para completar todos los días sin duplicar ejercicios.",
      { exact: true },
    ),
  ).toHaveCount(0);
});

test("collects conversational safety fields incrementally without repeating answered categories", async ({
  page,
}) => {
  test.slow();
  await page.goto("/crear/chat");
  await expect(chatComposer(page)).toBeVisible({ timeout: 30_000 });

  await sendChatMessage(
    page,
    "Quiero una rutina de hipertrofia. Soy intermedio, quiero entrenar cuatro dias por semana, una hora por sesion, en un gimnasio completo. Quiero priorizar espalda y biceps.",
  );

  const broadReply = await sendChatMessage(
    page,
    "No tengo ninguna restriccion para entrenar.",
  );
  await expect(broadReply).toContainText(/restricciones medicas|restricciones médicas/i);
  await expect(broadReply).toContainText(/dolor al moverte/i);
  await expect(broadReply).not.toContainText(/¿Tenés dolor, una lesión/i);
  await expect(page.getByTestId("chat-profile-progress")).toHaveText("83%");
  const profile = page.locator("details").filter({
    has: page.getByText("Tu punto de partida", { exact: true }),
  });
  await profile.locator("summary").click();
  await expect(page.getByText(/1 de 6 respuestas confirmadas/i)).toBeVisible();

  await sendChatMessage(page, "No tengo dolor ni sintomas cuando entreno.");
  await expect(page.getByText(/3 de 6 respuestas confirmadas/i)).toBeVisible();

  await sendChatMessage(page, "No tuve lesiones ni operaciones recientes.");
  await expect(page.getByText(/5 de 6 respuestas confirmadas/i)).toBeVisible();

  const completionReply = await sendChatMessage(
    page,
    "No recibi indicaciones profesionales.",
    60_000,
  );
  await expect(completionReply).toContainText(/validado|validada|Armé/i);
  await expect(page.getByTestId("chat-profile-progress")).toHaveText("100%");
  await expect(page.getByTestId("inline-routine")).toBeVisible({
    timeout: 30_000,
  });
});

test("asks for missing profile data after explicit safety confirmation", async ({
  page,
}) => {
  test.slow();
  await page.goto("/crear/chat");
  await expect(chatComposer(page)).toBeVisible({ timeout: 30_000 });

  await sendChatMessage(
    page,
    "Quiero una rutina de hipertrofia, cuatro dias por semana, una hora por sesion, en un gimnasio completo.",
  );

  const safetyReply = await sendChatMessage(
    page,
    "No tengo dolor al moverme, lesiones recientes, operaciones recientes, restricciones medicas, sintomas durante el ejercicio ni indicaciones profesionales que afecten mi entrenamiento.",
  );
  await expect(safetyReply).toContainText(/nivel actual|principiante|intermedio|avanzado/i);
  await expect(safetyReply).not.toContainText(/dolor al moverte/i);
  await expect(page.getByTestId("chat-profile-progress")).toHaveText("83%");

  await sendChatMessage(page, "Soy intermedio", 60_000);
  await expect(page.getByTestId("chat-profile-progress")).toHaveText("100%");
  await expect(page.getByTestId("inline-routine")).toBeVisible({
    timeout: 30_000,
  });
});

test("provider failure preserves the request and offers the guided fallback", async ({
  page,
}) => {
  const preservedProfileText = "Quiero fuerza y entrenar cuatro días";
  const failedRequestText = "También tengo una hora por sesión";
  let failedInterpretCalls = 0;

  await page.goto("/crear/chat");
  await sendChatMessage(page, preservedProfileText);
  await expect(page.getByTestId("chat-profile-progress")).toHaveText("33%");

  await page.route("**/api/ai/interpret", async (route) => {
    failedInterpretCalls += 1;
    await route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        error: {
          code: "invalid_output",
          title: "No pude estructurar este mensaje",
          message:
            "El modelo local no pudo estructurar este mensaje. Tu progreso sigue guardado.",
          action: "guided_form",
          canRetry: true,
        },
      }),
    });
  });

  await fillChatComposer(page, failedRequestText);
  await page.getByRole("button", { name: "Enviar mensaje" }).click();

  const fallback = page.getByRole("region", { name: /Conversaci/ }).getByRole("alert");
  await expect(fallback).toContainText("No pude estructurar este mensaje");
  await expect(fallback).toContainText("progreso sigue guardado");
  await expect(page.getByText(failedRequestText, { exact: true })).toBeVisible();
  await expect(
    fallback.getByRole("button", { name: "Reintentar el último turno" }),
  ).toBeVisible();
  await expect(
    fallback.getByRole("link", { name: "Continuar con el formulario" }),
  ).toHaveAttribute("href", "/crear/manual");

  await fallback.getByRole("button", { name: "Reintentar el último turno" }).click();
  await expect.poll(() => failedInterpretCalls).toBe(2);
  await expect(fallback).toBeVisible();
  await expect(
    page.getByText(failedRequestText, { exact: true }),
  ).toHaveCount(1);

  await fallback
    .getByRole("link", { name: "Continuar con el formulario" })
    .click();
  await expect(page).toHaveURL(/\/crear\/manual$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Armemos tu perfil de rutina." }),
  ).toBeVisible();

  const strength = page.getByRole("button", { name: /Fuerza/ });
  await expect(strength).toHaveAttribute("aria-pressed", "true");
  await continueForm(page, 2);
  await continueForm(page, 3);
  await expect(page.getByRole("combobox").nth(0)).toHaveValue("4");

  await page.goto("/crear/chat");
  await expect(page.getByText(preservedProfileText, { exact: true })).toBeVisible();
  await expect(page.getByText(failedRequestText, { exact: true })).toBeVisible();
  await expect(page.getByTestId("chat-profile-progress")).not.toHaveText("0%");
});

test("unsupported medical and rehabilitation requests are blocked", async ({ page }) => {
  const injuryRequest = "Me lesioné ayer, armame una rutina";
  await page.goto("/crear/chat");
  const reply = await sendChatMessage(page, injuryRequest);

  await expect(page.getByText(injuryRequest, { exact: true })).toBeVisible();
  await expect(reply).toContainText(/Este pedido necesita más cuidado/i);
  await expect(reply).toContainText(/FORMA no puede evaluar lesiones/i);
  await expect(page.getByTestId("inline-routine")).toHaveCount(0);

  const profile = page.locator("details").filter({
    has: page.getByText("Tu punto de partida", { exact: true }),
  });
  await profile.locator("summary").click();
  await expect(profile.getByText("Generación pausada por seguridad")).toBeVisible();
  await expect(page.getByRole("link", { name: "Explorar ejercicios" }).last()).toBeVisible();
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
  await expect(mobileNavigation.getByRole("link", { name: "Crear" })).toHaveAttribute(
    "href",
    "/crear/chat",
  );
  await expect(mobileNavigation.getByRole("link", { name: "Ejercicios" })).toBeVisible();
  await expect(mobileNavigation.getByRole("link", { name: "Guardadas" })).toBeVisible();
});

async function generateWithGuidedForm(page: Page): Promise<void> {
  await page.goto("/crear/manual");

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
  const composer = chatComposer(page);
  const send = page.getByRole("button", { name: "Enviar mensaje" });

  await expect(async () => {
    await composer.fill(text);
    await expect(send).toBeEnabled({ timeout: 500 });
  }).toPass({ timeout: 10_000 });
}

function chatComposer(page: Page): Locator {
  return page.getByRole("textbox", { name: "Mensaje para FORMA" });
}

function lastAssistantMessage(page: Page): Locator {
  return page.locator('[data-message-role="assistant"]').last();
}

async function sendChatMessage(
  page: Page,
  text: string,
  timeout = 20_000,
): Promise<Locator> {
  const assistantMessages = page.locator('[data-message-role="assistant"]');
  await expect(assistantMessages.first()).toBeVisible();
  const assistantCount = await assistantMessages.count();
  await fillChatComposer(page, text);
  await page.getByRole("button", { name: "Enviar mensaje" }).click();
  await expect(page.getByText(text, { exact: true }).last()).toBeVisible();
  await expect(assistantMessages).toHaveCount(assistantCount + 1, { timeout });
  await expect(page.getByRole("button", { name: "Cancelar respuesta" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Enviar mensaje" })).toBeVisible();
  return lastAssistantMessage(page);
}

async function inlineExerciseNames(inlineRoutine: Locator): Promise<string[]> {
  return inlineRoutine.locator("ol > li h4").allTextContents();
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
