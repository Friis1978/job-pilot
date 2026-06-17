import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PostHogIdentitySync } from "@/components/PostHogIdentitySync";
import { SessionKeepAlive } from "@/components/SessionKeepAlive";
import { Toaster } from "@/components/ui/Toaster";
import { BulkOpsProvider } from "@/components/BulkOpsProvider";
import { createInsforgeServer } from "@/lib/insforge-server";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "JobPilot — AI-Powered Job Hunting Assistant",
  description:
    "JobPilot finds the jobs, researches the companies, and gives you everything you need to stand out.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const insforge = await createInsforgeServer();
  const { data: { user } } = await insforge.auth.getCurrentUser();

  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {user && <PostHogIdentitySync userId={user.id} email={user.email ?? null} />}
        {user && <SessionKeepAlive />}
        <Toaster />
        <BulkOpsProvider>
          {children}
        </BulkOpsProvider>
      </body>
    </html>
  );
}
