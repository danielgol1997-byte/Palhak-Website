# Palhak Equipment Management (Hebrew RTL) — Next.js + Neon + Prisma + NextAuth (Google)

Production-focused, Hebrew-only RTL equipment-management web app built with:
- Next.js App Router + TypeScript + Tailwind
- Prisma ORM + Neon Postgres (no SQLite)
- Auth.js / NextAuth with Google OAuth (simple “Login with Google”)

## Local setup

### 1) Install

```bash
npm install
```

### 2) Configure environment variables

Copy `.env.example` to `.env` and fill values:
- `DATABASE_URL`: Neon runtime connection string
- `DIRECT_URL`: Neon direct connection string (for Prisma migrations)
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Optional: `GOOGLE_ALLOWED_DOMAINS` (comma-separated) to restrict logins (recommended)
- `SEED_SUPER_ADMIN_EMAIL`, `SEED_SUPER_ADMIN_NAME`

### 3) Run migrations

```bash
npx prisma migrate dev
```

### 4) Seed (idempotent, non-destructive)

```bash
npx prisma db seed
```

### 5) Start dev server

```bash
npm run dev
```

Open `http://localhost:3000`.

## Vercel + Neon deployment

### Prerequisites
1. **Neon Database Setup**
   - Create a Postgres database in Neon
   - Use Neon **pooled** URL for `DATABASE_URL` (runtime connection)
   - Use Neon **direct** URL for `DIRECT_URL` (for Prisma migrations)
   - Neon backups: rely on Neon managed backups (configure/verify in Neon console)

2. **Google OAuth Setup**
   - Create a Google OAuth application in [Google Cloud Console](https://console.cloud.google.com/)
   - Add authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google` (for local dev)
     - `https://your-domain.vercel.app/api/auth/callback/google` (for production)
   - Get `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

### Vercel Deployment Steps

1. **Push to Git Repository**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Create Vercel Project**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "Add New Project"
   - Import your Git repository
   - Select the `production` branch (or `main` for initial setup)

3. **Configure Environment Variables**
   In Vercel Project Settings → Environment Variables, add all variables from `.env.example`:
   - `DATABASE_URL` (Neon pooled connection string)
   - `DIRECT_URL` (Neon direct connection string)
   - `NEXTAUTH_URL` (your Vercel deployment URL, e.g., `https://your-app.vercel.app`)
   - `NEXTAUTH_SECRET` (generate with: `openssl rand -base64 32`)
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_ALLOWED_DOMAINS` (optional, comma-separated)
   - `SEED_SUPER_ADMIN_EMAIL`
   - `SEED_SUPER_ADMIN_NAME`
   - `NODE_ENV=production`

4. **Run Database Migrations**
   Before first deployment, run migrations manually:
   ```bash
   # Set DIRECT_URL in your local .env to point to production database
   npx prisma migrate deploy
   ```
   
   Or use Vercel CLI:
   ```bash
   vercel env pull .env.production
   npx prisma migrate deploy
   ```

5. **Deploy**
   - Vercel will automatically build and deploy on push to the connected branch
   - The `postinstall` script will run `prisma generate` automatically
   - Check build logs to ensure Prisma client is generated successfully

### Branch Strategy
- **`main`** or **`production`**: Production deployments (connected to Vercel production)
- **`dev`**: Development/testing deployments (can connect to Vercel preview deployments)

### Important Notes
- **Database Migrations**: Run `prisma migrate deploy` manually before first deployment
- **Prisma Client**: Automatically generated via `postinstall` script during build
- **Environment Variables**: Must be set in Vercel for each environment (Production, Preview, Development)
- **NEXTAUTH_URL**: Must match your Vercel deployment URL exactly

## Notes
- UI is Hebrew-only RTL (`<html dir=\"rtl\" lang=\"he\">`).
- Reference data uses soft-delete (`active=false`).
- Critical operations are implemented transactionally and write append-only audit logs.
