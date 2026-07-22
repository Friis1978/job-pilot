import { NextResponse } from "next/server";
import { MISSING_KEY_MESSAGE, UserKeyError } from "@/lib/ai/claude";
import { getKeyStatus } from "@/lib/ai/user-key";

/**
 * The shape every AI route returns when the user's key is the problem.
 *
 * `code` is what the client switches on — the copy may change, and matching on
 * a message string would break silently when it does. `settingsUrl` means the
 * UI can link straight to the fix without hardcoding the route in a dozen
 * components.
 */
function keyProblem(message: string, code: "missing_api_key" | "invalid_api_key") {
  return NextResponse.json(
    { error: message, code, settingsUrl: "/settings/api-key" },
    { status: 403 },
  );
}

/**
 * Checked at the top of every AI route: returns a response to send back when
 * the user cannot make AI calls, or null when they can.
 *
 * A guard up front rather than relying on the error surfacing from inside:
 * agent code catches its own failures and degrades (scoreJob returns null, a
 * summary returns empty) so a missing key would otherwise reach the user as
 * "0 jobs found" rather than "add your key". Failing before any work starts
 * also avoids half-finishing a job search that was never going to complete.
 */
export async function keyGuard(userId: string): Promise<NextResponse | null> {
  const status = await getKeyStatus(userId);

  if (!status.hasKey) return keyProblem(MISSING_KEY_MESSAGE, "missing_api_key");

  if (status.status === "invalid") {
    return keyProblem(
      "Anthropic rejected your API key. Replace it to continue using AI features.",
      "invalid_api_key",
    );
  }

  return null;
}

/**
 * Translates a `UserKeyError` thrown mid-run into the same response shape.
 *
 * The guard cannot catch everything: a key can be revoked between the check and
 * the call, or partway through a job search. Returns null for anything that is
 * not a key problem so the caller falls through to its own error handling.
 */
export function keyErrorResponse(err: unknown): NextResponse | null {
  if (!(err instanceof UserKeyError)) return null;
  return keyProblem(
    err.message,
    err.reason === "missing" ? "missing_api_key" : "invalid_api_key",
  );
}

/** True when a caught error is a key problem — for code that re-throws rather than responds. */
export function isUserKeyError(err: unknown): err is UserKeyError {
  return err instanceof UserKeyError;
}
