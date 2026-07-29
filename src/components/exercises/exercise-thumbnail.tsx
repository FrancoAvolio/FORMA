import Image from "next/image";

import type { ExerciseMedia } from "@/media";

import styles from "./exercise-media.module.css";

type ExerciseThumbnailProps = {
  name: string;
  media: ExerciseMedia;
  animated?: boolean;
  priority?: boolean;
};

export function ExerciseThumbnail({
  name,
  media,
  animated = false,
  priority = false,
}: ExerciseThumbnailProps) {
  const showAnimation = Boolean(
    animated && media.available && media.animationUrl,
  );

  return (
    <figure className={styles.thumbnail}>
      <Image
        src={showAnimation ? (media.animationUrl as string) : media.thumbnailUrl}
        width={media.width}
        height={media.height}
        alt={
          media.available
            ? `${showAnimation ? "Demostración animada" : "Demostración estática"} de ${name}`
            : ""
        }
        priority={priority}
        unoptimized
      />
      <figcaption>
        {media.available
          ? media.attribution
          : "Media protegida · no disponible en este entorno"}
      </figcaption>
    </figure>
  );
}
