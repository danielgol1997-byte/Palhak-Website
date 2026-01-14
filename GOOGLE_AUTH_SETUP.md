# Google login setup (NextAuth) — required env vars

The app uses **Google OAuth** (simple “Login with Google”).

## Environment variables

- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- Optional (recommended): `GOOGLE_ALLOWED_DOMAINS` (comma-separated, e.g. `unit.example.mil`)

## Security behavior (important)

- If `GOOGLE_ALLOWED_DOMAINS` is set:
  - Only users from those domain(s) can sign in.
  - New users from allowed domains are **auto-activated**.
- If `GOOGLE_ALLOWED_DOMAINS` is NOT set:
  - New users are created **inactive** and cannot sign in until an admin activates them.

## Google Console configuration

In Google Cloud Console → Credentials → OAuth 2.0 Client ID:

- **Authorized redirect URI** must include:
  - `${NEXTAUTH_URL}/api/auth/callback/google`

Examples:
- Local dev: `http://localhost:3000/api/auth/callback/google`
- Vercel: `https://YOUR-PROJECT.vercel.app/api/auth/callback/google`


