import Link from "next/link";

export function BottomCTA() {
  return (
    <section className="w-full bg-background px-6 pb-5">
      <div className="hero-gradient w-full max-w-300 mx-auto flex flex-col items-center text-center py-14 sm:py-20 px-5 sm:px-8">
        <h2 className="font-bold text-text-primary max-w-lg text-3xl sm:text-4xl leading-tight tracking-tight">
          Land your next role faster.
        </h2>

        <p className="mt-4 text-text-secondary text-sm max-w-xs leading-relaxed">
          Scores, research, cover letters, and warm intros — everything you need from one profile.
        </p>

        <div className="mt-8 flex w-full max-w-xl flex-col sm:flex-row items-center gap-3">
          <Link
            href="/auth/login"
            className="bg-text-primary text-surface text-sm font-medium px-5 py-2.5 rounded-md hover:bg-text-darker transition-colors flex items-center justify-center gap-1.5 w-full sm:w-auto"
          >
            Get Started <span>→</span>
          </Link>
          <Link
            href="/auth/login"
            className="bg-surface text-text-primary text-sm font-medium px-5 py-2.5 rounded-md hover:bg-surface-secondary transition-colors w-full sm:w-auto"
          >
            Find Your First Match
          </Link>
        </div>
      </div>
    </section>
  );
}
