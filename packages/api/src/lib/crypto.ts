import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import type { EncryptedCredentials } from "@doji/types";

/**
 * Encrypts a plaintext string using AES-256-GCM.
 *
 * @param plaintext - The string to encrypt
 * @param key - A 32-byte Buffer derived from `CREDENTIAL_ENCRYPTION_KEY`
 * @returns An {@link EncryptedCredentials} object with hex-encoded `ciphertext`, `iv`, and `tag`
 */
export function encrypt(plaintext: string, key: Buffer): EncryptedCredentials {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString("hex"),
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
  };
}

/**
 * Decrypts an AES-256-GCM encrypted data envelope back to a plaintext string.
 *
 * @param data - The {@link EncryptedCredentials} object with hex-encoded fields
 * @param key - The same 32-byte Buffer used for encryption
 * @returns The original plaintext string
 */
export function decrypt(data: EncryptedCredentials, key: Buffer): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(data.iv, "hex")
  );

  decipher.setAuthTag(Buffer.from(data.tag, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(data.ciphertext, "hex")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
