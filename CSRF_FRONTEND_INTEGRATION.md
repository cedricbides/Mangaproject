# Frontend CSRF Integration

The backend now requires a CSRF token on all POST/PUT/PATCH/DELETE requests.
Add this to your frontend in two steps:

## Step 1 — Fetch the token on app load

In `frontend/src/main.tsx` or your root App component, fetch the token once:

```ts
// utils/csrf.ts
let csrfToken = ''

export async function initCsrf() {
  const res = await fetch('/api/csrf-token', { credentials: 'include' })
  const data = await res.json()
  csrfToken = data.token
}

export function getCsrfToken() {
  return csrfToken
}
```

Call `initCsrf()` early in your app:

```tsx
// main.tsx
import { initCsrf } from './utils/csrf'

initCsrf().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
})
```

## Step 2 — Send the token on every mutating request

Wherever you call `fetch` with POST/PUT/PATCH/DELETE, add the header:

```ts
import { getCsrfToken } from './utils/csrf'

await fetch('/api/auth/profile', {
  method: 'PATCH',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'x-csrf-token': getCsrfToken(),   // ← add this line
  },
  body: JSON.stringify({ bio: '...' }),
})
```

> If you use axios, set it globally:
> ```ts
> import axios from 'axios'
> axios.defaults.headers.common['x-csrf-token'] = getCsrfToken()
> ```