import Image from "next/image";

export function Testimonial() {
  return (
    <section className="w-full bg-background px-6">
      <div className="w-full max-w-300 mx-auto bg-surface px-8 py-24 flex flex-col items-center text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-8">
          Success Stories
        </p>

        <blockquote className="font-medium text-text-primary max-w-2xl text-2xl leading-[1.45]">
          &ldquo;I used to spend my evenings copy-pasting resumes. Now I open my dashboard to see
          interviews waiting. It feels like cheating. Had 3 offers on the table
          simultaneously.&rdquo;
        </blockquote>

        <div className="mt-8 flex items-center gap-3">
          <Image
            src="/images/user-icon.png"
            alt="Tom Wilson"
            width={40}
            height={40}
            className="rounded-full object-cover w-10 h-10"
          />
          <div className="text-left">
            <p className="text-sm font-semibold text-text-primary">Tom Wilson</p>
            <p className="text-xs text-text-muted">Junior Developer</p>
          </div>
        </div>
      </div>
    </section>
  );
}
