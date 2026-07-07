/**
 * Placeholder tools for capabilities that are planned but not built yet
 * (Weather, Calendar). They are advertised to the model so it can reach for
 * them, but they return a graceful "not available" result rather than
 * inventing data — keeping the tool-calling contract honest.
 */

import { objectParams } from "@/ai/tools/json-schema";
import type { AITool } from "@/ai/tools/types";

function futureTool(name: string, description: string): AITool {
  return {
    name,
    description: `${description} (NOT AVAILABLE YET — returns a not-implemented notice; do not fabricate results).`,
    parameters: objectParams({}),
    async execute() {
      return {
        available: false,
        note: `${name} is not available yet. Answer from the other tools instead.`,
      };
    },
  };
}

export const weatherTool = futureTool(
  "getWeather",
  "Get current/forecast weather for outfit planning.",
);

export const calendarTool = futureTool(
  "getCalendar",
  "Get upcoming calendar events to plan outfits around.",
);

export const FUTURE_TOOLS: AITool[] = [weatherTool, calendarTool];
