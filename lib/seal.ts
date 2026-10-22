import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * The reveal payload is sealed with AES-256-GCM before it leaves the server.
 *
 * Pass-and-play means the browser necessarily holds every player's card, so
 * this is not a defence against a determined cheater — it is a defence against
 * a *forged* reveal. Distances, roles, and neighbours come back authoritative.
 */

const KEY_BYTES = 32;
const IV_BYTES = 12;

function key(): Buffer {
  const hex = process.env.ROUND_SECRET;
  if (!hex || hex.length !== KEY_BYTES * 2) {
    throw new Error(
      "ROUND_SECRET must be 64 hex characters. Generate one with: openssl rand -hex 32",
    );
  }
  return Buffer.from(hex, "hex");
}

export function seal(value: unknown): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((b) => b.toString("base64url")).join(".");
}

export function open<T>(token: string): T {
  const [ivPart, tagPart, dataPart] = token.split(".");
  if (!ivPart || !tagPart || !dataPart) throw new Error("Malformed round token");

  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString("utf8")) as T;
}
