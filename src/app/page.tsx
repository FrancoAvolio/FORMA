import {
  ArrowRight,
  BadgeCheck,
  ClipboardCheck,
  ClipboardList,
  MessageSquareText,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";

import { ExerciseThumbnail } from "@/components/exercises/exercise-thumbnail";
import { getExerciseSummaryById } from "@/data/catalog";
import { resolveExerciseMedia } from "@/media/server";

import styles from "./page.module.css";

const FEATURED_EXERCISE_ID = "0025";

function requireFeaturedExercise() {
  const exercise = getExerciseSummaryById(FEATURED_EXERCISE_ID);
  if (!exercise || !exercise.approvedForGeneration) {
    throw new Error(
      "The featured landing exercise must exist and remain generation-approved.",
    );
  }
  return exercise;
}

const featuredExercise = requireFeaturedExercise();

export default function Home() {
  return (
    <div>
      <section className={`${styles.hero} shell`}>
        <div className={styles.intro}>
          <p className="eyebrow">Tu rutina empieza con una conversación</p>
          <h1>Contá cómo querés entrenar.</h1>
          <p className={styles.lead}>
            Conversá con FORMA sobre tus objetivos, tiempo y equipamiento. El
            asistente ordena tu perfil y construye una rutina clara, editable y
            basada en ejercicios verificados.
          </p>
          <div className={styles.actions}>
            <Link className="button button-primary" href="/crear/chat">
              <MessageSquareText aria-hidden="true" size={18} /> Crear mi rutina
              con FORMA <ArrowRight aria-hidden="true" size={18} />
            </Link>
            <Link className="button button-secondary" href="/ejercicios">
              Explorar ejercicios
            </Link>
          </div>
          <div className={styles.manualFallback}>
            <Link href="/crear/manual">
              <ClipboardList aria-hidden="true" size={17} /> Prefiero completar
              los datos manualmente
            </Link>
          </div>
        </div>

        <aside
          className={styles.preview}
          aria-label="Vista previa de una conversación en FORMA"
        >
          <div className={styles.previewTop}>
            <span>Conversación</span>
            <span className={styles.mono}>Perfil · 4 de 6 datos</span>
          </div>
          <blockquote>
            “Quiero ganar masa muscular, tengo cuatro días por semana y entreno
            en un gimnasio completo.”
          </blockquote>
          <div className={styles.planLine}>
            <span>FORMA</span>
            <strong>
              Perfecto. Voy a orientar la rutina a hipertrofia. ¿Cuánto tiempo
              tenés por sesión?
            </strong>
          </div>
          <div className={styles.realMedia}>
            <ExerciseThumbnail
              name={
                featuredExercise.displayNameEs ?? featuredExercise.displayName
              }
              media={resolveExerciseMedia(featuredExercise.id)}
              priority
            />
            <div>
              <span>Ejercicio real del catálogo</span>
              <strong>
                {featuredExercise.displayNameEs ?? featuredExercise.displayName}
              </strong>
              <Link href={`/ejercicios/${featuredExercise.id}`}>
                Ver técnica y demostración
              </Link>
            </div>
          </div>
          <div className={styles.previewFooter}>
            <span>
              <BadgeCheck aria-hidden="true" size={20} /> Ejercicios verificados
            </span>
            <span>Motor validado</span>
          </div>
        </aside>
      </section>

      <section
        className={`${styles.principles} shell`}
        aria-labelledby="principios-title"
      >
        <div className={styles.sectionHeading}>
          <p className="eyebrow">Principios</p>
          <h2 id="principios-title">
            Una conversación que termina en un plan verificable.
          </h2>
        </div>
        <ol className={styles.principleGrid}>
          <li>
            <span>01</span>
            <MessageSquareText aria-hidden="true" />
            <h3>Pedilo con tus palabras</h3>
            <p>
              FORMA conversa con vos y pregunta solo lo esencial para avanzar.
            </p>
          </li>
          <li>
            <span>02</span>
            <ClipboardCheck aria-hidden="true" />
            <h3>Revisá cada decisión</h3>
            <p>
              Vas a ver tu perfil, los supuestos y las validaciones de la
              rutina.
            </p>
          </li>
          <li>
            <span>03</span>
            <SlidersHorizontal aria-hidden="true" />
            <h3>Cambiá lo que necesites</h3>
            <p>
              Pedí ajustes por chat o editá los datos sin perder el trabajo
              anterior.
            </p>
          </li>
        </ol>
      </section>

      <section
        className={`${styles.examples} shell`}
        aria-labelledby="examples-title"
      >
        <div>
          <p className="eyebrow">Ejemplos de inicio</p>
          <h2 id="examples-title">
            Empezá la conversación con una idea simple.
          </h2>
        </div>
        <div className={styles.exampleLinks}>
          {[
            ["Hipertrofia, 4 días, gimnasio completo", "hypertrophy"],
            ["Rutina en casa con dos mancuernas", "home"],
            ["Fuerza, 3 días, foco en sentadilla", "strength"],
          ].map(([label, example]) => (
            <Link key={example} href={`/crear/chat?ejemplo=${example}`}>
              <span>“{label}”</span>
              <ArrowRight aria-hidden="true" size={20} />
            </Link>
          ))}
        </div>
      </section>

      <footer className={styles.footer}>
        <div className="shell">
          <strong>FORMA</strong>
          <p>Planificación explicable para entrenamiento de fuerza.</p>
          <div className={styles.legalLinks}>
            <Link href="/atribuciones">Fuentes y licencias</Link>
            <Link href="/privacidad">Privacidad</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
