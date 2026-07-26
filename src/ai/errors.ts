export const AI_ERROR_CODES = [
  "disabled",
  "invalid_input",
  "unavailable",
  "timeout",
  "aborted",
  "response_too_large",
  "invalid_output",
  "quota_exhausted",
  "rate_limited",
  "unsupported_model",
  "binding_missing",
  "misconfigured",
  "contract_violation",
  "provider_error",
] as const;

export type AiErrorCode = (typeof AI_ERROR_CODES)[number];

const RETRYABLE_CODES = new Set<AiErrorCode>([
  "unavailable",
  "timeout",
  "rate_limited",
  "provider_error",
]);

const FALLBACK_MESSAGES: Record<AiErrorCode, string> = {
  disabled:
    "El asistente está desactivado. Podés continuar con el formulario guiado.",
  invalid_input:
    "No pudimos interpretar ese mensaje. Revisalo o continuá con el formulario guiado.",
  unavailable:
    "El asistente no está disponible. Tu información sigue guardada y podés continuar con el formulario guiado.",
  timeout:
    "El asistente tardó demasiado en responder. Podés reintentar o continuar con el formulario guiado.",
  aborted: "Se canceló la solicitud anterior.",
  response_too_large:
    "La respuesta del asistente superó el límite permitido. Podés continuar con el formulario guiado.",
  invalid_output:
    "El asistente no devolvió una respuesta válida. Tu información sigue guardada y podés continuar con el formulario guiado.",
  quota_exhausted:
    "El asistente alcanzó su límite de uso. Tu información sigue guardada y podés continuar con el formulario guiado.",
  rate_limited:
    "Hay demasiadas solicitudes en este momento. Esperá un instante o continuá con el formulario guiado.",
  unsupported_model:
    "El modelo configurado no es compatible. Podés continuar con el formulario guiado.",
  binding_missing:
    "El asistente de producción no está configurado. Podés continuar con el formulario guiado.",
  misconfigured:
    "El asistente no está configurado correctamente. Podés continuar con el formulario guiado.",
  contract_violation:
    "La respuesta no respetó las restricciones de FORMA. Podés continuar con el formulario guiado.",
  provider_error:
    "El asistente tuvo un problema interno. Tu información sigue guardada y podés continuar con el formulario guiado.",
};

export type AiProviderErrorOptions = {
  provider?: string;
  operation?: string;
  cause?: unknown;
  retryAfterSeconds?: number;
  message?: string;
};

export class AiProviderError extends Error {
  readonly code: AiErrorCode;
  readonly provider?: string;
  readonly operation?: string;
  readonly retryable: boolean;
  readonly fallbackRecommended: boolean;
  readonly retryAfterSeconds?: number;
  readonly userMessage: string;

  constructor(code: AiErrorCode, options: AiProviderErrorOptions = {}) {
    super(options.message ?? FALLBACK_MESSAGES[code], { cause: options.cause });
    this.name = "AiProviderError";
    this.code = code;
    this.provider = options.provider;
    this.operation = options.operation;
    this.retryable = RETRYABLE_CODES.has(code);
    this.fallbackRecommended = code !== "aborted";
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.userMessage = FALLBACK_MESSAGES[code];
  }
}

export function isAiProviderError(error: unknown): error is AiProviderError {
  return error instanceof AiProviderError;
}

export type AiFallbackState = {
  code: AiErrorCode;
  title: string;
  message: string;
  action: "guided_form" | "none";
  canRetry: boolean;
  retryAfterSeconds?: number;
};

export function toAiFallbackState(error: unknown): AiFallbackState {
  const providerError = isAiProviderError(error)
    ? error
    : new AiProviderError("provider_error", { cause: error });

  let title =
    providerError.code === "aborted"
      ? "Solicitud cancelada"
      : "El asistente no está disponible";
  let message = providerError.userMessage;

  if (providerError.provider === "ollama" && providerError.code !== "aborted") {
    title = "El asistente local no está disponible";
    message = "Podés iniciar Ollama o continuar con el formulario guiado.";
  }
  if (
    providerError.provider === "cloudflare" &&
    providerError.code !== "aborted"
  ) {
    title =
      providerError.code === "quota_exhausted"
        ? "El asistente alcanzó su límite de uso"
        : "El asistente conversacional no está disponible";
    message =
      "Tu información sigue guardada. Podés completar la rutina mediante el formulario y obtener el mismo plan estructurado.";
  }

  return {
    code: providerError.code,
    title,
    message,
    action: providerError.fallbackRecommended ? "guided_form" : "none",
    canRetry: providerError.retryable,
    ...(providerError.retryAfterSeconds === undefined
      ? {}
      : { retryAfterSeconds: providerError.retryAfterSeconds }),
  };
}
