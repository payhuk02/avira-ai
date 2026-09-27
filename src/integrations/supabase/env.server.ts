/** Resolve Supabase env on the server (Vercel often only has VITE_* set). */
export function getSupabasePublicEnv() {
  const url =
    process.env["SUPABASE_URL"] ||
    process.env["VITE_SUPABASE_URL"] ||
    "";
  const publishableKey =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ||
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
    "";
  const projectId =
    process.env["SUPABASE_PROJECT_ID"] ||
    process.env["VITE_SUPABASE_PROJECT_ID"] ||
    "";
  return { url, publishableKey, projectId };
}

export function getSupabaseServiceEnv() {
  const { url } = getSupabasePublicEnv();
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] || "";
  return { url, serviceRoleKey };
}
