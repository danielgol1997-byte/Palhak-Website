# Quick Vercel Deployment Setup Guide

## ✅ Completed

1. **Git Repository Setup**
   - ✅ Created `dev` and `production` branches
   - ✅ Pushed all code to GitHub: `danielgol1997-byte/Palhak-Website`
   - ✅ Deleted `main` branch
   - ✅ Set `production` as default branch

2. **Vercel Project Created**
   - ✅ Project name: `palhak-website`
   - ✅ URL: **https://palhak-website.vercel.app**
   - ✅ Connected to GitHub repository

## 🔄 Next Steps (IN ORDER)

### Step 1: Add Environment Variables to Vercel

Go to: https://vercel.com/danielgol1997-gmailcoms-projects/palhak-website/settings/environment-variables

#### Option A: Import .env file (Easiest)
1. Click "Import .env" button
2. Select your `.env` file from this project folder
3. Click "Save"

#### Option B: Copy/Paste Each Variable
Click "Add Another" for each variable below and paste the **Key** and the **Value** from your local `.env` (do **not** commit secrets to git):

- DATABASE_URL
- DIRECT_URL
- NEXTAUTH_URL
- NEXTAUTH_SECRET
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- GOOGLE_ALLOWED_DOMAINS (optional, can be empty)
- SEED_SUPER_ADMIN_EMAIL
- SEED_SUPER_ADMIN_NAME

**Then click "Save" at the bottom!**

### Step 2: Update Google OAuth Settings

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click on your OAuth 2.0 Client ID
3. Under "Authorized redirect URIs", add:
   ```
   https://palhak-website.vercel.app/api/auth/callback/google
   ```
4. Click "Save"

### Step 3: Trigger Deployment

After saving environment variables, Vercel should automatically redeploy. If not:

1. Go to: https://vercel.com/danielgol1997-gmailcoms-projects/palhak-website
2. Click "Deployments" tab
3. Click "Redeploy" on the latest deployment

### Step 4: Run Database Migrations

**Option A: Via Vercel Console (Recommended)**
1. Go to project → Deployments → (latest deployment)
2. Click on "Runtime Logs" or "Functions"
3. Find the console/terminal option
4. Run: `npx prisma migrate deploy`

**Option B: Via Local Vercel CLI**
```bash
# Pull production environment variables
vercel env pull .env.production

# Run migrations against production database
DATABASE_URL=$(grep DIRECT_URL .env.production | cut -d '=' -f2-) npx prisma migrate deploy
```

### Step 5: Seed the Database (First Time Only)

After migrations, seed the super admin user:
```bash
DATABASE_URL=$(grep DIRECT_URL .env.production | cut -d '=' -f2-) npx prisma db seed
```

### Step 6: Test Your Deployment

1. Visit: https://palhak-website.vercel.app
2. Click "Sign in with Google"
3. Log in with: `danielgol1997@gmail.com`
4. Verify you have admin access

## 📝 Important Notes

- **Production Branch**: Always merge changes to `production` branch for live deployments
- **Development**: Use `dev` branch for testing
- **Database**: Using Neon Postgres (already configured)
- **Authentication**: Google OAuth (needs redirect URI update)

## 🔧 Troubleshooting

### "Failed to fetch" or "Network Error"
- Check that all environment variables are added correctly
- Verify `NEXTAUTH_URL` matches your Vercel URL

### "OAuth Error" or "Redirect URI Mismatch"
- Ensure you added the Vercel URL to Google OAuth redirect URIs
- Clear browser cache and try again

### "Database Connection Error"
- Verify `DATABASE_URL` and `DIRECT_URL` are correct
- Check Neon database is active

### Build Fails
- Check build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- `postinstall` script should run `prisma generate` automatically

## 📚 Additional Resources

- Vercel Dashboard: https://vercel.com/dashboard
- Neon Console: https://console.neon.tech
- Google Cloud Console: https://console.cloud.google.com
- Project Repository: https://github.com/danielgol1997-byte/Palhak-Website

---

**Current Status**: Environment variables need to be added to Vercel, then deployment will complete automatically.


