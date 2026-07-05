import { fetchStylesSample } from "@/shared/repositories/health.repository";

export type SupabaseHealthStatus = {
  connected: boolean;
  rlsBlocking: boolean;
  errorMessage: string | null;
  styles: { name: string }[] | null;
};

export async function getSupabaseHealthStatus(): Promise<SupabaseHealthStatus> {
  const result = await fetchStylesSample();

  if (result.error) {
    return {
      connected: false,
      rlsBlocking: false,
      errorMessage: result.error.message,
      styles: null,
    };
  }

  const styles = result.data ?? [];

  return {
    connected: true,
    rlsBlocking: styles.length === 0,
    errorMessage: null,
    styles,
  };
}
