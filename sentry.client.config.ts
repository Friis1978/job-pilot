import * as Sentry from "@sentry/nextjs";
import { redactDeep } from "@/lib/ai/redact";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0,
  // Needed here more than on the server: the user types their Anthropic key
  // into a form in this browser, so a client-side error captured while that
  // input holds a value is the most likely way a key ever escapes.
  beforeSend(event) {
    return redactDeep(event);
  },
});
