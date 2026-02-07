import Link from "next/link";

const nav = [
  { href: "/activity", label: "Activity" },
  { href: "/calendar", label: "Calendar" },
  { href: "/search", label: "Search" },
];

export function Sidebar() {
  return (
    <aside className="w-64 border-r bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50">
      <div className="p-4">
        <div className="text-lg font-semibold tracking-tight">Mission Control</div>
        <div className="text-xs text-muted-foreground">Nux dashboard</div>
      </div>
      <nav className="px-2 pb-4">
        <ul className="space-y-1">
          {nav.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block rounded-md px-3 py-2 text-sm hover:bg-black/5"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
