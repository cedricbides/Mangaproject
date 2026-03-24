// frontend/src/components/ErrorBoundary.tsx
// Catches JS errors in child component tree and shows a fallback UI instead of crashing the whole page.
import { Component, type ReactNode, type ErrorInfo } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    if (this.props.fallback) return this.props.fallback

    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center">
          <AlertTriangle size={24} className="text-red-400" />
        </div>
        <div>
          <h2 className="font-display text-lg text-white mb-1">Something went wrong</h2>
          <p className="text-sm font-body text-text-muted max-w-sm">
            This section encountered an error. The rest of the page is still working.
          </p>
          {this.state.error && (
            <p className="mt-2 text-xs font-mono text-red-400/70 max-w-sm truncate">
              {this.state.error.message}
            </p>
          )}
        </div>
        <button
          onClick={() => this.setState({ hasError: false, error: undefined })}
          className="flex items-center gap-2 px-4 py-2 glass border border-white/10 rounded-xl text-sm font-body text-text-muted hover:text-text transition-colors"
        >
          <RefreshCw size={14} /> Try again
        </button>
      </div>
    )
  }
}