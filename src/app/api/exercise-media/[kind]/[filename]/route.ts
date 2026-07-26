import {
  isAllowedProtectedMediaFile,
  isProtectedLocalMediaEnabled,
} from "@/media/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE_RULES = {
  images: {
    expression: /^[0-9]{4}-[A-Za-z0-9_-]+\.jpg$/u,
    contentType: "image/jpeg",
  },
  videos: {
    expression: /^[0-9]{4}-[A-Za-z0-9_-]+\.gif$/u,
    contentType: "image/gif",
  },
} as const;

type RouteContext = {
  params: Promise<{ kind: string; filename: string }>;
};

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  if (!isProtectedLocalMediaEnabled()) {
    return new Response("Media no disponible.", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const { kind, filename } = await context.params;
  const rules = FILE_RULES[kind as keyof typeof FILE_RULES];
  if (!rules || !rules.expression.test(filename)) {
    return new Response("Referencia de media inválida.", { status: 400 });
  }
  if (!isAllowedProtectedMediaFile(kind, filename)) {
    return new Response("Media no encontrada.", { status: 404 });
  }

  try {
    if (process.env.NODE_ENV === "production") {
      return new Response("Media no disponible.", { status: 404 });
    }
    const { readPrivateLocalMedia } = await import("@/media/local-media-reader.dev");
    const bytes = await readPrivateLocalMedia(kind, filename);
    if (!bytes) return new Response("Media no encontrada.", { status: 404 });
    return new Response(bytes, {
      status: 200,
      headers: {
        "Cache-Control": "private, max-age=31536000, immutable",
        "Content-Type": rules.contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Media no encontrada.", { status: 404 });
  }
}
