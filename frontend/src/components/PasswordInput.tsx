import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

interface PasswordInputProps {
  value: string
  onChange: (value: string) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  placeholder?: string
  autoComplete?: string
  autoFocus?: boolean
}

/** Password field with a show/hide (eye) toggle. Theme-aware (dark / dim / light). */
export default function PasswordInput({
  value, onChange, onKeyDown, placeholder = '••••••••', autoComplete, autoFocus,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        placeholder={placeholder}
        className="w-full bg-[var(--card)] border border-[var(--border)] focus:border-primary rounded-lg pl-4 pr-11 py-2.5 text-sm text-text placeholder-text-muted outline-none transition-colors font-body"
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        title={visible ? 'Hide password' : 'Show password'}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 w-11 flex items-center justify-center text-text-muted hover:text-text transition-colors"
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}
