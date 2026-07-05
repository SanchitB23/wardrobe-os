import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/domain/**/*.test.ts"],
  },
  resolve: {
    alias: [
      { find: "@/domain", replacement: path.resolve(__dirname, "src/domain") },
      { find: "@/features", replacement: path.resolve(__dirname, "src/features") },
      { find: "@/shared", replacement: path.resolve(__dirname, "src/shared") },
      { find: "@/lib/supabase", replacement: path.resolve(__dirname, "src/lib/supabase") },
      { find: "@", replacement: path.resolve(__dirname, ".") },
    ],
  },
});
