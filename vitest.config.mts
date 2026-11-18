import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Tes database memakai satu database bersama (mis. pengaturan mode Midtrans), jadi file dijalankan berurutan
  test: { include: ["tests/**/*.test.ts"], environment: "node", fileParallelism: process.env.TEST_DATABASE !== "1" },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/empty.ts"),
    },
  },
});
