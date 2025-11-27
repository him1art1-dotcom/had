import { createClient } from '@supabase/supabase-js';

// NOTE: In a real environment, these would be process.env.VITE_SUPABASE_URL
// For this demo to "run" without crashing, we check if they exist.
// If not, the DB service will throw connection errors, which we handle in the UI.

const env = (import.meta as any).env;

export const supabaseConfigured = Boolean(env?.VITE_SUPABASE_URL && env?.VITE_SUPABASE_ANON_KEY);

const supabaseUrl = env?.VITE_SUPABASE_URL || 'https://xyz.supabase.co';
const supabaseKey = env?.VITE_SUPABASE_ANON_KEY || 'public-anon-key';

if (!supabaseConfigured) {
  console.warn('Supabase environment variables are missing. Falling back to placeholder values.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function checkSupabaseConnection(): Promise<boolean> {
  if (!supabaseConfigured) return false;

  try {
    const { error } = await supabase.from('users').select('*', { count: 'exact', head: true });
    return !error;
  } catch (e) {
    console.warn('Supabase connectivity check failed', e);
    return false;
  }
}
