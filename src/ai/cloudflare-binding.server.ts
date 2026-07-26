import "server-only";

import type { CloudflareAiBinding } from "./providers";

export async function getCloudflareAiBinding(): Promise<CloudflareAiBinding | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const context = await getCloudflareContext({ async: true });
    return context.env.AI ?? null;
  } catch {
    return null;
  }
}
