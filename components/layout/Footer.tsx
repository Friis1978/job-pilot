import Image from "next/image";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="w-full bg-surface border-t border-border">
      <div className="w-full max-w-[1440px] mx-auto px-8 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0">
            <Image src="/logo.png" alt="JobPilot" width={36} height={36} />
          </div>
          <span className="text-[19px] leading-7 font-bold text-text-darkest">JobPilot</span>
        </Link>

        <nav className="flex items-center gap-8">
          <Link
            href="/dashboard"
            className="text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/privacy"
            className="text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Privacy Policy
          </Link>
          <Link
            href="/terms"
            className="text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Terms &amp; Condition
          </Link>
        </nav>
      </div>
    </footer>
  );
}
