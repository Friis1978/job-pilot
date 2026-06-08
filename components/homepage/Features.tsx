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
      "Stop guessing which jobs are worth applying to. JobPilot scores every role against your actual skills so you focus on the ones that matter.",
  },
  {
    title: "Focus on the right roles",
    description:
      "Filter out low fit jobs and stay on the ones that actually matter. Spend less time sorting and more time applying.",
  },
];

export function Features() {
  return (
    <section className="w-full bg-background px-6">
      <div className="w-full max-w-300 mx-auto bg-surface-muted border border-border px-12 py-20">
        <div className="grid grid-cols-2 gap-20 items-center">
          {/* Left — agent log screenshot */}
          <div>
            <Image
              src="/images/agnet-log.png"
              alt="JobPilot agent log"
              width={600}
              height={400}
              className="w-full h-auto"
            />
          </div>

          {/* Right — text */}
          <div>
            <h2 className="font-bold text-text-primary text-4xl leading-tight">
              Apply With More
              <br />
              Confidence, Every Time
            </h2>

            <div className="mt-10 flex flex-col gap-7">
              {features.map((feature) => (
                <div key={feature.title}>
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
