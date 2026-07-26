import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <section className="shell" style={{ paddingBlock: "5rem", maxWidth: "45rem" }}>
      <p className="eyebrow">Error 404</p>
      <h1 style={{ color: "var(--color-brand)", fontSize: "var(--text-3xl)" }}>
        Esta página no está en la rutina.
      </h1>
      <p style={{ color: "var(--color-body)", lineHeight: 1.6 }}>
        El enlace puede haber cambiado. Volvé al inicio o explorá el catálogo disponible.
      </p>
      <Link className="button button-primary" href="/">
        <ArrowLeft aria-hidden="true" size={18} /> Volver al inicio
      </Link>
    </section>
  );
}
