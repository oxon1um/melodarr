import path from "node:path";
import { defineConfig } from "vitest/config";
import dotenv from "dotenv";

// Load .env.local for local testing
dotenv.config({ path: path.resolve(__dirname, ".env.local") });

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, ".")
    }
  },
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    environment: "node"
  }
});
