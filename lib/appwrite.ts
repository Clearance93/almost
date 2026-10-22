import { Client, Embeddings, Permission, Role, VectorsDB } from "node-appwrite";

export const EMBEDDING_DIMENSION = 768;
export const EMBEDDING_MODEL_LABEL = "nomic-embed-text";

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

export function getVectorsDb(): VectorsDB {
  return new VectorsDB(getClient());
}

export function getEmbeddings(): Embeddings {
  return new Embeddings(getClient());
}

export const ids = {
  database: process.env.APPWRITE_DATABASE_ID ?? "almost",
  collection: process.env.APPWRITE_COLLECTION_ID ?? "words",
};

export const readAny = [Permission.read(Role.any())];

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
