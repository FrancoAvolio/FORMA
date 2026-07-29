/** @vitest-environment jsdom */

import { describe, expect, it, vi } from "vitest";

import type { ExerciseMedia } from "@/media";

import {
  fetchPdfImageDataUrl,
  loadRoutinePdfDetails,
  loadRoutinePdfImages,
} from "./prepare-routine-pdf";

const jpegMedia: ExerciseMedia = {
  exerciseId: "0017",
  available: true,
  thumbnailUrl: "/images/0017.jpg",
  animationUrl: "/videos/0017.gif",
  width: 180,
  height: 180,
  attribution: "© Gym visual",
  protectedMedia: true,
  unavailableReason: null,
};

describe("routine PDF preparation", () => {
  it("loads only the selected validated instruction records on demand", async () => {
    const details = await loadRoutinePdfDetails(["0017", "0025"]);

    expect(details).toHaveLength(2);
    expect(details[0]?.id).toBe("0017");
    expect(details[0]?.instructionStepsEs.length).toBeGreaterThan(1);
    expect(details[0]?.sourceAttribution).toContain("exercises-dataset");
  });

  it("turns supported image bytes into a PDF-safe data URL", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]), {
        headers: { "content-type": "image/jpeg" },
      }),
    );

    await expect(fetchPdfImageDataUrl("https://forma.test/image.jpg", fetcher)).resolves.toBe(
      "data:image/jpeg;base64,/9j/2Q==",
    );
    expect(fetcher).toHaveBeenCalledWith("https://forma.test/image.jpg", {
      credentials: "same-origin",
    });
  });

  it("ignores a failed thumbnail and never requests the GIF", async () => {
    const requested: string[] = [];
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      requested.push(String(input));
      return new Response("missing", { status: 404 });
    });

    const images = await loadRoutinePdfImages({
      exerciseIds: ["0017"],
      media: { "0017": jpegMedia },
      origin: "https://forma.test",
      fetcher,
    });

    expect(images.size).toBe(0);
    expect(requested).toEqual(["https://forma.test/images/0017.jpg"]);
    expect(requested.join(" ")).not.toContain(".gif");
  });

  it("rejects formats the PDF renderer cannot embed", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(Uint8Array.from([1, 2, 3]), {
        headers: { "content-type": "image/webp" },
      }),
    );
    await expect(
      fetchPdfImageDataUrl("https://forma.test/image.webp", fetcher),
    ).rejects.toThrow("formato de imagen");
  });
});
