import { supabase } from "@/utils/supabase";
import type { SampleItem, SampleItemUpdate } from "@/types/sampleItems";

const SAMPLE_ITEMS_TABLE = "sample_items";

export async function fetchSampleItems(): Promise<SampleItem[]> {
  const { data, error } = await supabase
    .from(SAMPLE_ITEMS_TABLE)
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch sample_items: ${error.message}`);
  }

  return data ?? [];
}

export async function updateSampleItemById(
  id: number,
  patch: SampleItemUpdate
): Promise<SampleItem> {
  const { data, error } = await supabase
    .from(SAMPLE_ITEMS_TABLE)
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `Failed to update sample_items row ${id}: ${error.message}`
    );
  }

  return data;
}
