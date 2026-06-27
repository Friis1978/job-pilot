import { CoverLetterSection } from 'job_pilot';

const SAMPLE_COVER_LETTER = `Dear Hiring Team,

I'm writing to express my strong interest in the Senior Frontend Engineer position at Stripe. With five years of experience building high-performance React applications and a deep focus on developer tooling, I'm excited by the opportunity to contribute to Stripe's mission of making financial infrastructure accessible to developers worldwide.

**Why Stripe**

Stripe's developer-first philosophy resonates with how I approach my own work. I've integrated the Stripe API in three projects and have always been impressed by the clarity of the documentation and the quality of the SDK. The opportunity to work on the product I use daily is genuinely exciting.

**What I bring**

In my current role at Acme Corp, I led the rebuild of our core dashboard using Next.js and TypeScript, reducing initial load time by 40% and improving Core Web Vitals scores from C to A. I work closely with design and backend teams to ship features that are both polished and performant.

I'd love the opportunity to discuss how my background aligns with the team's goals.

Sincerely,
Jane Doe`;

export function WithCoverLetter() {
  return (
    <CoverLetterSection
      jobId="job-123"
      initialCoverLetter={SAMPLE_COVER_LETTER}
      initialAdvice="Consider adding a specific metric about TypeScript migration impact. Your mention of Core Web Vitals is strong — expand it slightly."
      hasAvatar={true}
      tailoredSummary="Strong match for TypeScript and React. Stripe focuses heavily on developer experience, so highlight your SDK work."
    />
  );
}

export function Empty() {
  return (
    <CoverLetterSection
      jobId="job-456"
      initialCoverLetter={null}
      initialAdvice={null}
      hasAvatar={false}
    />
  );
}
