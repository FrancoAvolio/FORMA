import type { RoutineTextExport } from "@/application/routines/export-routine";

export type RoutineExportOutcome = "cancelled" | "downloaded" | "shared";

export type RoutineExportEnvironment = {
  canShare?: (data: ShareData) => boolean;
  createFile: (data: RoutineTextExport) => File | null;
  download: (data: RoutineTextExport) => void;
  share?: (data: ShareData) => Promise<void>;
};

function isShareCancellation(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function browserEnvironment(): RoutineExportEnvironment {
  return {
    canShare:
      typeof navigator !== "undefined" && navigator.canShare
        ? navigator.canShare.bind(navigator)
        : undefined,
    createFile: (data) =>
      typeof File === "undefined"
        ? null
        : new File([data.text], data.filename, {
            type: "text/plain;charset=utf-8",
          }),
    download: (data) => {
      const blob = new Blob([data.text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = data.filename;
      anchor.hidden = true;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    },
    share:
      typeof navigator !== "undefined" && navigator.share
        ? navigator.share.bind(navigator)
        : undefined,
  };
}

export async function exportRoutineToDevice(
  data: RoutineTextExport,
  environment: RoutineExportEnvironment = browserEnvironment(),
): Promise<RoutineExportOutcome> {
  if (environment.share) {
    const file = environment.createFile(data);
    const fileShareData: ShareData | null = file
      ? { files: [file], title: data.title }
      : null;
    try {
      if (
        fileShareData &&
        environment.canShare &&
        environment.canShare(fileShareData)
      ) {
        await environment.share(fileShareData);
      } else {
        await environment.share({
          text: data.text,
          title: data.title,
        });
      }
      return "shared";
    } catch (error) {
      if (isShareCancellation(error)) return "cancelled";
    }
  }

  environment.download(data);
  return "downloaded";
}
