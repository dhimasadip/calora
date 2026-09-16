import nodemailer from 'nodemailer'
import { loadEnv } from './env.js'

const env = loadEnv()

const CONNECTION_TIMEOUT_MS = 15_000
const GREETING_TIMEOUT_MS = 10_000
const SOCKET_TIMEOUT_MS = 45_000
const SEND_ATTEMPTS = 3

export function smtpConfigured(): boolean {
  return Boolean(env.smtpUser && env.smtpPass)
}

function transportOptions() {
  // Defaults to Gmail SMTP (STARTTLS on 587); SMTP_HOST/SMTP_PORT switch the relay
  // (e.g. a transactional provider) without code changes. family: 4 avoids the
  // unroutable IPv6 path on hosts with no global IPv6 (observed intermittent
  // "Connection timeout" failures in WSL).
  const host = env.smtpHost || 'smtp.gmail.com'
  const port = env.smtpHost ? env.smtpPort : 587
  return {
    host,
    port,
    secure: port === 465,
    family: 4,
    auth: { user: env.smtpUser, pass: env.smtpPass },
    // Bounded timeouts so a stalled/throttled relay fails fast instead of
    // hanging register for minutes (nodemailer defaults: 2min/30s/10min).
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    greetingTimeout: GREETING_TIMEOUT_MS,
    socketTimeout: SOCKET_TIMEOUT_MS,
  }
}

// Transient failures worth retrying: TCP-level hiccups, DNS blips, timeouts,
// and Gmail's "421 4.7.0 try again later" IP-reputation throttle. Permanent
// errors (535 bad credentials, 550 recipient rejected) fail immediately.
function isTransientError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code
  if (code && ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ESOCKET', 'EAI_AGAIN'].includes(code)) return true
  const responseCode = (error as { responseCode?: number } | null)?.responseCode
  if (responseCode === 421) return true
  const message = error instanceof Error ? error.message : String(error)
  return /timeout|timed out/i.test(message)
}

// Sends the verification email, retrying transient failures a few times with
// backoff. When SMTP credentials are missing, development logs the link to the
// console so the flow stays testable; production callers should check
// smtpConfigured() first and return 503.
export async function sendVerificationEmail(to: string, link: string) {
  if (!smtpConfigured()) {
    if (env.isProd) {
      const error = new Error('Email verification is not configured. Add SMTP_USER and SMTP_PASS to enable signups.')
      ;(error as Error & { statusCode?: number }).statusCode = 503
      throw error
    }
    console.warn(`[mailer] SMTP not configured — verification link for ${to}: ${link}`)
    return
  }
  const transport = nodemailer.createTransport(transportOptions())
  const from = env.smtpFrom || `Calora <${env.smtpUser}>`
  let lastError: unknown = null
  try {
    for (let attempt = 1; attempt <= SEND_ATTEMPTS; attempt++) {
      try {
        await transport.sendMail({
          from,
          to,
          subject: 'Verify your Calora email',
          text: `Welcome to Calora!\n\nPlease verify your email by opening this link (it expires in 24 hours):\n${link}\n\nIf you didn't create a Calora account, you can safely ignore this email.`,
          html: verificationEmailHtml(link),
        })
        return
      } catch (error) {
        lastError = error
        const retrying = attempt < SEND_ATTEMPTS && isTransientError(error)
        console.error(`[mailer] send attempt ${attempt}/${SEND_ATTEMPTS} failed${retrying ? ' (retrying)' : ''}`, error)
        if (!retrying) break
        await new Promise((resolve) => setTimeout(resolve, attempt * 2_000))
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Failed to send verification email')
  } finally {
    transport.close()
  }
}

// Calora-branded verification email. Mirrors the auth screen design: cream
// canvas, Georgia serif wordmark and headline, warm orange pill CTA, and a
// soft card for the small print. Table-based with inline styles so it renders
// consistently across desktop and mobile clients (Outlook falls back to
// bgcolor + mso-padding).
function verificationEmailHtml(link: string): string {
  const fontStack = 'Inter, Helvetica, Arial, sans-serif'
  const serifStack = 'Georgia, "Times New Roman", serif'
  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background-color:#fff8ef;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">One click and you're in — verify your Calora email.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#fff8ef;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;width:100%;">
          <tr>
            <td style="border-radius:28px 28px 0 0;background:linear-gradient(100deg,#ffd89a 0%,#ffe9c4 45%,#e1efc9 100%);background-color:#ffd89a;padding:36px 40px 30px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <span style="font-family:${serifStack};font-size:30px;font-weight:700;letter-spacing:-2.5px;color:#3c3027;">cal<span style="color:#d86930;">ora</span></span>
                  </td>
                  <td align="right" style="font-family:${fontStack};font-size:11px;font-weight:800;letter-spacing:2.5px;color:#a76c42;text-transform:uppercase;">✦&nbsp;Verify&nbsp;email</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="border-radius:0 0 28px 28px;background-color:#fffdf9;border:1px solid #ebd5bc;border-top:0;padding:36px 40px 30px;">
              <p style="margin:0 0 18px;font-family:${fontStack};font-size:11px;font-weight:800;letter-spacing:2.4px;text-transform:uppercase;color:#a76c42;">Almost there</p>
              <h1 style="margin:0 0 14px;font-family:${serifStack};font-size:34px;font-weight:600;line-height:1.1;letter-spacing:-1.5px;color:#3c3027;">Confirm your email.</h1>
              <p style="margin:0 0 28px;font-family:${fontStack};font-size:15px;line-height:1.6;color:#806655;">Thanks for creating your Calora account. One click and your gentle rhythm begins — food, movement, and calm progress in one place.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" style="mso-padding-alt:16px 36px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td align="center" bgcolor="#cc5e28" style="border-radius:99px;background-color:#cc5e28;">
                          <a href="${link}" target="_blank" style="display:inline-block;padding:16px 36px;border-radius:99px;background-color:#cc5e28;font-family:${fontStack};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">Verify my email</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin:22px 0 0;text-align:center;font-family:${fontStack};font-size:12px;color:#a08a77;word-break:break-all;">Button not working? Open this link instead:<br><a href="${link}" target="_blank" style="color:#b14e20;text-decoration:underline;">${link}</a></p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:30px;">
                <tr>
                  <td style="border-radius:18px;background-color:#fff4e6;border:1px solid #f2dcc2;padding:18px 20px;">
                    <p style="margin:0;font-family:${fontStack};font-size:13px;line-height:1.55;color:#8c6a52;"><strong style="color:#513c30;">This link expires in 24 hours.</strong><br>Didn't create a Calora account? You can safely ignore this email — nothing will change.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:26px 20px 8px;">
              <p style="margin:0 0 4px;font-family:${serifStack};font-size:16px;font-weight:700;letter-spacing:-1px;color:#9a8070;">cal<span style="color:#c47a4a;">ora</span></p>
              <p style="margin:0;font-family:${fontStack};font-size:11px;color:#9a8070;">A softer way to stay on track</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
