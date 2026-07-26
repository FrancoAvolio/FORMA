import { AiProviderError, isAiProviderError } from "./errors";

type Deadline = {
  signal: AbortSignal;
  didTimeout: () => boolean;
  cleanup: () => void;
};

function createDeadline(
  externalSignal: AbortSignal | undefined,
  timeoutMs: number,
): Deadline {
  const controller = new AbortController();
  let timedOut = false;

  const abortFromCaller = () => {
    controller.abort(externalSignal?.reason);
  };

  if (externalSignal?.aborted) {
    abortFromCaller();
  } else {
    externalSignal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort(new DOMException("AI request timed out", "TimeoutError"));
  }, timeoutMs);

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup() {
      clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", abortFromCaller);
    },
  };
}

export async function withAiDeadline<T>(options: {
  provider: string;
  operation: string;
  timeoutMs: number;
  signal?: AbortSignal;
  run: (signal: AbortSignal) => Promise<T>;
}): Promise<T> {
  const deadline = createDeadline(options.signal, options.timeoutMs);

  if (deadline.signal.aborted) {
    deadline.cleanup();
    throw new AiProviderError(
      deadline.didTimeout() ? "timeout" : "aborted",
      {
        provider: options.provider,
        operation: options.operation,
        cause: deadline.signal.reason,
      },
    );
  }

  const aborted = new Promise<never>((_, reject) => {
    deadline.signal.addEventListener(
      "abort",
      () => {
        reject(
          new AiProviderError(
            deadline.didTimeout() ? "timeout" : "aborted",
            {
              provider: options.provider,
              operation: options.operation,
              cause: deadline.signal.reason,
            },
          ),
        );
      },
      { once: true },
    );
  });

  try {
    return await Promise.race([options.run(deadline.signal), aborted]);
  } catch (error) {
    if (isAiProviderError(error)) {
      throw error;
    }

    if (deadline.didTimeout()) {
      throw new AiProviderError("timeout", {
        provider: options.provider,
        operation: options.operation,
        cause: error,
      });
    }

    if (options.signal?.aborted || deadline.signal.aborted) {
      throw new AiProviderError("aborted", {
        provider: options.provider,
        operation: options.operation,
        cause: error,
      });
    }

    throw error;
  } finally {
    deadline.cleanup();
  }
}

export function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function assertMaximumBytes(options: {
  value: string;
  maximum: number;
  kind: "input" | "output";
  provider?: string;
  operation?: string;
}): void {
  if (byteLength(options.value) <= options.maximum) {
    return;
  }

  throw new AiProviderError(
    options.kind === "input" ? "invalid_input" : "response_too_large",
    {
      provider: options.provider,
      operation: options.operation,
      message: `AI ${options.kind} exceeded ${options.maximum} bytes`,
    },
  );
}

export async function readResponseTextLimited(
  response: Response,
  options: {
    maximumBytes: number;
    provider: string;
    operation: string;
  },
): Promise<string> {
  const declaredLength = response.headers.get("content-length");
  if (
    declaredLength !== null &&
    Number.isFinite(Number(declaredLength)) &&
    Number(declaredLength) > options.maximumBytes
  ) {
    throw new AiProviderError("response_too_large", {
      provider: options.provider,
      operation: options.operation,
    });
  }

  if (!response.body) {
    const text = await response.text();
    assertMaximumBytes({
      value: text,
      maximum: options.maximumBytes,
      kind: "output",
      provider: options.provider,
      operation: options.operation,
    });
    return text;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      total += value.byteLength;
      if (total > options.maximumBytes) {
        await reader.cancel();
        throw new AiProviderError("response_too_large", {
          provider: options.provider,
          operation: options.operation,
        });
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const complete = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    complete.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder("utf-8", { fatal: true }).decode(complete);
}
