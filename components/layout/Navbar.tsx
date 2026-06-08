import Image from "next/image";
import Link from "next/link";

export function Navbar() {
  return (
    <header className="w-full bg-surface border-b border-border h-16 flex items-center">
      <div className="w-full max-w-[1440px] mx-auto px-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0">
            <Image src="/logo.png" alt="JobPilot" width={36} height={36} />
          </div>
          <span className="text-[19px] leading-7 font-bold text-text-darkest">JobPilot</span>
        </Link>

        <nav className="flex items-center gap-8">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-text-dark hover:text-accent transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/find-jobs"
            className="text-sm font-medium text-text-dark hover:text-accent transition-colors"
          >
            Find Jobs
          </Link>
          <Link
            href="/profile"
            className="text-sm font-medium text-text-dark hover:text-accent transition-colors"
          >
            Profile
          </Link>
        </nav>

        <Link
          href="/login"
          className="bg-text-primary text-surface text-sm font-medium px-4 py-2 rounded-md hover:bg-text-darker transition-colors"
        >
          Start for free
        </Link>
      </div>
    </header>
  );
}
