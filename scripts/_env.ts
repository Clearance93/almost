import { existsSync } from "node:fs";

/**
 * Scripts run outside Next.js, so nothing has loaded .env.local for us.
 * Node 20.12+ ships process.loadEnvFile; keep it simple and explicit.
 */
export function loadLocalEnv(): void {
  for (const file of [".env.local", ".env"]) {
    if (existsSync(file)) {
      process.loadEnvFile(file);
      return;
    }
  }
  console.warn(
    "No .env.local found. Copy .env.example to .env.local and fill in your Appwrite project details.",
  );
}
