"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/find-jobs", label: "Find Jobs" },
  { href: "/network", label: "Network" },
  { href: "/profile", label: "Profile" },
];

const ADMIN_LINK = { href: "/admin", label: "Admin" };

export type NavUser = {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
};

type Props = { user?: NavUser; hasAccount?: boolean; isAdmin?: boolean; creditBalance?: number };

function getInitials(name?: string | null, email?: string | null): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2)
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return "?";
}

export function Navbar({ user, hasAccount, isAdmin, creditBalance }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <header className="w-full bg-surface border-b border-border py-3 sm:h-16 sm:py-0 flex items-center">
      <div className="w-full max-w-360 mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-y-3">
        <Link href="/" className="flex items-center">
          <Image src="/developerjobs-logo-horizontal.svg" alt="DevJobInfo" width={160} height={40} className="h-8 w-auto" />
        </Link>

        {user && (
          <nav className="order-3 w-full flex items-center justify-center gap-5 sm:gap-8 sm:order-0 sm:w-auto">
            {[...NAV_LINKS, ...(isAdmin ? [ADMIN_LINK] : [])].map(({ href, label }) => {
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
        )}

        {user ? (
          <div className="flex items-center gap-2">
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setOpen((o) => !o)}
              className="flex items-center justify-center w-9 h-9 rounded-full overflow-hidden border-2 border-border hover:border-accent transition-colors focus:outline-none"
              aria-label="User menu"
            >
              {user.avatarUrl ? (
                <Image
                  src={user.avatarUrl}
                  alt={user.name ?? "User"}
                  width={36}
                  height={36}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-accent flex items-center justify-center text-accent-foreground text-sm font-semibold">
                  {getInitials(user.name, user.email)}
                </div>
              )}
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-44 bg-surface border border-border rounded-xl shadow-lg py-1 z-50">
                {(user.name || user.email) && (
                  <div className="px-3 py-2 border-b border-border">
                    {user.name && (
                      <p className="text-xs font-semibold text-text-primary truncate">
                        {user.name}
                      </p>
                    )}
                    {user.email && (
                      <p className="text-xs text-text-muted truncate">{user.email}</p>
                    )}
                  </div>
                )}
                <Link
                  href="/profile"
                  onClick={() => setOpen(false)}
                  className="block px-3 py-2 text-sm text-text-primary hover:bg-surface-secondary transition-colors"
                >
                  Profile
                </Link>
                <Link
                  href="/payment"
                  onClick={() => setOpen(false)}
                  className="block px-3 py-2 text-sm text-text-primary hover:bg-surface-secondary transition-colors"
                >
                  Credits
                </Link>
                <button
                  onClick={handleSignOut}
                  className="w-full text-left px-3 py-2 text-sm text-error hover:bg-surface-secondary transition-colors"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
          </div>
        ) : (
          <Link
            href="/auth/login"
            className="bg-text-primary text-surface text-xs sm:text-sm font-medium px-3 sm:px-4 py-2 rounded-md hover:bg-text-darker transition-colors"
          >
            {hasAccount ? "Log in" : "Start for free"}
          </Link>
        )}
      </div>
    </header>
  );
}
