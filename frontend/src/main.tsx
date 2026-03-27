import React from 'react'
import ReactDOM from 'react-dom/client'
import axios from 'axios'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'
import { initCsrf, getCsrfToken } from './utils/csrf'

// Set base URL for all API calls
axios.defaults.baseURL = (import.meta as any).env?.VITE_API_URL || ''

// Attach CSRF token to every mutating axios request automatically
axios.interceptors.request.use((config) => {
  const method = config.method?.toLowerCase()
  if (method && ['post', 'put', 'patch', 'delete'].includes(method)) {
    config.headers['x-csrf-token'] = getCsrfToken()
  }
  return config
})

// Global react-query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

initCsrf().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </React.StrictMode>
  )
})