import Image from "next/image";
import Link from "next/link";

export function Hero() {
  return (
    <div className="w-full bg-background px-6 pt-5">
      {/* Gradient card — rounded, text + CTAs only */}
      <div className="hero-gradient w-full max-w-300 mx-auto flex flex-col items-center text-center px-4 sm:px-8 pt-12 sm:pt-16 pb-10 sm:pb-14">
        <h1 className="font-bold text-text-primary max-w-2xl text-3xl sm:text-5xl leading-tight tracking-tight">
          Find the jobs.
          <br />
          Research the companies.
          <br />
          Land the role.
        </h1>

        <p className="mt-4 text-text-secondary text-sm max-w-sm leading-relaxed">
          AI scores every role against your real skills, researches the company, writes your cover letter, and tells you who in your network to reach out to.
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

      {/* Dashboard preview — gray background, no rounded corners, separate section */}
      <div className="w-full max-w-300 mx-auto bg-surface-muted p-4 sm:p-10">
        <Image
          src="/images/dashboard-demo-top.jpeg"
          alt="DevJobInfo dashboard — job pipeline and activity"
          width={1200}
          height={700}
          className="w-full h-auto"
          priority
        />
      </div>
    </div>
  );
}
