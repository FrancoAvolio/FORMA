/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import type { ImgHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ExerciseMedia } from "@/media";

import { ExerciseThumbnail } from "./exercise-thumbnail";

vi.mock("next/image", () => ({
  default: (properties: ImgHTMLAttributes<HTMLImageElement>) => (
    // The test intentionally reduces Next Image to its semantic output.
    // eslint-disable-next-line @next/next/no-img-element
    <img {...properties} alt={properties.alt ?? ""} />
  ),
}));

afterEach(cleanup);

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

  it("loads the animation only when playback is explicitly requested", () => {
    const { rerender } = render(
      <ExerciseThumbnail name="Press de banca con barra" media={availableMedia} />,
    );

    expect(
      screen.getByAltText("Demostración estática de Press de banca con barra"),
    ).toHaveAttribute("src", availableMedia.thumbnailUrl);

    rerender(
      <ExerciseThumbnail
        name="Press de banca con barra"
        media={availableMedia}
        animated
      />,
    );

    expect(
      screen.getByAltText("Demostración animada de Press de banca con barra"),
    ).toHaveAttribute("src", availableMedia.animationUrl);
  });

  it("keeps the static image when no animation is available", () => {
    render(
      <ExerciseThumbnail
        name="Press de banca con barra"
        media={{ ...availableMedia, animationUrl: null }}
        animated
      />,
    );

    expect(
      screen.getByAltText("Demostración estática de Press de banca con barra"),
    ).toHaveAttribute("src", availableMedia.thumbnailUrl);
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
