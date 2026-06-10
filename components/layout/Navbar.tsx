"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/find-jobs", label: "Find Jobs" },
  { href: "/profile", label: "Profile" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="w-full bg-surface border-b border-border py-3 sm:h-16 sm:py-0 flex items-center">
      <div className="w-full max-w-360 mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-y-3">
        <Link href="/" className="flex items-center">
          <Image src="/logo.png" alt="JobPilot" width={64} height={64} className="h-8 w-auto" />
        </Link>

        <nav className="order-3 w-full flex items-center justify-center gap-5 sm:gap-8 sm:order-0 sm:w-auto">
          {NAV_LINKS.map(({ href, label }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={
                  isActive
                    ? "text-xs sm:text-sm font-medium text-accent underline decoration-accent decoration-2 underline-offset-4"
                    : "text-xs sm:text-sm font-medium text-text-dark hover:text-accent transition-colors"
                }
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/auth/login"
          className="bg-text-primary text-surface text-xs sm:text-sm font-medium px-3 sm:px-4 py-2 rounded-md hover:bg-text-darker transition-colors"
        >
          Start for free
        </Link>
      </div>
    </header>
  );
}
