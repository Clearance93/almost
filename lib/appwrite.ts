import { Client, Embeddings, TablesDB } from "node-appwrite";

export const EMBEDDING_DIMENSION = 768;
export const EMBEDDING_MODEL_LABEL = "nomic-embed-text";

export const TABLES = {
  words: "words",
  rounds: "rounds",
  scores: "scores",
} as const;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env.local and fill it in before running this.`,
    );
  }
  return value;
}

let cached: Client | null = null;

export function getClient(): Client {
  if (!cached) {
    cached = new Client()
      .setEndpoint(requireEnv("APPWRITE_ENDPOINT"))
      .setProject(requireEnv("APPWRITE_PROJECT_ID"))
      .setKey(requireEnv("APPWRITE_API_KEY"));
  }
  return cached;
}

export function getTablesDb(): TablesDB {
  return new TablesDB(getClient());
}

export function getEmbeddings(): Embeddings {
  return new Embeddings(getClient());
}

export const ids = {
  database: process.env.APPWRITE_DATABASE_ID ?? "almost",
};

export function isConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 409
  );
}

export function describeError(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const { message, code } = error as { message?: string; code?: number };
    return `${code ?? ""} ${message ?? "unknown error"}`.trim();
  }
  return String(error);
}

/** Network wobbles, rate limits, and Appwrite 5xx are worth retrying. */
export function isTransient(error: unknown): boolean {
  const candidate = error as { code?: number; message?: string };
  if (typeof candidate?.code === "number") {
    if (candidate.code >= 500 || candidate.code === 429) return true;
  }
  const message = (candidate?.message ?? "").toLowerCase();
  return [
    "fetch failed",
    "econnreset",
    "etimedout",
    "socket hang up",
    "network",
    "enotfound",
    "timeout",
  ].some((needle) => message.includes(needle));
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  attempts = 3,
  baseDelayMs = 350,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransient(error) || attempt === attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** attempt));
    }
  }
  throw lastError;
}

export function friendlyError(error: unknown, fallback: string): string {
  if (isTransient(error)) return "The table lost its connection to Appwrite. Try again.";
  const message = error instanceof Error ? error.message : fallback;
  return message || fallback;
}
