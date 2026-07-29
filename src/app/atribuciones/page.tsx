import type { Metadata } from "next";
import { Database, ExternalLink, Images, ShieldCheck } from "lucide-react";

import source from "@/data/source/dataset-source.json";

import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Fuentes y atribuciones",
  description: "Origen, versión y condiciones de uso del catálogo de ejercicios de FORMA.",
};

export default function AttributionsPage() {
  return (
    <div className={[styles.page, "shell"].join(" ")}>
      <header className={styles.heading}>
        <p className="eyebrow">Transparencia del catálogo</p>
        <h1>Fuentes, atribuciones y licencia</h1>
        <p>
          La lógica de FORMA es propia. Los datos descriptivos y el material visual de
          ejercicios tienen orígenes y permisos distintos; acá podés revisar esa frontera.
        </p>
      </header>

      <section className={styles.summary} aria-label="Resumen del origen de los datos">
        <article className="card">
          <Database aria-hidden="true" />
          <span>Registros de origen</span>
          <strong>{source.expectedCounts.exerciseCount.toLocaleString("es-AR")}</strong>
        </article>
        <article className="card">
          <ShieldCheck aria-hidden="true" />
          <span>Versión fijada</span>
          <strong>{source.commit.slice(0, 10)}</strong>
        </article>
        <article className="card">
          <Images aria-hidden="true" />
          <span>Media pública</span>
          <strong>Uso limitado autorizado</strong>
        </article>
      </section>

      <div className={styles.sections}>
        <section aria-labelledby="dataset-title">
          <p className="eyebrow">01 · Dataset</p>
          <h2 id="dataset-title">Datos descriptivos bajo licencia MIT</h2>
          <p>
            El catálogo fuente es <em>exercises-dataset</em>, creado por Hasan Emir
            Yıldırım. FORMA usa un snapshot reproducible del commit completo indicado abajo,
            valida su esquema y genera una selección curada antes de habilitar ejercicios para
            rutinas.
          </p>
          <dl>
            <div>
              <dt>Repositorio</dt>
              <dd>
                <a href={source.repository} target="_blank" rel="noreferrer">
                  github.com/hasaneyldrm/exercises-dataset
                  <ExternalLink aria-hidden="true" size={15} />
                </a>
              </dd>
            </div>
            <div>
              <dt>Commit</dt>
              <dd className={styles.hash}>{source.commit}</dd>
            </div>
            <div>
              <dt>SHA-256 del dataset</dt>
              <dd className={styles.hash}>{source.hashes.datasetSha256}</dd>
            </div>
            <div>
              <dt>Licencia de datos</dt>
              <dd>MIT — texto e información estructurada, con excepción expresa de media.</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="media-title">
          <p className="eyebrow">02 · Imágenes y animaciones</p>
          <h2 id="media-title">© Gym visual — licencia separada</h2>
          <p>
            Las imágenes JPG y animaciones GIF del repositorio fuente son propiedad de Gym
            visual. No quedan cubiertas por la licencia MIT del dataset. Clonar el repositorio
            fuente no concede una licencia para reutilizarlas.
          </p>
          <div className={styles.notice} role="note">
            <Images aria-hidden="true" />
            <div>
              <strong>Despliegue limitado · licencia pendiente</strong>
              <p>
                El propietario del repositorio autorizó este despliegue personal de los
                archivos fijados, con atribución y marcas intactas. Esa decisión operativa no
                equivale a un permiso de Gym Visual ni cierra la revisión de licencia para un
                uso público o comercial.
              </p>
            </div>
          </div>
          <p>
            Cuando la media está habilitada, cada ejercicio conserva la indicación{" "}
            <strong>© Gym visual</strong> junto a la media y respeta la resolución de 180 × 180.
          </p>
          <a
            className={styles.external}
            href="https://gymvisual.com/content/3-terms-and-conditions-of-use"
            target="_blank"
            rel="noreferrer"
          >
            Revisar términos de Gym visual
            <ExternalLink aria-hidden="true" size={16} />
          </a>
        </section>

        <section aria-labelledby="curation-title">
          <p className="eyebrow">03 · Curación FORMA</p>
          <h2 id="curation-title">Selección auditable, no consejo clínico</h2>
          <p>
            FORMA normaliza nombres, aliases, patrones, dificultad y grupos de sustitución con
            reglas versionadas. La selección inicial requiere una revisión profesional antes de
            un lanzamiento público y no convierte al producto en una herramienta médica, de
            diagnóstico o rehabilitación.
          </p>
        </section>
      </div>
    </div>
  );
}
