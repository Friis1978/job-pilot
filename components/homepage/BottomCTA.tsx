import Link from "next/link";

export function BottomCTA() {
  return (
    <section className="w-full bg-background px-6 pb-5">
      <div className="hero-gradient w-full max-w-300 mx-auto flex flex-col items-center text-center py-20 px-8">
        <h2 className="font-bold text-text-primary max-w-lg text-4xl leading-tight tracking-tight">
          Your next job search can feel a lot less overwhelming
        </h2>

        <p className="mt-4 text-text-secondary text-sm max-w-xs leading-relaxed">
          Set up your profile, upload your resume, and start finding matches in minutes.
        </p>

        <div className="mt-8 flex items-center gap-3">
          <Link
            href="/login"
            className="bg-text-primary text-surface text-sm font-medium px-5 py-2.5 rounded-md hover:bg-text-darker transition-colors flex items-center gap-1.5"
          >
            Get Started <span>→</span>
          </Link>
          <Link
            href="/login"
            className="bg-surface text-text-primary text-sm font-medium px-5 py-2.5 rounded-md border border-border hover:bg-surface-secondary transition-colors"
          >
            Find Your First Match
          </Link>
        </div>
      </div>
    </section>
  );
}
