# Supabase GitHub connection setup

Proofline can analyze public GitHub changes anonymously, but GitHub limits anonymous REST traffic to 60 requests per hour per IP. Optional Supabase GitHub OAuth gives each connected reviewer GitHub's authenticated allowance without placing a GitHub client secret in the browser bundle.

> [!NOTE]
> Use **Authentication → Sign In / Providers → GitHub** in Supabase. Do not create an entry under **OAuth Apps** or enable **OAuth Server**; those settings make Supabase an identity provider for other applications and are not needed for Proofline's GitHub sign-in.

## 1. Create the Supabase project

1. Create or sign in to a Supabase account.
2. Create a free project for Proofline.
3. In **Authentication → Sign In / Providers**, open **GitHub**. Keep this page available; it displays the Supabase callback URL.

No application tables or database migrations are required.

## 2. Register the GitHub OAuth app

1. In GitHub, open **Settings → Developer settings → OAuth Apps → New OAuth App**.
2. Use `Proofline` as the application name.
3. Set **Homepage URL** to the deployed Proofline URL. A localhost URL is acceptable during initial local setup.
4. Copy the callback URL from Supabase into GitHub's **Authorization callback URL** field. It normally looks like:

   ```text
   https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
   ```

5. Register the app, then generate its client secret.

Never place that GitHub client secret in `.env`, a `VITE_` variable, Vercel's client bundle, chat, screenshots, or this repository.

## 3. Configure Supabase

1. Return to Supabase's GitHub provider settings.
2. Enable the provider.
3. Enter the GitHub OAuth Client ID and Client Secret there, then save.
4. Under **Authentication → URL Configuration**, set the deployed Proofline URL as the site URL.
5. Add the local and deployed callback destinations to the redirect allow list, for example:

   ```text
   http://localhost:5173/**
   https://YOUR_PROOFLINE_DOMAIN/**
   ```

Proofline requests no GitHub OAuth scopes, so this MVP connection is for authenticated reads of public repositories only.

## 4. Configure Proofline

Copy `.env.example` to `.env.local` and add only the public Supabase browser values from **Project Settings → API**:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_PUBLIC_KEY
```

For Vercel, create the same two environment variables in the project settings and redeploy. Restart the local Vite server after changing environment variables.

## 5. Verify safely

1. Open Proofline and select **Connect GitHub**.
2. Review GitHub's authorization screen and authorize the new OAuth app.
3. Confirm Proofline shows **Connected as USERNAME** and the authenticated allowance.
4. Analyze a public commit or pull request.
5. Select **Use anonymous** and confirm the UI returns to anonymous mode.
6. To revoke the OAuth grant itself, remove Proofline from GitHub's authorized OAuth apps. Signing out of Proofline only stops using the token in that browser tab.

The Supabase session and GitHub provider token use `sessionStorage`, not `localStorage`; closing the tab clears the browser copy. Supabase still maintains the managed authentication user/session records required for OAuth.
