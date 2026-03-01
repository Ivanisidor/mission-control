"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeSwitcher } from "./ThemeSwitcher";

const nav = [
  { href: "/tasks", label: "Task Board" },
  { href: "/calendar", label: "Calendar" },
  { href: "/office", label: "Office" },
  { href: "/team", label: "Team" },
  { href: "/memory", label: "Memory" },
  { href: "/follow-ups", label: "Follow-Ups" },
  { href: "/activity", label: "Activity" },
  { href: "/weekly-summary", label: "Weekly Summary" },
  { href: "/search", label: "Search" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-full border-b bg-white/70 p-2 backdrop-blur supports-[backdrop-filter]:bg-white/50 md:w-72 md:border-b-0 md:border-r">
      <div className="rounded-xl border bg-white/70 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold tracking-tight">Mission Control</div>
            <div className="text-xs text-muted-foreground">Nux dashboard</div>
          </div>
          <ThemeSwitcher />
        </div>
      </div>
      <nav className="px-1 pb-1 pt-3 md:pb-4">
        <ul className="flex gap-1 overflow-x-auto pb-2 md:block md:space-y-1 md:overflow-visible md:pb-0">
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  className={`block whitespace-nowrap rounded-md px-3 py-2 text-sm transition ${
                    active
                      ? "bg-black text-white shadow-sm"
                      : "hover:bg-black/5"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
