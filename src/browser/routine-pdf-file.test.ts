/** @vitest-environment jsdom */

import { describe, expect, it, vi } from "vitest";

import type { PreparedRoutinePdf } from "./prepare-routine-pdf";
import {
  canShareRoutinePdf,
  downloadRoutinePdf,
  shareRoutinePdf,
} from "./routine-pdf-file";

const data: PreparedRoutinePdf = {
  blob: new Blob(["%PDF-test"], { type: "application/pdf" }),
  filename: "forma-rutina.pdf",
  title: "Mi rutina",
};

describe("routine PDF device adapter", () => {
  it("shares an application/pdf file after the PDF is ready", async () => {
    const file = new File([data.blob], data.filename, { type: "application/pdf" });
    const share = vi.fn().mockResolvedValue(undefined);
    const environment = {
      canShare: vi.fn(() => true),
      createFile: vi.fn(() => file),
      download: vi.fn(),
      share,
    };

    expect(canShareRoutinePdf(data, environment)).toBe(true);
    await expect(shareRoutinePdf(data, environment)).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith({ files: [file], title: "Mi rutina" });
    expect(file.type).toBe("application/pdf");
  });

  it("reports unsupported native sharing without downloading", async () => {
    const download = vi.fn();
    await expect(
      shareRoutinePdf(data, {
        createFile: () => null,
        download,
      }),
    ).resolves.toBe("unavailable");
    expect(download).not.toHaveBeenCalled();
  });

  it("does not download when the share sheet is cancelled", async () => {
    const download = vi.fn();
    await expect(
      shareRoutinePdf(data, {
        canShare: () => true,
        createFile: () =>
          new File([data.blob], data.filename, { type: "application/pdf" }),
        download,
        share: vi.fn().mockRejectedValue(new DOMException("Cancelado", "AbortError")),
      }),
    ).resolves.toBe("cancelled");
    expect(download).not.toHaveBeenCalled();
  });

  it("downloads the prepared PDF through the explicit save action", () => {
    const download = vi.fn();
    downloadRoutinePdf(data, {
      createFile: () => null,
      download,
    });
    expect(download).toHaveBeenCalledWith(data);
  });
});
