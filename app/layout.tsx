import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PostHogIdentitySync } from "@/components/PostHogIdentitySync";
import { Toaster } from "@/components/ui/Toaster";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "JobPilot — AI-Powered Job Hunting Assistant",
  description:
    "JobPilot finds the jobs, researches the companies, and gives you everything you need to stand out.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <PostHogIdentitySync />
        <Toaster />
        {children}
      </body>
    </html>
  );
}
