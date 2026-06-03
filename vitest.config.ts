import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/backend/__tests__/**/*.test.ts"],
    env: {
      VERCEL: "1",
      DATABASE_URL: "postgres://postgres:postgres@localhost:5432/stally",
      EMAIL_ROLE_AUTH_ENABLED: "false"
    },
    setupFiles: [],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
});
