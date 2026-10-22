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
