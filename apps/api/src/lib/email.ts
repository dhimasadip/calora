import nodemailer, { type Transporter } from 'nodemailer'
import { loadEnv } from './env.js'

const env = loadEnv()

let transporter: Transporter | null = null

// Build the Gmail transporter lazily and reuse it. When the Gmail credentials are unset
// we stay in "dev mode": no transporter is created and emails are logged to the console
// instead (see sendVerificationEmail), so local signup flows work without a mail account.
function getTransporter(): Transporter | null {
  if (!env.smtpUser || !env.smtpPass) return null
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail', // presets smtp.gmail.com host/port + secure settings
      auth: { user: env.smtpUser, pass: env.smtpPass },
    })
  }
  return transporter
}

interface VerificationEmailParams {
  to: string
  displayName: string
  verifyUrl: string
}

export async function sendVerificationEmail({ to, displayName, verifyUrl }: VerificationEmailParams): Promise<void> {
  const tx = getTransporter()

  if (!tx) {
    // Dev fallback — no SMTP configured. Print the link so it can be opened locally.
    console.log(
      `\n📧 [email:dev] Verification email for ${to}\n   Open this link to verify:\n   ${verifyUrl}\n`,
    )
    return
  }

  await tx.sendMail({
    from: env.smtpFrom,
    to,
    subject: 'Verify your email for Calora',
    text: verificationEmailText(displayName, verifyUrl),
    html: verificationEmailHtml(displayName, verifyUrl),
  })
}

function verificationEmailText(displayName: string, verifyUrl: string): string {
  return [
    `Hi ${displayName},`,
    '',
    'Welcome to Calora! Please confirm your email address to activate your account.',
    '',
    'Verify your email by opening this link:',
    verifyUrl,
    '',
    'This link expires in 24 hours.',
    '',
    "If you didn't sign up for Calora, you can safely ignore this email.",
  ].join('\n')
}

// Branded HTML email. Uses table layout + inline styles for broad email-client support.
function verificationEmailHtml(displayName: string, verifyUrl: string): string {
  const safeName = escapeHtml(displayName)
  const safeUrl = escapeHtml(verifyUrl)
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Verify your email for Calora</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
            <tr>
              <td style="padding:32px 40px 8px 40px;">
                <div style="font-size:28px;font-weight:700;color:#0f172a;letter-spacing:-0.5px;">
                  Cal<span style="color:#16a34a;">ora</span>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 40px 0 40px;">
                <h1 style="margin:16px 0 8px 0;font-size:20px;line-height:1.4;color:#0f172a;">Confirm your email</h1>
                <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#475569;">
                  Hi ${safeName}, welcome to Calora! Tap the button below to verify your email address and activate your account.
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:8px 40px 24px 40px;">
                <a href="${safeUrl}" target="_blank"
                   style="display:inline-block;background-color:#16a34a;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:14px 32px;border-radius:10px;">
                  Verify my email
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 8px 40px;">
                <p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:#64748b;">
                  Or paste this link into your browser:
                </p>
                <p style="margin:0 0 16px 0;font-size:13px;line-height:1.6;word-break:break-all;">
                  <a href="${safeUrl}" target="_blank" style="color:#16a34a;">${safeUrl}</a>
                </p>
                <p style="margin:0 0 24px 0;font-size:13px;line-height:1.6;color:#94a3b8;">
                  This link expires in 24 hours.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 40px 32px 40px;border-top:1px solid #e2e8f0;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">
                  If you didn't sign up for Calora, you can safely ignore this email — no account will be activated.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
