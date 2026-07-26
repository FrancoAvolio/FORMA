/**
 * Stable data access entry points. Prefer the narrower module imports
 * (`@/data/catalog`, `@/data/details`, `@/data/routine-catalog`) when bundle
 * size matters so explorer/detail JSON is loaded only by its owning route.
 */
export * from "./catalog";
export * from "./details";
export * from "./media-manifest";
export * from "./routine-catalog";
export type * from "./types";

