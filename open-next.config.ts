import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * FORMA does not require incremental persistence in the MVP. Browser routines
 * stay local and the deterministic catalog is bundled read-only.
 */
export default defineCloudflareConfig();
