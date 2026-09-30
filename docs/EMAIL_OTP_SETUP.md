# Email codes (OTP), auto sign-out and full screen

## What the app does

| Feature | Behaviour | Setting |
| --- | --- | --- |
| Full screen | The first tap, click or key press enters full screen; if the user leaves it (Esc), the next interaction enters it again. A hint is shown while not in full screen. Installed app (Add to Home Screen) opens full screen via `public/manifest.webmanifest`. iPhone Safari does not allow web pages to go full screen, so there it only works as an installed app. | always on |
| Idle sign-out | Signs out after this many minutes without activity in any tab, with a warning first | `VITE_IDLE_LOGOUT_MINUTES` (default 15) |
| Maximum session | Signs out this many hours after sign-in, even if active | `VITE_MAX_SESSION_HOURS` (default 12) |
| One device | Signing in on a new device ends the other sessions | always on |
| Email codes | After the password, a 6-digit code is emailed and must be entered. New accounts must enter a code before use | `VITE_EMAIL_OTP=on` |

## Switching email codes on (in this order)

Browsers cannot be forced into full screen and emails cannot be sent without a sender, so two things must be set up
outside the code.

1. **Email sender (required).** Supabase's built-in email service only sends a few emails an hour and only to
   your own team's addresses, so real users would never get their code. In Supabase → Authentication →
   Emails → SMTP Settings, turn on a custom SMTP sender (for example Resend, Brevo, Amazon SES or Postmark; most
   have a free tier). Use an address on a domain you own.
2. **Email templates.** In Authentication → Emails → Templates, make sure these include the code `{{ .Token }}`:
   - *Magic Link* (used for sign-in codes), e.g. `Your ArthaMind sign-in code is {{ .Token }}. It expires in 10 minutes.`
   - *Confirm signup*, e.g. `Your ArthaMind verification code is {{ .Token }}.`
3. **Code length and expiry.** Authentication → Providers → Email: OTP length 6, expiry 600 seconds (10 minutes).
   Keep "Confirm email" on.
4. **Close the old shortcut.** In Supabase → Edge Functions → signup-account → Secrets, set
   `REQUIRE_EMAIL_VERIFICATION=true`, then deploy the updated function from `supabase/functions/signup-account`.
5. **Turn it on in the app.** In Vercel → Settings → Environment Variables, add `VITE_EMAIL_OTP=on` and redeploy.
   Test sign-up and sign-in with a real inbox.
6. **Enforce it in the database (last).** Apply `supabase/migrations/20260929120000_require_verified_session.sql`.
   After this, a password-only session cannot read or write personal rows even if someone calls the database API
   directly. Apply it only after step 5 works, or users who sign in with a password alone will see empty accounts.

Google and other social sign-ins do not ask for a code: the provider has already verified the email.

## Turning it off

Remove `VITE_EMAIL_OTP` in Vercel and redeploy. If step 6 was applied, also drop the `require_verified_session`
policies (see the comment at the top of the migration).
