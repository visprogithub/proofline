# Vercel deployment from GitHub

Proofline is a static Vite application. The committed `vercel.json` pins the install and build commands, publishes `dist`, adds the SPA fallback rewrite, and supplies baseline browser-security headers.

## 1. Import the repository

1. Push the repository to GitHub with `vercel.json`, `package.json`, and `package-lock.json` committed.
2. In Vercel, select **Add New → Project** and import the GitHub repository.
3. Keep the repository root as the **Root Directory**. Vercel should identify the framework as **Vite**.
4. The committed configuration supplies these settings:

   ```text
   Install Command: npm ci
   Build Command: npm run build
   Output Directory: dist
   Node.js: 24.x
   ```

## 2. Add the public Supabase browser configuration

GitHub sign-in is optional. To enable it, add these variables under **Project Settings → Environment Variables**:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Use the values from the Supabase project settings. Apply them to **Production** and, only if OAuth should work on preview deployments, **Preview**. These values are included in the Vite browser bundle by design; never put the GitHub OAuth client secret in Vercel or any `VITE_` variable.

Deployments built before an environment-variable change do not receive the new value, so redeploy after adding or changing either variable.

## 3. Deploy and finish the OAuth redirect

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

## 4. Verify the production deployment

1. Open the production URL in a private browser window and run the bundled evidence dossier.
2. Analyze a public commit anonymously.
3. Select **Connect GitHub**, complete OAuth, and confirm Proofline shows the authenticated allowance.
4. Analyze a public pull request or commit while connected.
5. Open a non-root path directly and confirm the SPA loads rather than returning a Vercel 404.

No Vercel Function, database, or server-side secret is required for this deployment.
