/**
 * Password hashing and verification using Web Crypto API (PBKDF2 + SHA-256).
 * Compatible with the Cloudflare Workers runtime.
 */
import {
  PBKDF2_ITERATIONS,
  PBKDF2_KEY_LENGTH,
  PBKDF2_SALT_LENGTH,
} from "./constants";

function toBase64(bytes: Uint8Array<ArrayBuffer>): string {
  return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));
}

/** `new Uint8Array(ArrayLike)` always allocates its own `ArrayBuffer`, giving `Uint8Array<ArrayBuffer>`. */
function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(Array.from(atob(b64), (c) => c.charCodeAt(0)));
}

async function deriveKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>
): Promise<ArrayBuffer> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  return crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    PBKDF2_KEY_LENGTH * 8
  );
}

/** Returns a `salt:hash` string suitable for storage in `auth_account.credential_hash`. */
export async function hashPassword(password: string): Promise<string> {
  // `new Uint8Array(byteLength)` → `Uint8Array<ArrayBuffer>` (own buffer)
  const salt = new Uint8Array(PBKDF2_SALT_LENGTH);
  crypto.getRandomValues(salt);
  const hash = await deriveKey(password, salt);
  return `${toBase64(salt)}:${toBase64(new Uint8Array(hash))}`;
}

/** Constant-time comparison of the candidate password against the stored hash. */
export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  const [saltB64, hashB64] = parts as [string, string];
  const salt = fromBase64(saltB64); // Uint8Array<ArrayBuffer>
  const hash = await deriveKey(password, salt);
  const candidate = toBase64(new Uint8Array(hash));
  // Constant-time string comparison
  if (candidate.length !== hashB64.length) return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i++) {
    diff |= candidate.charCodeAt(i) ^ hashB64.charCodeAt(i);
  }
  return diff === 0;
}
