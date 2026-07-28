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
  "invalid_output",
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

  const defaultTitles: Record<AiErrorCode, string> = {
    disabled: "El asistente está desactivado",
    invalid_input: "No pudimos interpretar el mensaje",
    unavailable: "El asistente no está disponible",
    timeout: "El asistente tardó demasiado",
    aborted: "Solicitud cancelada",
    response_too_large: "La respuesta superó el límite permitido",
    invalid_output: "El asistente no pudo estructurar el mensaje",
    quota_exhausted: "La cuota del asistente se agotó",
    rate_limited: "Hay demasiadas solicitudes",
    unsupported_model: "El modelo configurado no está disponible",
    binding_missing: "Falta configurar el asistente de producción",
    misconfigured: "La configuración del asistente está incompleta",
    contract_violation: "La respuesta no respetó el contrato",
    provider_error: "El asistente tuvo un problema inesperado",
  };
  let title = defaultTitles[providerError.code];
  let message = providerError.userMessage;

  if (providerError.provider === "ollama" && providerError.code !== "aborted") {
    switch (providerError.code) {
      case "unavailable":
        title = "Ollama no está iniciado";
        message =
          "Abrí Ollama y reintentá. Tu progreso sigue guardado y también podés continuar manualmente.";
        break;
      case "timeout":
        title = "El modelo local tardó demasiado";
        message =
          "La solicitud se canceló al alcanzar el límite de tiempo. Tu progreso sigue guardado.";
        break;
      case "invalid_output":
        title = "El modelo local no pudo estructurar este mensaje";
        message =
          "No se usó ninguna parte de la respuesta inválida. Podés reformular, reintentar o continuar con el formulario.";
        break;
      case "unsupported_model":
        title = "El modelo local no está instalado";
        message =
          "Revisá OLLAMA_MODEL o instalá manualmente el modelo configurado. Tu progreso sigue guardado.";
        break;
      case "misconfigured":
        title = "La configuración local está incompleta";
        message =
          "Revisá la URL, el modelo y el tiempo límite de Ollama. Ningún dato del perfil se perdió.";
        break;
      default:
        break;
    }
  }
  if (
    providerError.provider === "cloudflare" &&
    providerError.code !== "aborted"
  ) {
    if (providerError.code === "quota_exhausted") {
      title = "La cuota gratuita del asistente se agotó temporalmente";
      message =
        "Tu información sigue guardada. Podés seguir creando y editando la rutina manualmente.";
    } else if (providerError.code === "invalid_output") {
      title = "El asistente no pudo estructurar este mensaje";
      message =
        "La respuesta inválida fue descartada. Podés reintentar o continuar con el formulario sin perder progreso.";
    } else if (providerError.code === "binding_missing") {
      title = "Falta configurar el asistente de producción";
      message =
        "El enlace de Workers AI no está disponible. El formulario y el motor determinista siguen funcionando.";
    }
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
