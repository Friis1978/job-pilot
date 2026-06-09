import Image from "next/image";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="w-full bg-surface border-t border-border">
      <div className="w-full max-w-360 mx-auto px-4 sm:px-8 py-4 sm:h-16 sm:py-0 flex flex-wrap items-center justify-between gap-y-3">
        <Link href="/" className="flex items-center">
          <Image src="/logo.png" alt="JobPilot" width={64} height={64} className="h-8 w-auto" />
        </Link>

        <nav className="order-3 w-full flex items-center justify-center gap-5 sm:gap-8 sm:order-0 sm:w-auto">
          <Link
            href="/dashboard"
            className="text-xs sm:text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/privacy"
            className="text-xs sm:text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Privacy Policy
          </Link>
          <Link
            href="/terms"
            className="text-xs sm:text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Terms &amp; Conditions
          </Link>
        </nav>
      </div>
    </footer>
  );
}
