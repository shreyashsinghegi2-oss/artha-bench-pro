/**
 * Early-access waitlist shown on the landing page.
 *
 * Source: the owner's Google Form waitlist (sign-ups from LinkedIn), counted outside this app.
 * Update WAITLIST_COUNT from the form's response count; it is a floor ("5,000+"), so round down.
 * This is not the number of app accounts: those live in Supabase Auth.
 */
export const WAITLIST_COUNT = 5000;
export const WAITLIST_AS_OF = 'October 2026';
