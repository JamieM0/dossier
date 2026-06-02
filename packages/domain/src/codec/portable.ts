/** Portable, passphrase-encrypted library codec — isomorphic (WebCrypto,
 * available in Node 18+ via `globalThis.crypto` and in every modern browser).
 *
 * This is the ONLY bridge between the desktop app's library and the web
 * build's library: a self-describing `.dossier` file. The same codec also
 * encrypts the web build's at-rest library (it has no OS keychain), so the
 * web store file IS a `.dossier` envelope keyed by the user's passphrase.
 *
 * PBKDF2(SHA-256) derives a 256-bit key from the passphrase + a random salt;
 * AES-256-GCM encrypts the JSON-serialized library. Salt, IV, and KDF
 * parameters travel in the envelope so import needs only the passphrase. */
import { withDefaults, type PersistedState } from "../store/model.js";

export const PORTABLE_FORMAT = "dossier-library";
export const PORTABLE_VERSION = 1;
/** OWASP-aligned PBKDF2-SHA256 work factor (2023 guidance). */
const PBKDF2_ITERATIONS = 210_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export type PortableEnvelope = {
  format: typeof PORTABLE_FORMAT;
  version: number;
  kdf: { name: "PBKDF2"; hash: "SHA-256"; iterations: number; salt: string };
  cipher: { name: "AES-GCM"; iv: string };
  ciphertext: string;
};

/** Thrown when a `.dossier` file is malformed or the passphrase is wrong.
 * AES-GCM authentication failure surfaces as a wrong-passphrase error. */
export class PortableImportError extends Error {}

function getSubtle(): SubtleCrypto {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c?.subtle) {
    throw new Error("WebCrypto (crypto.subtle) is unavailable in this runtime");
  }
  return c.subtle;
}

function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(n));
  (globalThis as { crypto: Crypto }).crypto.getRandomValues(out);
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number
): Promise<CryptoKey> {
  const subtle = getSubtle();
  const baseKey = await subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** Encrypt an arbitrary JSON-serializable value into a portable envelope.
 * Used for the `.dossier` export (a library) and for the web build's at-rest
 * vault (library + its TMDB token). */
export async function encryptWithPassphrase<T>(value: T, passphrase: string): Promise<PortableEnvelope> {
  if (!passphrase) throw new Error("A passphrase is required");
  const subtle = getSubtle();
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = new Uint8Array(
    await subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext)
  );
  return {
    format: PORTABLE_FORMAT,
    version: PORTABLE_VERSION,
    kdf: { name: "PBKDF2", hash: "SHA-256", iterations: PBKDF2_ITERATIONS, salt: toBase64(salt) },
    cipher: { name: "AES-GCM", iv: toBase64(iv) },
    ciphertext: toBase64(ciphertext)
  };
}

/** Decrypt a portable envelope. Throws PortableImportError on a wrong
 * passphrase or malformed/foreign input. */
export async function decryptWithPassphrase<T>(
  input: string | PortableEnvelope,
  passphrase: string
): Promise<T> {
  if (!passphrase) throw new PortableImportError("A passphrase is required");

  let envelope: PortableEnvelope;
  try {
    envelope = typeof input === "string" ? (JSON.parse(input) as PortableEnvelope) : input;
  } catch {
    throw new PortableImportError("This file is not a valid Dossier library export.");
  }

  if (
    !envelope ||
    envelope.format !== PORTABLE_FORMAT ||
    typeof envelope.ciphertext !== "string" ||
    !envelope.kdf?.salt ||
    !envelope.cipher?.iv
  ) {
    throw new PortableImportError("This file is not a valid Dossier library export.");
  }
  if (envelope.version > PORTABLE_VERSION) {
    throw new PortableImportError(
      "This library was exported by a newer version of Dossier. Please update and try again."
    );
  }

  const subtle = getSubtle();
  const key = await deriveKey(
    passphrase,
    fromBase64(envelope.kdf.salt),
    envelope.kdf.iterations || PBKDF2_ITERATIONS
  );
  let plaintext: ArrayBuffer;
  try {
    plaintext = await subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(envelope.cipher.iv) },
      key,
      fromBase64(envelope.ciphertext)
    );
  } catch {
    throw new PortableImportError("Incorrect passphrase, or the file is corrupted.");
  }

  try {
    return JSON.parse(new TextDecoder().decode(plaintext)) as T;
  } catch {
    throw new PortableImportError("The decrypted data could not be read.");
  }
}

/** Encrypt a library into a portable envelope (the `.dossier` export). */
export function exportLibrary(state: PersistedState, passphrase: string): Promise<PortableEnvelope> {
  return encryptWithPassphrase(state, passphrase);
}

/** Serialize an envelope to the bytes written to a `.dossier` file. */
export function serializeEnvelope(envelope: PortableEnvelope): string {
  return JSON.stringify(envelope, null, 2);
}

/** Decrypt a portable envelope back into a library, filling in any missing
 * top-level fields. Throws PortableImportError on a wrong passphrase or
 * malformed input. */
export async function importLibrary(
  input: string | PortableEnvelope,
  passphrase: string
): Promise<PersistedState> {
  return withDefaults(await decryptWithPassphrase<PersistedState>(input, passphrase));
}
