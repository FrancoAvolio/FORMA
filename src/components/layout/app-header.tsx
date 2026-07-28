import { Menu } from "lucide-react";
import Link from "next/link";

import styles from "./app-header.module.css";

export function AppHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link
          className={styles.menu}
          href="/crear/chat"
          aria-label="Abrir la conversación con FORMA"
        >
          <Menu aria-hidden="true" size={21} strokeWidth={1.8} />
        </Link>
        <Link className={styles.brand} href="/" aria-label="FORMA, inicio">
          FORMA
        </Link>
        <nav className={styles.desktopNav} aria-label="Navegación principal">
          <Link href="/crear/chat">Hablar con FORMA</Link>
          <Link href="/ejercicios">Ejercicios</Link>
          <Link href="/guardadas">Guardadas</Link>
          <Link href="/atribuciones">Fuentes</Link>
        </nav>
        <span className={styles.monogram} aria-hidden="true">
          F
        </span>
      </div>
    </header>
  );
}
