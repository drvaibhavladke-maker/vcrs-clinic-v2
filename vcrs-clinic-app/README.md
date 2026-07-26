# VCRS Clinic Suite

A patient management app for a single clinic, covering Patients, Appointments,
Consultations, Prescriptions, Laboratory, Clinical Photos, Samples, Billing,
Payments, Research Projects, Experiments, Publications, Users, Settings, and
an Audit Log — all backed by a real Supabase (Postgres) database.

## Deploying with no coding required

### 1. Database (already done)
You've already run `vcrs-supabase-schema.sql` in your Supabase project's SQL Editor.

### 2. Get your Supabase keys
In your Supabase project → **Settings → API**, copy:
- **Project URL**
- **anon / public** key (NOT the `service_role` key — that one must stay secret)

### 3. Put this code on GitHub
1. Go to github.com → sign up free (if you don't have an account)
2. Click **New repository**, name it e.g. `vcrs-clinic-suite`, keep it Private, click Create
3. On the new repo's page, click **uploading an existing file**
4. Drag every file and folder from this project into the upload box
5. Click **Commit changes**

### 4. Deploy on Vercel
1. Go to vercel.com → sign up free using your GitHub account
2. Click **Add New → Project**
3. Select the `vcrs-clinic-suite` repository you just uploaded
4. Before clicking Deploy, open **Environment Variables** and add:
   - `VITE_SUPABASE_URL` → your Project URL
   - `VITE_SUPABASE_ANON_KEY` → your anon public key
5. Click **Deploy**

In about a minute you'll get a live URL like `vcrs-clinic-suite.vercel.app` —
that's your software, live on the internet, usable from any device/browser.

## Local development (optional, only if you want to run it on your own computer)
```
npm install
cp .env.example .env   # then fill in your real Supabase URL/key
npm run dev
```

## Security note
This version has no login screen yet — anyone with the URL can use it.
For a clinic handling real patient data, the next essential step is enabling
Supabase Auth + Row Level Security (RLS) so only your staff can sign in.
Ask for the RLS + login follow-up whenever you're ready for that.
