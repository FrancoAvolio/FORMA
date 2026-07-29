/** @vitest-environment jsdom */

import { describe, expect, it, vi } from "vitest";

import { exportRoutineToDevice } from "./export-routine-to-device";

const data = {
  filename: "forma-rutina.txt",
  text: "Rutina FORMA\n",
  title: "Mi rutina",
};

describe("exportRoutineToDevice", () => {
  it("uses a shareable text file when the phone supports it", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const file = new File([data.text], data.filename, { type: "text/plain" });
    const download = vi.fn();

    await expect(
      exportRoutineToDevice(data, {
        canShare: ({ files }) => Boolean(files?.length),
        createFile: () => file,
        download,
        share,
      }),
    ).resolves.toBe("shared");

    expect(share).toHaveBeenCalledWith({ files: [file], title: data.title });
    expect(download).not.toHaveBeenCalled();
  });

  it("shares text when file sharing is unavailable", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const download = vi.fn();

    await expect(
      exportRoutineToDevice(data, {
        canShare: () => false,
        createFile: () => null,
        download,
        share,
      }),
    ).resolves.toBe("shared");

    expect(share).toHaveBeenCalledWith({ text: data.text, title: data.title });
    expect(download).not.toHaveBeenCalled();
  });

  it("downloads a text file as the universal fallback", async () => {
    const download = vi.fn();

    await expect(
      exportRoutineToDevice(data, {
        createFile: () => null,
        download,
      }),
    ).resolves.toBe("downloaded");
    expect(download).toHaveBeenCalledWith(data);
  });

  it("does not download when the user cancels the native share sheet", async () => {
    const download = vi.fn();

    await expect(
      exportRoutineToDevice(data, {
        createFile: () => null,
        download,
        share: vi.fn().mockRejectedValue(new DOMException("Cancelado", "AbortError")),
      }),
    ).resolves.toBe("cancelled");
    expect(download).not.toHaveBeenCalled();
  });
});
