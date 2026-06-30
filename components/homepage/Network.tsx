import Image from "next/image";

const features = [
  {
    title: "See who you know at every company",
    description:
      "Import your LinkedIn connections once. DevJobInfo cross-references them against every job in your list so you always know when a warm intro is possible.",
  },
  {
    title: "AI picks the best person to reach out to",
    description:
      "From all your contacts at a company, the AI recommends one — the recruiter, the hiring manager, or whoever is most relevant — and explains why.",
  },
  {
    title: "A ready-to-send LinkedIn message in seconds",
    description:
      "One click generates a personalised, under-300-character outreach message for the chosen contact. Copy it straight into LinkedIn.",
  },
];

export function Network() {
  return (
    <section className="w-full bg-background px-6">
      <div className="w-full max-w-300 mx-auto bg-surface-muted overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 items-stretch">
          {/* Left — text */}
          <div className="bg-surface px-8 py-12 sm:px-10 sm:py-16 lg:px-12 lg:py-20">
            <h2 className="font-bold text-text-primary text-3xl sm:text-4xl leading-tight">
              Your Network,
              <br />
              Working For You
            </h2>

            <div className="mt-10 flex flex-col gap-7">
              {features.map((feature, index) => (
                <div
                  key={feature.title}
                  className={`pl-4 border-l-2 ${index === 0 ? "border-accent" : "border-border"}`}
                >
                  <p className="text-sm font-semibold text-text-primary mb-1">{feature.title}</p>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right — screenshot */}
          <div className="flex items-center justify-center p-8 sm:p-10 lg:p-12">
            <div className="overflow-hidden w-full">
              <Image
                src="/images/network-contacts-2026-06-30.jpeg"
                alt="AI-recommended contact and LinkedIn message generation"
                width={800}
                height={560}
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
