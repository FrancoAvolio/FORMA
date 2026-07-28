"use client";

import { Bookmark, Dumbbell, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./bottom-navigation.module.css";

const items = [
  { href: "/crear/chat", activeRoot: "/crear", label: "Crear", Icon: MessageSquareText },
  { href: "/ejercicios", activeRoot: "/ejercicios", label: "Ejercicios", Icon: Dumbbell },
  { href: "/guardadas", activeRoot: "/guardadas", label: "Guardadas", Icon: Bookmark },
] as const;

export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} aria-label="Navegación móvil">
      {items.map(({ href, activeRoot, label, Icon }) => {
        const active = pathname === activeRoot || pathname.startsWith(`${activeRoot}/`);

        return (
          <Link
            key={href}
            className={styles.item}
            href={href}
            aria-current={active ? "page" : undefined}
          >
            <Icon aria-hidden="true" size={20} strokeWidth={1.8} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
