/**
 * AES-256-GCM helpers for encrypting/decrypting secret strings.
 * Uses the application's `encryptionKey` (min 32 chars) as key material.
 */
import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LEN = 32; // bytes
const IV_LEN = 12; // bytes (96-bit GCM standard)
const TAG_LEN = 16; // bytes

function deriveKey(encryptionKey: string): Buffer {
  return crypto.scryptSync(encryptionKey, 'forgeportal-crypto-salt', KEY_LEN);
}

/**
 * Encrypts a plaintext string.
 * Returns a base64-encoded string of format: iv(12B) + tag(16B) + ciphertext.
 */
export function encrypt(plaintext: string, encryptionKey: string): string {
  const key = deriveKey(encryptionKey);
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/**
 * Decrypts a base64 string produced by `encrypt`.
 */
export function decrypt(ciphertext: string, encryptionKey: string): string {
  const key = deriveKey(encryptionKey);
  const buf = Buffer.from(ciphertext, 'base64');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const encrypted = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}
