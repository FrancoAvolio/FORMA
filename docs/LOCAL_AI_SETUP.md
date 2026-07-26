# Local AI setup (Ollama)

Ollama is optional. FORMA's guided form, deterministic routine engine, exercise
catalog and saved routines must work when Ollama is absent or stopped.

## Manual prerequisites

Install Ollama from its official distribution for your operating system. This is
a manual operator action; the project does not install or start system software.

Download and start the default local model:

```bash
ollama pull qwen3:1.7b
ollama run qwen3:1.7b
```

Keep Ollama running while using conversational interpretation. The model download
can be substantial and remains outside the repository.

## Environment

Add the following server-only values to `.env.local`:

```env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:1.7b
AI_TIMEOUT_MS=12000
AI_DEBUG_LOGS=false
```

Do not prefix these values with `NEXT_PUBLIC_`. The browser must never call port
11434. Next.js route/application code obtains the provider from the server-only
factory; only `OllamaAiProvider` knows the Ollama protocol.

`OLLAMA_BASE_URL` must be an HTTP(S) URL. `AI_TIMEOUT_MS` accepts 1,000–60,000
milliseconds. The default request deadline is 12 seconds.

## Start FORMA

In another terminal, run:

```bash
npm run dev
```

Use a complete Spanish request first, for example:

```text
Soy intermedio. Quiero hipertrofia cuatro días, 45 minutos por sesión, en el gimnasio con mancuernas y máquinas. No tengo dolor ni restricciones.
```

Every result is still validated with Zod and sent to the deterministic engine.
The local model does not choose exercises or build the final routine.

## Verification

The standard suite never contacts Ollama:

```bash
npm run validate
```

Once the optional external script is wired, run its separate contract check while
Ollama is active:

```bash
npm run test:ollama
```

That check must use the same `AiProvider` contract and remain outside
`npm run validate`; a stopped service should not break normal development.

You can confirm the process is reachable independently in PowerShell:

```powershell
Invoke-RestMethod http://127.0.0.1:11434/api/tags
```

Reachability alone does not prove structured-output reliability. The provider
contract is the acceptance test.

## Failure behavior

If Ollama is missing, stopped, the model is absent, the deadline expires, output
is too large, or both the original and one repair response are invalid, FORMA must
preserve the structured draft and show:

```text
El asistente local no está disponible.

Podés iniciar Ollama o continuar con el formulario guiado.
```

Relevant error distinctions are available to the server/UI adapter:

- `unavailable`: process/endpoint cannot be reached.
- `unsupported_model`: configured model is not installed.
- `timeout`: deadline elapsed.
- `aborted`: a newer request superseded this one.
- `response_too_large`: bounded response limit exceeded.
- `invalid_output`: output remained invalid after one repair.

No error state may discard the form answers or current chat-derived draft.

## Troubleshooting

- **`unsupported_model`**: run `ollama pull qwen3:1.7b` and verify
  `OLLAMA_MODEL` exactly.
- **`unavailable`**: start Ollama and verify `OLLAMA_BASE_URL`; do not replace it
  with a browser-facing URL.
- **Frequent timeouts**: confirm the machine can run the model, then increase
  `AI_TIMEOUT_MS` within the documented maximum. Do not remove the timeout.
- **Repeated invalid output**: keep using the guided form and record the prompt,
  model version and contract failure without logging user-private text. Do not use
  partially validated fields.
- **A newer request cancels the old one**: expected behavior; the caller should
  pass an `AbortSignal` and retain the newest draft.

