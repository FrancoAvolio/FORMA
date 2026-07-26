"use client";

import { Bookmark, Dumbbell, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./bottom-navigation.module.css";

const items = [
  { href: "/crear", label: "Crear", Icon: MessageSquareText },
  { href: "/ejercicios", label: "Ejercicios", Icon: Dumbbell },
  { href: "/guardadas", label: "Guardadas", Icon: Bookmark },
] as const;

export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} aria-label="Navegación móvil">
      {items.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);

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
