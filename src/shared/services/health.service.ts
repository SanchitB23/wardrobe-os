import { fetchStylesSample } from "@/shared/repositories/health.repository";
import {
  interpretStylesHealthCheck,
  type WardrobeHealthStatus,
} from "@/domain/wardrobe/wardrobe-health";

export type SupabaseHealthStatus = WardrobeHealthStatus;

export async function getSupabaseHealthStatus(): Promise<SupabaseHealthStatus> {
  const result = await fetchStylesSample();
  return interpretStylesHealthCheck(result.data, result.error);
}
