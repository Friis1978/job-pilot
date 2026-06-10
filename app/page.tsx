import { cookies } from "next/headers";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/homepage/Hero";
import { HowItWorks } from "@/components/homepage/HowItWorks";
import { Features } from "@/components/homepage/Features";
import { Testimonial } from "@/components/homepage/Testimonial";
import { BottomCTA } from "@/components/homepage/BottomCTA";

export default async function HomePage() {
  const cookieStore = await cookies();
  const hasAccount = cookieStore.has("jp_has_account");

  return (
    <main className="flex flex-col min-h-screen">
      <Navbar hasAccount={hasAccount} />
      <Hero />
      <HowItWorks />
      <Features />
      <Testimonial />
      <BottomCTA />
      <Footer />
    </main>
  );
}
