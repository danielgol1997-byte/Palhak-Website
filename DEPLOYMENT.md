# Deployment Checklist

## Pre-Deployment Setup

### 1. Database (Neon)
- [ ] Create Neon Postgres database
- [ ] Get **pooled** connection string → `DATABASE_URL`
- [ ] Get **direct** connection string → `DIRECT_URL`
- [ ] Verify backups are enabled in Neon console

### 2. Google OAuth
- [ ] Create OAuth application in Google Cloud Console
- [ ] Add redirect URIs:
  - `http://localhost:3000/api/auth/callback/google` (local)
  - `https://your-app.vercel.app/api/auth/callback/google` (production)
- [ ] Get `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

### 3. Environment Variables
Generate `NEXTAUTH_SECRET`:
```bash
openssl rand -base64 32
```

## Vercel Deployment Steps

### 1. Push to Git
```bash
# Make sure you're on the branch you want to deploy
git checkout production  # or dev
git push origin production
```

### 2. Create Vercel Project
- [ ] Go to [Vercel Dashboard](https://vercel.com/dashboard)
- [ ] Click "Add New Project"
- [ ] Import your Git repository
- [ ] Select branch: `production` (for production) or `dev` (for preview)

### 3. Configure Environment Variables
In Vercel Project Settings → Environment Variables, add:

**Required:**
- [ ] `DATABASE_URL` - Neon pooled connection string
- [ ] `DIRECT_URL` - Neon direct connection string  
- [ ] `NEXTAUTH_URL` - Your Vercel URL (e.g., `https://your-app.vercel.app`)
- [ ] `NEXTAUTH_SECRET` - Generated secret key
- [ ] `GOOGLE_CLIENT_ID` - From Google Cloud Console
- [ ] `GOOGLE_CLIENT_SECRET` - From Google Cloud Console
- [ ] `SEED_SUPER_ADMIN_EMAIL` - Admin email
- [ ] `SEED_SUPER_ADMIN_NAME` - Admin name
- [ ] `NODE_ENV=production`

**Optional:**
- [ ] `GOOGLE_ALLOWED_DOMAINS` - Comma-separated domain list

### 4. Run Database Migrations (BEFORE first deployment)
```bash
# Option 1: Using local environment
# Set DIRECT_URL in .env to production database
npx prisma migrate deploy

# Option 2: Using Vercel CLI
vercel env pull .env.production
npx prisma migrate deploy
```

### 5. Deploy
- [ ] Push to your connected branch
- [ ] Vercel will automatically build and deploy
- [ ] Check build logs to ensure:
  - [ ] Prisma client generates successfully (`postinstall` script)
  - [ ] Next.js build completes without errors
  - [ ] No missing environment variables

### 6. Verify Deployment
- [ ] Visit your Vercel URL
- [ ] Test Google OAuth login
- [ ] Verify database connection works
- [ ] Check that Prisma queries execute correctly

## Branch Strategy

- **`main`**: Default branch (can be used for production)
- **`dev`**: Development branch (for testing/preview deployments)
- **`production`**: Production branch (for production deployments)

## Troubleshooting

### Build Fails - Prisma Client Not Generated
- Ensure `postinstall` script is in `package.json`
- Check that `prisma` is in `dependencies` (not `devDependencies`)

### Database Connection Errors
- Verify `DATABASE_URL` uses pooled connection
- Check that `DIRECT_URL` is set for migrations
- Ensure database is accessible from Vercel's IP ranges

### Authentication Not Working
- Verify `NEXTAUTH_URL` matches your Vercel deployment URL exactly
- Check Google OAuth redirect URI includes your Vercel domain
- Ensure `NEXTAUTH_SECRET` is set

### Migrations Not Applied
- Run `prisma migrate deploy` manually before deployment
- Check that `DIRECT_URL` points to the correct database
- Verify migration files are committed to Git

## Post-Deployment

- [ ] Run seed script if needed: `npx prisma db seed` (idempotent)
- [ ] Set up monitoring/alerts in Vercel
- [ ] Configure custom domain (if needed)
- [ ] Set up environment-specific variables for dev/production

