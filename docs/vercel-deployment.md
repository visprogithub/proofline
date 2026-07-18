# Vercel deployment from GitHub

Proofline is a Vite application with one optional Vercel Function for quota-protected hosted skeptic assessments. The committed `vercel.json` pins the install and build commands, publishes `dist`, configures the function ceiling, adds the SPA fallback rewrite, and supplies baseline browser-security headers.

## 1. Import the repository

1. Push the repository to GitHub with `vercel.json`, `package.json`, and `package-lock.json` committed.
2. In Vercel, select **Add New → Project** and import the GitHub repository.
3. Keep the repository root as the **Root Directory**. Vercel should identify the framework as **Vite**.
4. The committed configuration supplies these settings:

   ```text
   Install Command: npm install
   Build Command: npm run build
   Output Directory: dist
   Node.js: 24.x
   ```

Vercel uses `npm install` for deployment compatibility while honoring the committed `package-lock.json`. Local development and GitHub Actions use the stricter `npm ci` clean-install path.

## 2. Add the public Supabase browser configuration

GitHub sign-in is optional. To enable it, add these variables under **Project Settings → Environment Variables**:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Use the values from the Supabase project settings. Apply them to **Production** and, only if OAuth should work on preview deployments, **Preview**. These values are included in the Vite browser bundle by design; never put the GitHub OAuth client secret in Vercel or any `VITE_` variable.

Deployments built before an environment-variable change do not receive the new value, so redeploy after adding or changing either variable.

## 3. Configure the optional hosted skeptic

Add these as server-only Vercel environment variables:

```text
HF_TOKEN
HF_MODEL
RATE_LIMIT_SALT
```

`RATE_LIMIT_SALT` should be a long random value. Do not use a `VITE_` prefix for any of these values; that prefix would expose them to the browser bundle. Optional budget variables are `AI_PER_CLIENT_DAILY_LIMIT`, `AI_GLOBAL_DAILY_LIMIT`, `AI_GLOBAL_DAILY_TOKEN_LIMIT`, `AI_PROVIDER_TIMEOUT_MS`, and `AI_MAX_OUTPUT_TOKENS`. Limits are held only in the warm function instance and reset when Vercel recycles or redeploys it.

For local end-to-end testing, use `npm run dev:full`. It loads `.env.local`, mounts the same skeptic handler used by `api/skeptic.ts`, and serves Vite at `http://localhost:3000` without deploying.

## 4. Deploy and finish the OAuth redirect

1. Select **Deploy**. Vercel will build the production site from the connected GitHub repository.
2. Copy the resulting production URL, such as `https://proofline.example.vercel.app`.
3. In Supabase, open **Authentication → URL Configuration**:
   - Set **Site URL** to the production Vercel URL.
   - Add `https://proofline.example.vercel.app/**` to the redirect allow list.
4. Keep the GitHub OAuth application's callback URL set to the Supabase callback URL—not the Vercel URL:

   ```text
   https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
   ```

5. Redeploy if the Supabase variables were added after the first build.

Preview deployments use different hostnames. Leave GitHub sign-in disabled on previews initially, or add a narrowly scoped Supabase redirect wildcard for the project's Vercel preview domains before enabling the variables in Vercel's Preview environment.

## 5. Verify the production deployment

1. Open the production URL in a private browser window and run the bundled evidence dossier.
2. Analyze a public commit anonymously.
3. Select **Connect GitHub**, complete OAuth, and confirm Proofline shows the authenticated allowance.
4. Analyze a public pull request or commit while connected.
5. Open a non-root path directly and confirm the SPA loads rather than returning a Vercel 404.
6. With hosted skeptic variables configured, rerun an analysis with assessable hunks, preview the payload, consent, and verify the UI shows assessed/not-assessed counts plus remaining daily allowance or a clear limit message.

The deterministic demo and local import work without the optional function. Hosted skeptic assessments require the function and server-only secrets above.
