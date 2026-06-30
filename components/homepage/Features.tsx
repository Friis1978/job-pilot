import Image from "next/image";

type Feature = {
  title: string;
  description: string;
};

const features: Feature[] = [
  {
    title: "Skills, experience, and seniority — all scored",
    description:
      "Every job gets three separate scores so you can see exactly where you match and where you don't before spending an hour on an application.",
  },
  {
    title: "Your profile powers everything",
    description:
      "Add your work history, skills, and resume once. The AI uses it to score jobs, write cover letters, tailor your resume, and brief you on company fit — automatically.",
  },
  {
    title: "Gaps surfaced before the interview",
    description:
      "See which skills are missing and get specific interview prep questions so you walk in knowing exactly what to address.",
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
              src="/images/research-2026-06-30.jpeg"
              alt="DevJobInfo match score and company research"
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
