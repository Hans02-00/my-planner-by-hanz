# My Planner Blue Cloud ☁️

A multi-user personal task planner designed for VS Code, GitHub Pages and Supabase.

## Step 1: Create Supabase project
1. Open https://supabase.com/dashboard and create a new project.
2. Go to **SQL Editor → New query**, paste the entire `database.sql` and click Run.
3. In **Authentication → Providers**, enable **Email** authentication (usually enabled).
4. Under **Project Settings → API** (or **Connect → API keys**), copy the Project URL and publishable key (or legacy anon public key).
5. Open `config.js` in VS Code and replace both placeholder strings. Do **not** use the secret/service_role key.

## Step 2: Auth URL settings
1. In Supabase **Authentication → URL Configuration**, add your GitHub Pages published address as the Site URL (for example `https://username.github.io/my-planner/`).
2. Add that URL in **Redirect URLs** too. If testing locally with Live Server, add `http://127.0.0.1:5500/**` and `http://localhost:5500/**` as additional redirect URLs.
3. Email confirmation may be on by default; users must verify their email before signing in. Check the Supabase authentication email configuration for a production website.

## Step 3: Preview locally
Open the folder in VS Code, and run `index.html` with Live Server. Sign Up, verify email if requested, and sign in. Try adding, editing and deleting a task.

## Step 4: Publish with GitHub Pages
1. Create a new GitHub repository, e.g. `my-planner`.
2. Upload `index.html`, `app.js`, `config.js` and `README.md` to the root directory. `database.sql` can stay locally (or in the repository; it does not contain credentials).
3. Under **Settings → Pages**, select **Deploy from a branch**, `main` and `/(root)`; Save.
4. Open the published GitHub Pages URL and test two accounts in different browsers.

## Privacy and security
- Row Level Security (RLS) rules in `database.sql` restrict each user's task rows to their own account.
- The publishable/anon key is designed to be public when RLS is correctly configured. NEVER put a service_role/secret key in frontend files.
- Tasks and deadlines sync across devices for the same account.
- Notes and habit check-ins still use browser local storage, **per account and browser**; they do not sync across devices.
- Old browser-only tasks from your prior planner are NOT automatically migrated into Supabase. They stay in the old browser storage.
- GitHub Pages hosts static files; the database is Supabase, not GitHub.

## Troubleshooting
- If login fails, verify `config.js`, Email provider and Authentication URL Configuration.
- If sign-up says check email, click the verification link before logging in.
- If task operations fail, run `database.sql` and confirm RLS policies.
- When testing locally, use Live Server, not a `file://` URL.
