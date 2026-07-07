/**
 * Future vision providers (RFC-002) — OpenAI, Claude, Local. Placeholders that
 * throw NotImplemented until wired, so the provider-agnostic surface is real
 * today. SDK-free.
 */

import { StubVisionProvider, type VisionCapabilities, type VisionProviderId } from "@/domain/vision";

export class OpenAIVisionProvider extends StubVisionProvider {
  readonly id: VisionProviderId = "openai";
  readonly capabilities: VisionCapabilities = { multiItem: true, segmentation: false, brandHints: true };
}

export class ClaudeVisionProvider extends StubVisionProvider {
  readonly id: VisionProviderId = "claude";
  readonly capabilities: VisionCapabilities = { multiItem: true, segmentation: false, brandHints: true };
}

export class LocalVisionProvider extends StubVisionProvider {
  readonly id: VisionProviderId = "local";
  readonly capabilities: VisionCapabilities = { multiItem: true, segmentation: true, brandHints: false };
}
