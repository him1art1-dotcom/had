import { createClient } from '@supabase/supabase-js';

// NOTE: In a real environment, these would be process.env.VITE_SUPABASE_URL
// For this demo to "run" without crashing, we check if they exist. 
// If not, the DB service will throw connection errors, which we handle in the UI.

const env = (import.meta as any).env;

const supabaseUrl = env?.VITE_SUPABASE_URL || 'https://uqllfiwosxnjkzewsehs.supabase.co';
const supabaseKey = env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxbGxmaXdvc3huamt6ZXdzZWhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxOTA2MTcsImV4cCI6MjA3OTc2NjYxN30.sY0W87pxV1MXkx4WypzEmPgHbddwX0Vks6VevxA0sWQ';

export const supabase = createClient(supabaseUrl, supabaseKey);