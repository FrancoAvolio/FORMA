import type { PreparedRoutinePdf } from "./prepare-routine-pdf";

export type RoutinePdfShareOutcome = "cancelled" | "shared" | "unavailable";

export type RoutinePdfFileEnvironment = {
  canShare?: (data: ShareData) => boolean;
  createFile: (data: PreparedRoutinePdf) => File | null;
  download: (data: PreparedRoutinePdf) => void;
  share?: (data: ShareData) => Promise<void>;
};

function browserEnvironment(): RoutinePdfFileEnvironment {
  return {
    canShare:
      typeof navigator !== "undefined" && navigator.canShare
        ? navigator.canShare.bind(navigator)
        : undefined,
    createFile: (data) =>
      typeof File === "undefined"
        ? null
        : new File([data.blob], data.filename, { type: "application/pdf" }),
    download: (data) => {
      const url = URL.createObjectURL(data.blob);
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

function isCancellation(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function canShareRoutinePdf(
  data: PreparedRoutinePdf,
  environment: RoutinePdfFileEnvironment = browserEnvironment(),
): boolean {
  if (!environment.share || !environment.canShare) return false;
  const file = environment.createFile(data);
  return Boolean(file && environment.canShare({ files: [file], title: data.title }));
}

export async function shareRoutinePdf(
  data: PreparedRoutinePdf,
  environment: RoutinePdfFileEnvironment = browserEnvironment(),
): Promise<RoutinePdfShareOutcome> {
  if (!environment.share || !environment.canShare) return "unavailable";
  const file = environment.createFile(data);
  const shareData: ShareData | null = file
    ? { files: [file], title: data.title }
    : null;
  if (!shareData || !environment.canShare(shareData)) return "unavailable";

  try {
    await environment.share(shareData);
    return "shared";
  } catch (error) {
    if (isCancellation(error)) return "cancelled";
    throw error;
  }
}

export function downloadRoutinePdf(
  data: PreparedRoutinePdf,
  environment: RoutinePdfFileEnvironment = browserEnvironment(),
): void {
  environment.download(data);
}
