"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconCalendar, IconChat, IconCheckSquare, IconGear, IconNote } from "./icons";

const TABS = [
  { href: "/", label: "Assistente", Icon: IconChat },
  { href: "/agenda", label: "Agenda", Icon: IconCalendar },
  { href: "/tarefas", label: "Tarefas", Icon: IconCheckSquare },
  { href: "/notas", label: "Notas", Icon: IconNote },
  { href: "/ajustes", label: "Ajustes", Icon: IconGear },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav aria-label="Principal" className="fixed bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur border-t border-line pb-safe">
      <ul className="max-w-xl mx-auto grid grid-cols-5">
        {TABS.map(({ href, label, Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined}
                className={`h-16 flex flex-col items-center justify-center gap-1 text-[11px] font-medium ${active ? "text-accent" : "text-muted"}`}>
                <Icon size={22} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
