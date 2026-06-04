import "server-only";

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

let adminClient: SupabaseClient<Database> | null = null;
let authClient: SupabaseClient<Database> | null = null;

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function createServerClient(key: string) {
  return createClient<Database>(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export function getSupabaseAdminClient() {
  if (!adminClient) {
    adminClient = createServerClient(requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
  }

  return adminClient;
}

export function getSupabaseAuthServerClient() {
  if (!authClient) {
    authClient = createServerClient(requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"));
  }

  return authClient;
}

export function getBearerToken(headers: Headers) {
  const authorization = headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export async function getUserFromRequest(request: Request): Promise<User | null> {
  const token = getBearerToken(request.headers);
  if (!token) {
    return null;
  }

  const supabase = getSupabaseAuthServerClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return null;
  }

  return data.user;
}
