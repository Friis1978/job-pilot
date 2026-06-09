import Image from "next/image";

type Feature = {
  title: string;
  description: string;
};

const features: Feature[] = [
  {
    title: "Find jobs that actually fit",
    description:
      "Search by title and location or paste a job link. Get matched roles you can quickly scan.",
  },
  {
    title: "Know the Company Before You Apply",
    description:
      "Stop guessing what a company is about. JobPilot browses their site and gives you everything you need to apply with confidence.",
  },
  {
    title: "Keep track of every application",
    description:
      "Keep a clear view of every job you've found, tailored. Your activity and progress all stay in one simple place.",
  },
];

export function HowItWorks() {
  return (
    <section className="w-full bg-background px-6">
      <div className="w-full max-w-300 mx-auto bg-surface-muted overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 items-stretch">
          {/* Left — text */}
          <div className="bg-surface px-8 py-12 sm:px-10 sm:py-16 lg:px-12 lg:py-20">
            <h2 className="font-bold text-text-primary text-3xl sm:text-4xl leading-tight">
              Manage Your Job
              <br />
              Search With Ease
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

          {/* Right — jobs list screenshot */}
          <div className="flex items-center justify-center p-8 sm:p-10 lg:p-12">
            <div className="overflow-hidden w-full">
              <Image
                src="/images/jobs-lists.png"
                alt="Jobs list with match scores"
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
