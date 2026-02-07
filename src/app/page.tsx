import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">Mission Control</h1>
      <p className="text-sm text-muted-foreground">
        Your dashboard for Nux activity, scheduled tasks, and global search.
      </p>
      <div className="flex gap-2">
        <Link className="rounded-md bg-black px-4 py-2 text-sm text-white" href="/activity">
          Activity
        </Link>
        <Link className="rounded-md border bg-white px-4 py-2 text-sm" href="/calendar">
          Calendar
        </Link>
        <Link className="rounded-md border bg-white px-4 py-2 text-sm" href="/search">
          Search
        </Link>
      </div>
    </div>
  );
}
