import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { env } from "../config/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;

function getEncryptionKey(): Buffer {
  const key = Buffer.from(env.DEPOSIT_ADDRESS_ENCRYPTION_KEY, "hex");

  if (key.length !== 32) {
    throw new Error(
      "DEPOSIT_ADDRESS_ENCRYPTION_KEY must be a 32-byte (64 hex character) key for AES-256-GCM."
    );
  }

  return key;
}

/**
 * Encrypts a secret (e.g. a derived deposit address private key) for storage
 * at rest. Returns a single string combining the IV, auth tag, and
 * ciphertext (all base64) so it can be stored in one text column.
 */
export function encryptSecret(plainText: string): string {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);

  const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(":");
}

/** Decrypts a value produced by {@link encryptSecret}. */
export function decryptSecret(encoded: string): string {
  const [ivB64, authTagB64, ciphertextB64] = encoded.split(":");

  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Malformed encrypted secret.");
  }

  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}
