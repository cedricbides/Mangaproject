import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev'
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000'

function baseEmailWrapper(content: string): string {
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0d0d14;color:#e2e2e2;border-radius:12px;overflow:hidden;">
      <div style="background:#e8394d;padding:24px 32px;">
        <h1 style="margin:0;color:#fff;font-size:22px;letter-spacing:2px;">MANGAVERSE</h1>
      </div>
      <div style="padding:32px;">
        ${content}
      </div>
    </div>
  `
}

export async function sendVerificationEmail(to: string, name: string, token: string) {
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set: skipping verification email')
    return
  }

  const link = `${CLIENT_URL}/verify-email?token=${token}`
  const html = baseEmailWrapper(`
    <h2 style="margin:0 0 12px;color:#fff;">Welcome, ${name}!</h2>
    <p style="color:#aaa;line-height:1.6;margin:0 0 24px;">
      Thanks for registering. Click the button below to verify your email and activate your account.
      This link expires in <strong style="color:#e2e2e2;">24 hours</strong>.
    </p>
    <a href="${link}" style="display:inline-block;padding:12px 28px;background:#e8394d;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">
      Verify Email Address
    </a>
    <p style="margin:24px 0 0;color:#666;font-size:13px;">
      If you didn't create an account, you can safely ignore this email.
    </p>
  `)

  const { error } = await resend.emails.send({ from: FROM, to, subject: 'Verify your MangaVerse account', html })
  if (error) {
    console.error('[email] sendVerificationEmail error:', error)
    throw new Error(error.message)
  }
}

export async function sendPasswordResetEmail(to: string, name: string, token: string) {
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set: skipping password reset email')
    return
  }

  const link = `${CLIENT_URL}/reset-password?token=${token}`
  const html = baseEmailWrapper(`
    <h2 style="margin:0 0 12px;color:#fff;">Reset your password</h2>
    <p style="color:#aaa;line-height:1.6;margin:0 0 24px;">
      Hi ${name}, we received a request to reset your password.
      Click the button below to choose a new one.
      This link expires in <strong style="color:#e2e2e2;">1 hour</strong>.
    </p>
    <a href="${link}" style="display:inline-block;padding:12px 28px;background:#e8394d;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">
      Reset Password
    </a>
    <p style="margin:24px 0 0;color:#666;font-size:13px;">
      If you didn't request this, you can safely ignore this email. Your password won't be changed.
    </p>
  `)

  const { error } = await resend.emails.send({ from: FROM, to, subject: 'Reset your MangaVerse password', html })
  if (error) {
    console.error('[email] sendPasswordResetEmail error:', error)
    throw new Error(error.message)
  }
}