/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import type { ImgHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";

import type { ExerciseMedia } from "@/media";

import { ExerciseThumbnail } from "./exercise-thumbnail";

vi.mock("next/image", () => ({
  default: (properties: ImgHTMLAttributes<HTMLImageElement>) => (
    // The test intentionally reduces Next Image to its semantic output.
    // eslint-disable-next-line @next/next/no-img-element
    <img {...properties} alt={properties.alt ?? ""} />
  ),
}));

const availableMedia: ExerciseMedia = {
  exerciseId: "0025",
  available: true,
  thumbnailUrl: "/api/exercise-media/images/0025-barbell-bench-press.jpg",
  animationUrl: "/api/exercise-media/videos/0025-barbell-bench-press.gif",
  width: 180,
  height: 180,
  attribution: "© Gym Visual",
  protectedMedia: true,
  unavailableReason: null,
};

describe("ExerciseThumbnail", () => {
  it("renders meaningful purpose text and visible attribution for real media", () => {
    render(<ExerciseThumbnail name="Press de banca con barra" media={availableMedia} />);

    expect(
      screen.getByAltText("Demostración estática de Press de banca con barra"),
    ).toHaveAttribute("width", "180");
    expect(screen.getByText("© Gym Visual")).toBeVisible();
  });

  it("keeps an explicit, non-broken placeholder state", () => {
    const { container } = render(
      <ExerciseThumbnail
        name="Press de banca con barra"
        media={{
          ...availableMedia,
          available: false,
          thumbnailUrl: "/exercises/placeholders/exercise-media.svg",
          animationUrl: null,
          attribution: null,
          protectedMedia: false,
          unavailableReason: "disabled_by_configuration",
        }}
      />,
    );

    expect(container.querySelector("img")).toHaveAttribute("alt", "");
    expect(
      screen.getByText("Media protegida · no disponible en este entorno"),
    ).toBeVisible();
  });
});
