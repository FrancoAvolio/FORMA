import type { Metadata } from "next";
import Link from "next/link";

import styles from "../atribuciones/page.module.css";

export const metadata: Metadata = {
  title: "Privacidad y datos locales",
  description: "Qué guarda FORMA, cuándo interviene un proveedor de IA y cómo borrar los datos.",
};

export default function PrivacyPage() {
  return (
    <div className={[styles.page, "shell"].join(" ")}>
      <header className={styles.heading}>
        <p className="eyebrow">Privacidad por diseño</p>
        <h1>Tus rutinas quedan en este navegador.</h1>
        <p>
          FORMA no tiene cuentas ni una base de datos propia. Esta versión guarda perfiles,
          borradores, conversaciones y rutinas únicamente en el almacenamiento local del
          navegador que estás usando.
        </p>
      </header>

      <div className={styles.sections}>
        <section>
          <p className="eyebrow">01 · Persistencia</p>
          <h2>Qué se guarda localmente</h2>
          <p>
            Se guardan las respuestas del formulario, el perfil estructurado derivado del
            chat, la rutina activa, las rutinas que elijas guardar y tu preferencia de
            reproducción de media. No se usan cookies de seguimiento ni identificadores de
            cuenta.
          </p>
          <p>
            Podés borrar todo desde <Link href="/guardadas">Rutinas guardadas</Link>. Borrar
            los datos del sitio desde el navegador produce el mismo resultado.
          </p>
          <p>
            Al exportar una rutina, FORMA genera el PDF completo dentro de este navegador y
            descarga las imágenes estáticas necesarias desde el mismo sitio. Después elegís
            si querés guardarlo o compartirlo con el menú nativo del teléfono; la versión TXT
            sigue disponible como alternativa liviana. FORMA no sube esa copia a un servidor
            propio.
          </p>
        </section>

        <section>
          <p className="eyebrow">02 · Asistente opcional</p>
          <h2>Cuándo sale información del navegador</h2>
          <p>
            El formulario guiado y el motor determinista no requieren IA. Si usás el chat,
            el mensaje y el perfil parcial se envían al adaptador configurado en el servidor:
            Ollama en desarrollo local o Cloudflare Workers AI en producción. Las credenciales
            y bindings nunca se envían al cliente.
          </p>
          <p>
            FORMA limita el tamaño y la frecuencia de esas solicitudes, no registra el texto
            de los mensajes en sus logs y conserva el borrador local si el proveedor falla.
            La política y retención del proveedor elegido deben revisarse antes del despliegue
            público.
          </p>
        </section>

        <section>
          <p className="eyebrow">03 · Alcance</p>
          <h2>Sin datos médicos ni diagnóstico</h2>
          <p>
            No ingreses historias clínicas ni información sensible. FORMA sólo pide un chequeo
            explícito de seguridad para decidir si puede generar una rutina educativa; bloquea
            solicitudes médicas, de rehabilitación o diagnóstico.
          </p>
          <p>
            Consultá también las <Link href="/atribuciones">fuentes y licencias</Link> del
            catálogo y de la media de ejercicios.
          </p>
        </section>
      </div>
    </div>
  );
}
