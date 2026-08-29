import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://artha-bench-pro.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
]);

function cors(origin: string | null) {
  const allowed = origin && allowedOrigins.has(origin) ? origin : "https://artha-bench-pro.vercel.app";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(status: number, body: Record<string, unknown>, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function validEmail(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, origin);
  if (origin && !allowedOrigins.has(origin)) return json(403, { error: "Origin not allowed" }, origin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json(500, { error: "Authentication service is not configured" }, origin);

  let body: any;
  try {
    const raw = await req.text();
    if (raw.length > 4096) return json(413, { error: "Request too large" }, origin);
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: "Invalid request" }, origin);
  }

  const mode = body?.mode === "recover" ? "recover" : "signup";
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  const fullName = String(body?.fullName || "").trim();
  const country = String(body?.country || "India").trim();
  const financialDataConsent = body?.financialDataConsent === true;

  if (!validEmail(email)) return json(400, { error: "Enter a valid email address" }, origin);
  if (password.length < 8 || password.length > 128) return json(400, { error: "Password must be 8–128 characters" }, origin);
  if (mode === "signup" && (!fullName || fullName.length > 100)) return json(400, { error: "Enter your full name" }, origin);
  if (mode === "signup" && (!country || country.length > 80)) return json(400, { error: "Enter a valid country or region" }, origin);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const publicClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const firstAttempt = await publicClient.auth.signInWithPassword({ email, password });
  if (!firstAttempt.error && firstAttempt.data.session) return json(200, { session: firstAttempt.data.session, existing: true }, origin);

  if (/email not confirmed/i.test(firstAttempt.error?.message || "")) {
    const { data: listed, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (!listError) {
      const user = listed.users.find((candidate) => candidate.email?.toLowerCase() === email);
      if (user && !user.email_confirmed_at) {
        const { error: confirmError } = await admin.auth.admin.updateUserById(user.id, { email_confirm: true });
        if (!confirmError) {
          const recovered = await publicClient.auth.signInWithPassword({ email, password });
          if (!recovered.error && recovered.data.session) return json(200, { session: recovered.data.session, recovered: true }, origin);
        }
      }
    }
    return json(401, { error: "This account could not be recovered. Use Forgot password or contact support." }, origin);
  }

  if (mode === "recover") return json(401, { error: "Invalid email or password" }, origin);

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      country,
      personal_data_insights_enabled: financialDataConsent,
    },
  });
  if (createError) return json(409, { error: "An account with this email already exists. Sign in with its password or use Forgot password." }, origin);
  if (!created.user) return json(500, { error: "Account could not be created" }, origin);

  const signedIn = await publicClient.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session) return json(500, { error: "Account created, but automatic sign-in failed. Please sign in once." }, origin);
  return json(201, { session: signedIn.data.session, created: true }, origin);
});
