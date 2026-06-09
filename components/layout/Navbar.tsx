import Image from "next/image";
import Link from "next/link";

export function Navbar() {
  return (
    <header className="w-full bg-surface border-b border-border py-3 sm:h-16 sm:py-0 flex items-center">
      <div className="w-full max-w-360 mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-y-3">
        <Link href="/" className="flex items-center">
          <Image src="/logo.png" alt="JobPilot" width={64} height={64} className="h-8 w-auto" />
        </Link>

        <nav className="order-3 w-full flex items-center justify-center gap-5 sm:gap-8 sm:order-0 sm:w-auto">
          <Link
            href="/dashboard"
            className="text-xs sm:text-sm font-medium text-text-dark hover:text-accent transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/find-jobs"
            className="text-xs sm:text-sm font-medium text-text-dark hover:text-accent transition-colors"
          >
            Find Jobs
          </Link>
          <Link
            href="/profile"
            className="text-xs sm:text-sm font-medium text-text-dark hover:text-accent transition-colors"
          >
            Profile
          </Link>
        </nav>

        <Link
          href="/login"
          className="bg-text-primary text-surface text-xs sm:text-sm font-medium px-3 sm:px-4 py-2 rounded-md hover:bg-text-darker transition-colors"
        >
          Start for free
        </Link>
      </div>
    </header>
  );
}
