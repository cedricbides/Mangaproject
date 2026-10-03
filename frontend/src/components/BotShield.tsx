// frontend/src/components/BotShield.tsx
// Needs: npm i @marsidev/react-turnstile
// frontend/.env  ->  VITE_TURNSTILE_SITE_KEY=your_site_key
import { useEffect, useRef } from 'react'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

/** true when a site key is configured. Pages use this to decide whether to block the submit button. */
export const captchaEnabled = Boolean(SITE_KEY)

interface BotShieldProps {
  /** Called with the Turnstile token (or null when it expires / errors) */
  onToken: (token: string | null) => void
  /** Called with the honeypot value (should always be empty for real users) */
  onHoneypot?: (value: string) => void
  /** Increment this number to reset the widget (tokens are single-use, so reset after every submit) */
  resetKey?: number
}

export default function BotShield({ onToken, onHoneypot, resetKey = 0 }: BotShieldProps) {
  const ref = useRef<TurnstileInstance>(null)

  useEffect(() => {
    if (resetKey > 0) ref.current?.reset()
  }, [resetKey])

  return (
    <>
      {/* Honeypot: invisible to humans, bots fill it */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        onChange={e => onHoneypot?.(e.target.value)}
        style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, width: 0 }}
      />

      {SITE_KEY && (
        <div className="flex justify-center">
          <Turnstile
            ref={ref}
            siteKey={SITE_KEY}
            options={{ theme: 'dark' }}
            onSuccess={token => onToken(token)}
            onExpire={() => onToken(null)}
            onError={() => onToken(null)}
          />
        </div>
      )}
    </>
  )
}