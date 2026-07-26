import type { CloudflareAiBinding } from "@/ai/providers";

declare global {
  interface CloudflareEnv {
    AI?: CloudflareAiBinding;
  }
}

export {};
