import { LocalRoutineRepository } from "./routine-repository";
import { BrowserStorageDriver } from "./storage-driver";

export function createBrowserRoutineRepository(): LocalRoutineRepository {
  if (typeof window === "undefined") {
    throw new Error("Browser routine persistence is only available in a Client Component.");
  }

  return new LocalRoutineRepository(new BrowserStorageDriver());
}
