import { createClient } from "@supabase/supabase-js";
import { ChromeStorageAdapter } from "./chromeStorageAdapter";

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase configuration. Please check your environment variables.");
}

// Create custom storage adapter
const storageAdapter = new ChromeStorageAdapter();

// Create Supabase client with custom storage adapter
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: storageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Disable default behavior for browser extensions
  },
});

export { supabase };
