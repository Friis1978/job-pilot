import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // The dev indicator sits bottom-left of every page and ends up burned into
  // the walkthrough recording. CSS could not reliably hide it — Next renders it
  // in a shadow host whose tag has changed between versions — so it is switched
  // off at source, but only while recording, since it is useful the rest of the
  // time. e2e/videos sets RECORDING=1.
  ...(process.env.RECORDING === "1" ? { devIndicators: false as const } : {}),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.insforge.app",
      },
    ],
  },
  serverExternalPackages: ["pdf-parse", "@react-pdf/renderer"],
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/array/:path*",
        destination: "https://eu-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
    ];
  },
  skipTrailingSlashRedirect: true,
};

export default withSentryConfig(nextConfig, {
  silent: true,
  disableLogger: true,
  widenClientFileUpload: true,
});
