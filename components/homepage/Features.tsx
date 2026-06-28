import Image from "next/image";

type Feature = {
  title: string;
  description: string;
};

const features: Feature[] = [
  {
    title: "Understand your match score",
    description:
      "See how your profile lines up with each role before you apply. Get a clear breakdown of what fits and what's missing.",
  },
  {
    title: "AI-Powered Job Matching",
    description:
      "Stop guessing which jobs are worth applying to. DeveloperJobs scores every role against your actual skills so you focus on the ones that matter.",
  },
  {
    title: "Focus on the right roles",
    description:
      "Filter out low fit jobs and stay on the ones that actually matter. Spend less time sorting and more time applying.",
  },
];

export function Features() {
  return (
    <section className="w-full bg-background px-6 py-12">
      <div className="w-full max-w-300 mx-auto bg-surface-muted overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 items-stretch">
          {/* Left — agent log screenshot */}
          <div className="flex items-center justify-center p-8 sm:p-10 lg:p-12">
            <Image
              src="/images/onboarding-research.webp"
              alt="DeveloperJobs match score and company research"
              width={600}
              height={400}
              className="w-full h-auto"
            />
          </div>

          {/* Right — text */}
          <div className="bg-surface px-8 py-12 sm:px-10 sm:py-16 lg:px-12 lg:py-20">
            <h2 className="font-bold text-text-primary text-3xl sm:text-4xl leading-tight">
              Apply With More
              <br />
              Confidence, Every Time
            </h2>

            <div className="mt-10 flex flex-col gap-7">
              {features.map((feature, index) => (
                <div
                  key={feature.title}
                  className={`pl-4 border-l-2 ${index === 1 ? "border-accent" : "border-border"}`}
                >
                  <p className="text-sm font-semibold text-text-primary mb-1">{feature.title}</p>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
