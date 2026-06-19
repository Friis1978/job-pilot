import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

const FROM = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Sends a "pending approval" email to a newly registered user.
 * Non-fatal — logs errors but never throws.
 */
export async function sendPendingEmail(to: string, name: string): Promise<void> {
  try {
    await resend.emails.send({
      from: `Job Pilot <${FROM}>`,
      to,
      subject: "Your Job Pilot account is pending approval",
      html: `
        <p>Hi ${name},</p>
        <p>Thanks for signing up to <strong>Job Pilot</strong>.</p>
        <p>Your account is currently <strong>pending admin approval</strong>. You'll receive an email as soon as you're approved and ready to go.</p>
        <p>We'll be in touch shortly.</p>
        <br />
        <p>— The Job Pilot team</p>
      `,
    });
  } catch (err) {
    console.error("[lib/resend] sendPendingEmail failed", err);
  }
}

/**
 * Sends an approval confirmation email with a login link.
 * Non-fatal — logs errors but never throws.
 */
export async function sendApprovedEmail(to: string, name: string): Promise<void> {
  try {
    await resend.emails.send({
      from: `Job Pilot <${FROM}>`,
      to,
      subject: "You're approved — welcome to Job Pilot",
      html: `
        <p>Hi ${name},</p>
        <p>Great news — your <strong>Job Pilot</strong> account has been approved!</p>
        <p>You can now log in and start finding jobs:</p>
        <p><a href="${APP_URL}/auth/login" style="background:#18181b;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin:8px 0;">Log in to Job Pilot</a></p>
        <br />
        <p>— The Job Pilot team</p>
      `,
    });
  } catch (err) {
    console.error("[lib/resend] sendApprovedEmail failed", err);
  }
}

/**
 * Notifies the admin that a new user has signed up and is awaiting approval.
 * Non-fatal — logs errors but never throws.
 */
export async function sendAdminNotificationEmail(
  newUserEmail: string,
  newUserName: string,
): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return;
  try {
    await resend.emails.send({
      from: `Job Pilot <${FROM}>`,
      to: adminEmail,
      subject: `New sign-up: ${newUserName || newUserEmail}`,
      html: `
        <p>A new user has signed up to <strong>Job Pilot</strong> and is awaiting your approval.</p>
        <ul>
          <li><strong>Name:</strong> ${newUserName || "—"}</li>
          <li><strong>Email:</strong> ${newUserEmail}</li>
        </ul>
        <p><a href="${APP_URL}/admin" style="background:#18181b;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin:8px 0;">Review in admin panel</a></p>
      `,
    });
  } catch (err) {
    console.error("[lib/resend] sendAdminNotificationEmail failed", err);
  }
}
