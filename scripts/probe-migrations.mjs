import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve("c:/Acostudio ai/.env");
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const url = env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

async function probe(name, input) {
  const res = await fetch(input instanceof Request ? input : new Request(input, { headers }));
  const text = await res.text();
  console.log(`${name}: ${res.status} ${text.slice(0, 400)}`);
  return { status: res.status, text };
}

console.log("project:", env.SUPABASE_PROJECT_ID);
console.log("url:", url);
console.log("vite sync:", env.VITE_SUPABASE_URL === url && env.VITE_SUPABASE_PROJECT_ID === env.SUPABASE_PROJECT_ID);
console.log("service_role set:", Boolean(key && key.length > 20));
console.log("LOVABLE_DB_MIGRATION_URL:", env.LOVABLE_DB_MIGRATION_URL ? "set" : "MISSING");

await probe("clips", `${url}/rest/v1/clips?select=id&limit=1`);
await probe("usage_counters", `${url}/rest/v1/usage_counters?select=kind,count&limit=3`);
await probe("generation_events", `${url}/rest/v1/generation_events?select=id&limit=1`);
await probe("share_expires_at", `${url}/rest/v1/clips?select=id,share_expires_at&limit=1`);
await probe(
  "reserve_usage",
  new Request(`${url}/rest/v1/rpc/reserve_usage`, {
    method: "POST",
    headers,
    body: JSON.stringify({ _subject_id: "__migration_probe__", _kind: "share", _cap: 9999 }),
  }),
);
await probe(
  "release_usage",
  new Request(`${url}/rest/v1/rpc/release_usage`, {
    method: "POST",
    headers,
    body: JSON.stringify({ _subject_id: "__migration_probe__", _kind: "share" }),
  }),
);
