import Link from "next/link";

export default function AppFooter() {
  return (
    <footer className="w-full border-t border-gray-700/50 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="mx-auto flex w-full flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
        <Link
          href="/"
          className="text-2xl font-black tracking-tight text-brand-logo"
        >
          CourtShare
        </Link>
        <nav className="flex items-center gap-6 text-sm font-semibold text-white/80">
          <Link href="/terms" className="transition-colors hover:text-white">
            Terms
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-white">
            Privacy
          </Link>
        </nav>
      </div>
    </footer>
  );
}
