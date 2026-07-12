import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "app/**/*.test.ts"],
  },
  resolve: {
    alias: [
      { find: "@/ai", replacement: path.resolve(__dirname, "src/ai") },
      { find: "@/domain", replacement: path.resolve(__dirname, "src/domain") },
      { find: "@/runtime", replacement: path.resolve(__dirname, "src/runtime") },
      { find: "@/features", replacement: path.resolve(__dirname, "src/features") },
      { find: "@/shared", replacement: path.resolve(__dirname, "src/shared") },
      { find: "@/lib/supabase", replacement: path.resolve(__dirname, "src/lib/supabase") },
      { find: "@/lib/access", replacement: path.resolve(__dirname, "src/lib/access") },
      { find: "@", replacement: path.resolve(__dirname, ".") },
    ],
  },
});
