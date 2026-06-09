<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into JobPilot. PostHog is now initialized client-side via `instrumentation-client.ts` (the recommended approach for Next.js 15.3+), with a reverse proxy configured in `next.config.ts` to route analytics traffic through `/ingest` — improving ad-blocker resilience and data accuracy. A server-side PostHog client in `lib/posthog-server.ts` enables event capture from API routes. Five business-critical events are now tracked across the authentication funnel: OAuth provider button clicks, successful sign-ins (with user identification via JWT decoding), authentication failures categorized by reason, and sign-outs from both the dashboard and profile pages. Users are identified server-side at sign-in using the `sub` claim from the access token JWT, and the PostHog session is reset on sign-out to cleanly separate sessions.

| Event | Description | File |
|-------|-------------|------|
| `oauth_login_clicked` | User clicked an OAuth sign-in button (Google or GitHub) | `app/auth/login/page.tsx` |
| `user_signed_in` | User successfully completed OAuth sign-in | `app/auth/callback/route.ts` |
| `auth_failed` | OAuth sign-in attempt failed (with `reason` property) | `app/auth/callback/route.ts` |
| `user_signed_out` | User clicked the log out button from the dashboard | `app/dashboard/page.tsx` |
| `user_signed_out` | User clicked the log out button from the profile page | `app/profile/page.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics (wizard) — Dashboard](https://eu.posthog.com/project/197754/dashboard/734995)
- [Sign-in conversion funnel (wizard)](https://eu.posthog.com/project/197754/insights/bcEOgRCt)
- [OAuth login clicks by provider (wizard)](https://eu.posthog.com/project/197754/insights/HNlQW0MG)
- [Successful sign-ins over time (wizard)](https://eu.posthog.com/project/197754/insights/NaGMh9JF)
- [Auth failures over time (wizard)](https://eu.posthog.com/project/197754/insights/IzEHvqdi)
- [Sign-outs over time (wizard)](https://eu.posthog.com/project/197754/insights/3KRFXS5C)

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
