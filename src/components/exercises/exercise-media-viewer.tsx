"use client";

import { ImageIcon, Play, Square } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

import type { ExerciseMedia } from "@/media";
import { createBrowserRoutineRepository } from "@/persistence";

import styles from "./exercise-media.module.css";

type ExerciseMediaViewerProps = {
  name: string;
  media: ExerciseMedia;
};

export function ExerciseMediaViewer({ name, media }: ExerciseMediaViewerProps) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    if (!media.animationUrl) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const autoplayConfigured =
      process.env.NEXT_PUBLIC_AUTOPLAY_EXERCISE_MEDIA === "true";
    void createBrowserRoutineRepository()
      .loadMediaPlaybackPreference()
      .then((preference) => {
        if (
          !reducedMotion &&
          (preference === "animated" ||
            (preference === "system" && autoplayConfigured))
        ) {
          setAnimated(true);
        }
      });
  }, [media.animationUrl]);

  const toggle = () => {
    const next = !animated;
    setAnimated(next);
    void createBrowserRoutineRepository().saveMediaPlaybackPreference(
      next ? "animated" : "static",
    );
  };

  const source = animated && media.animationUrl ? media.animationUrl : media.thumbnailUrl;

  return (
    <div className={styles.viewer}>
      <div className={styles.viewerImage}>
        <Image
          key={source}
          src={source}
          width={media.width}
          height={media.height}
          alt={media.available ? "Demostración de " + name : ""}
          unoptimized
          priority
        />
        {!media.available && (
          <span className={styles.unavailable}>
            <ImageIcon aria-hidden="true" />
            Media no disponible
          </span>
        )}
      </div>
      <div className={styles.viewerFooter}>
        <small>
          {media.available
            ? media.attribution
            : "Los binarios protegidos están excluidos de producción."}
        </small>
        {media.animationUrl && (
          <button type="button" onClick={toggle} aria-pressed={animated}>
            {animated ? <Square aria-hidden="true" /> : <Play aria-hidden="true" />}
            {animated ? "Detener" : "Ver demostración"}
          </button>
        )}
      </div>
    </div>
  );
}
