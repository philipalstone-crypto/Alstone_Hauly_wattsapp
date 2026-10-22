# Alstone_Hauly Wattsapp — starter project

## What is included
- Installable PWA interface
- Supabase phone OTP sign-in flow
- Messages table with row-level security SQL
- Basic realtime refresh
- App icon and service worker

## Important current limitations
This is a starter scaffold, not a finished production messaging service. Review the SQL and test with accounts you control before inviting users. Phone-number discovery can expose personal information; tighten discovery and add a contacts/consent model before public launch. Add rate limits, abuse reporting/blocking, privacy policy, backups, monitoring, and security review before production.
This app does NOT send messages to regular WhatsApp accounts yet. That requires a separate server-side Meta WhatsApp Business Platform integration, approved setup, a business phone number, and secure secret storage. Never put Meta tokens or Supabase service_role keys in frontend files.

## Step A — Create Supabase project
1. Open https://supabase.com/ in your browser and create a project.
2. In Authentication settings, enable Phone sign-in and configure a supported SMS provider. Keep SMS provider credentials private.
3. Open SQL Editor and run `supabase_setup.sql`.
4. In Project Settings > API, copy the Project URL and the publishable/anon key. Never use the `service_role` secret in this app.

## Step B — Test locally
Serve these files from an HTTPS host or local development server. Opening `index.html` directly from file storage may prevent service workers from working.
When prompted in the app, enter the Supabase URL and publishable/anon key. Request an OTP and verify your own number.
The SQL trigger creates the profile after Supabase creates a phone-auth user.

## Step C — Deploy with Netlify from Android
1. Upload the extracted project files to a GitHub repository (keep the repository free of secret tokens).
2. In Netlify, choose Add new site > Import an existing project and select the repository.
3. Build command: leave blank. Publish directory: `.` (the folder containing index.html).
4. Deploy. Open the HTTPS site in Chrome on Android.
5. In Chrome menu, choose **Install app** or **Add to Home screen** (wording varies).

## Step D — Important test checklist
- Verify OTP with a phone number you control.
- Register a second test account you control.
- Send messages between those two registered Alstone_Hauly accounts.
- Confirm users cannot read messages in conversations they are not part of.
- Test on a second browser/device before sharing.

## Step E — Real WhatsApp integration later
Use the official Meta WhatsApp Business Platform Developer Hub: https://whatsappbusiness.com/developers/developer-hub/
Implement sends and webhook handling in a server-side service. Keep access tokens and webhook verification secrets in server environment variables. Do not try to access private WhatsApp APIs or claim this app can message arbitrary personal WhatsApp users.
