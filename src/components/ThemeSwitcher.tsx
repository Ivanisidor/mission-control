"use client";

import { useEffect, useState } from "react";

type ThemeId = "light" | "dark" | "vs-dark" | "dracula" | "ocean";

const THEMES: Array<{ id: ThemeId; label: string }> = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "vs-dark", label: "VS Dark" },
  { id: "dracula", label: "Dracula" },
  { id: "ocean", label: "Ocean" },
];

const STORAGE_KEY = "mission-control-theme";

function initialTheme(): ThemeId {
  if (typeof window === "undefined") return "dark";
  return (localStorage.getItem(STORAGE_KEY) as ThemeId | null) ?? "dark";
}

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<ThemeId>(() => initialTheme());

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  function updateTheme(next: ThemeId) {
    setTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <div className="rounded-lg border p-2">
      <div className="mb-1 text-[11px] font-medium text-muted-foreground">Theme</div>
      <select
        value={theme}
        onChange={(e) => updateTheme(e.target.value as ThemeId)}
        className="w-full rounded-md border bg-white px-2 py-1.5 text-xs"
      >
        {THEMES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
    </div>
  );
}
