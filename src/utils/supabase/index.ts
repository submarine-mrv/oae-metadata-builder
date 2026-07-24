import { createClient } from "@supabase/supabase-js";
import type { SampleItemsDatabase } from "@/types/sampleItems";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables.");
}

export const supabase = createClient<SampleItemsDatabase>(supabaseUrl, supabaseKey);
