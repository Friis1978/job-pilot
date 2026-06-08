import Image from "next/image";
import Link from "next/link";

export function Hero() {
  return (
    <div className="w-full bg-background px-6 pt-5">
      {/* Gradient card — rounded, text + CTAs only */}
      <div className="hero-gradient w-full max-w-300 mx-auto border border-border flex flex-col items-center text-center pt-16 pb-14">
        <h1 className="font-bold text-text-primary max-w-2xl text-5xl leading-tight tracking-tight">
          Job hunting is hard.
          <br />
          Your tools shouldn&apos;t be.
        </h1>

        <p className="mt-4 text-text-secondary text-sm max-w-sm leading-relaxed">
          Stop applying blind. JobPilot finds the jobs, researches the companies, and gives you
          everything you need to stand out.
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

      {/* Dashboard preview — gray background, no rounded corners, separate section */}
      <div className="w-full max-w-300 mx-auto bg-background border border-border p-10">
        <Image
          src="/images/dashboard-demo.png"
          alt="JobPilot dashboard"
          width={1200}
          height={700}
          className="w-full h-auto"
          priority
        />
      </div>
    </div>
  );
}
