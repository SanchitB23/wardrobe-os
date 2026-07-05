import { createClient } from "@/lib/supabase/server";
import { toError } from "@/shared/utils/data-result";

export async function fetchStylesSample(): Promise<{
  data: { name: string }[] | null;
  error: Error | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("styles")
    .select("name")
    .order("name");

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: data ?? [], error: null };
}
