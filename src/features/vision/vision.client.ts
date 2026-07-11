/**
 * Re-export the shared Vision Engine client (RFC-002). Vision Intelligence
 * must not invent a second perception path.
 */

export {
  analyzeImageRequest,
  fileToBase64,
} from "@/features/playground/vision-client";
