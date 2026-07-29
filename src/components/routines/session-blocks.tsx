import type { RoutineSessionBlock } from "@/domain/routine/schemas";

import styles from "./session-blocks.module.css";

export function SessionBlocks({
  blocks,
}: {
  blocks: readonly RoutineSessionBlock[] | undefined;
}) {
  if (!blocks || blocks.length === 0) return null;

  return (
    <section className={styles.section} aria-label="Preparación y cierre de la sesión">
      <header>
        <strong>Tiempo planificado, no series extra</strong>
        <span>
          {blocks.reduce((total, block) => total + block.estimatedMinutes, 0)} min
        </span>
      </header>
      <ul>
        {blocks.map((block) => (
          <li key={block.kind}>
            <div>
              <strong>{block.title}</strong>
              <span>{block.estimatedMinutes} min</span>
            </div>
            <p>{block.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
