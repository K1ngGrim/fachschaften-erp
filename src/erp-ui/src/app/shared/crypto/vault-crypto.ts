/**
 * Kryptografie für vertrauliche Tabellen, ausschließlich mit der WebCrypto-API im Browser.
 *
 * - Jeder Tresor hat ein RSA-OAEP-Schlüsselpaar. Der private Schlüssel wird mit einem aus der
 *   Passphrase abgeleiteten Schlüssel (PBKDF2-SHA-256) per AES-GCM verschlüsselt gespeichert.
 * - Jede vertrauliche Tabelle hat einen AES-GCM-Schlüssel, der für jeden berechtigten Tresor mit
 *   dessen öffentlichem Schlüssel verschlüsselt ("gewrappt") wird.
 * - Einträge werden mit dem Tabellenschlüssel verschlüsselt; Tabellen-Id und Schlüsselversion
 *   gehen als zusätzliche Daten ein, damit der Server Chiffretexte nicht unbemerkt zwischen
 *   Tabellen verschieben kann.
 */

/** Empfehlung von OWASP (2023) für PBKDF2-HMAC-SHA256. */
export const PBKDF2_ITERATIONS = 600_000;

const RSA_PARAMS: RsaHashedKeyGenParams = {
  name: 'RSA-OAEP',
  modulusLength: 3072,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
};
const RSA_IMPORT: RsaHashedImportParams = { name: 'RSA-OAEP', hash: 'SHA-256' };
const IV_LENGTH = 12;

/** Gespeicherte Form eines Tresors (entspricht SaveVaultRequest im Backend). */
export interface StoredVault {
  publicKey: string;
  encryptedPrivateKey: string;
  salt: string;
  iterations: number;
}

/** Passphrase oder Wiederherstellungsschlüssel passt nicht zum Tresor. */
export class WrongPassphraseError extends Error {
  constructor() {
    super('Die Passphrase ist falsch.');
  }
}

/** Ein Eintrag ließ sich nicht entschlüsseln (falscher Schlüssel oder veränderte Daten). */
export class DecryptionError extends Error {
  constructor() {
    super('Der Eintrag konnte nicht entschlüsselt werden.');
  }
}

// ── Tresor ───────────────────────────────────────────────────────────────────

/** Neues Schlüsselpaar; der private Schlüssel wird mit der Passphrase verschlüsselt. */
export async function createVault(
  passphrase: string,
  iterations = PBKDF2_ITERATIONS,
): Promise<{ stored: StoredVault; privateKey: CryptoKey }> {
  const pair = await subtle().generateKey(RSA_PARAMS, true, ['wrapKey', 'unwrapKey']);
  const pkcs8 = new Uint8Array(await subtle().exportKey('pkcs8', pair.privateKey));
  const spki = await subtle().exportKey('spki', pair.publicKey);

  try {
    const stored = await sealPrivateKey(pkcs8, base64(spki), passphrase, iterations);
    return { stored, privateKey: await importPrivateKey(pkcs8) };
  } finally {
    pkcs8.fill(0);
  }
}

/** Entschlüsselt den privaten Schlüssel; er bleibt nicht exportierbar im Speicher. */
export async function unlockVault(stored: StoredVault, passphrase: string): Promise<CryptoKey> {
  const pkcs8 = await openPrivateKey(stored, passphrase);
  try {
    return await importPrivateKey(pkcs8);
  } finally {
    pkcs8.fill(0);
  }
}

/** Gleiches Schlüsselpaar mit neuer Passphrase; Freigaben bleiben gültig. */
export async function changePassphrase(
  stored: StoredVault,
  oldPassphrase: string,
  newPassphrase: string,
  iterations = PBKDF2_ITERATIONS,
): Promise<StoredVault> {
  const pkcs8 = await openPrivateKey(stored, oldPassphrase);
  try {
    return await sealPrivateKey(pkcs8, stored.publicKey, newPassphrase, iterations);
  } finally {
    pkcs8.fill(0);
  }
}

async function sealPrivateKey(
  pkcs8: Uint8Array,
  publicKey: string,
  passphrase: string,
  iterations: number,
): Promise<StoredVault> {
  const salt = random(16);
  const key = await passphraseKey(passphrase, salt, iterations);
  return {
    publicKey,
    encryptedPrivateKey: await encryptBytes(key, pkcs8, publicKey),
    salt: base64(salt),
    iterations,
  };
}

async function openPrivateKey(stored: StoredVault, passphrase: string): Promise<Uint8Array> {
  const key = await passphraseKey(passphrase, fromBase64(stored.salt), stored.iterations);
  try {
    // Der öffentliche Schlüssel ist als zusätzliche Daten gebunden: kein Tausch der Hälften.
    return await decryptBytes(key, stored.encryptedPrivateKey, stored.publicKey);
  } catch {
    throw new WrongPassphraseError();
  }
}

function importPrivateKey(pkcs8: Uint8Array): Promise<CryptoKey> {
  return subtle().importKey('pkcs8', pkcs8 as BufferSource, RSA_IMPORT, false, ['unwrapKey']);
}

async function passphraseKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const material = await subtle().importKey(
    'raw',
    new TextEncoder().encode(passphrase.normalize('NFC')),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return subtle().deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// ── Wiederherstellungsschlüssel ──────────────────────────────────────────────

const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Zufälliger Code mit 160 Bit, in Vierergruppen: "ABCD-EFGH-…" (32 Zeichen). */
export function generateRecoveryCode(): string {
  const bytes = random(32);
  const chars = [...bytes].map((b) => RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length]);
  bytes.fill(0);
  return chars.join('').match(/.{4}/g)!.join('-');
}

/** Code unabhängig von Schreibweise, Leerzeichen und Bindestrichen. */
export function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// ── Tabellenschlüssel ────────────────────────────────────────────────────────

export function generateTableKey(): Promise<CryptoKey> {
  // Exportierbar, damit er für weitere Tresore gewrappt werden kann.
  return subtle().generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

/** Verschlüsselt den Tabellenschlüssel für einen Tresor (öffentlicher Schlüssel als SPKI/Base64). */
export async function wrapTableKey(tableKey: CryptoKey, publicKey: string): Promise<string> {
  const key = await subtle().importKey(
    'spki',
    fromBase64(publicKey) as BufferSource,
    RSA_IMPORT,
    false,
    ['wrapKey'],
  );
  return base64(await subtle().wrapKey('raw', tableKey, key, { name: 'RSA-OAEP' }));
}

export async function unwrapTableKey(wrapped: string, privateKey: CryptoKey): Promise<CryptoKey> {
  try {
    return await subtle().unwrapKey(
      'raw',
      fromBase64(wrapped) as BufferSource,
      privateKey,
      { name: 'RSA-OAEP' },
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    );
  } catch {
    throw new DecryptionError();
  }
}

// ── Einträge ─────────────────────────────────────────────────────────────────

/** Zusätzliche Daten für Einträge: Tabelle und Schlüsselversion. */
export function rowContext(tableId: string, keyVersion: number): string {
  return `custom-table:${tableId}:v${keyVersion}`;
}

export async function encryptValues(
  values: Record<string, unknown>,
  tableKey: CryptoKey,
  context: string,
): Promise<string> {
  return encryptBytes(tableKey, new TextEncoder().encode(JSON.stringify(values)), context);
}

export async function decryptValues(
  encrypted: string,
  tableKey: CryptoKey,
  context: string,
): Promise<Record<string, unknown>> {
  try {
    const bytes = await decryptBytes(tableKey, encrypted, context);
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
  } catch {
    throw new DecryptionError();
  }
}

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

/** Base64 aus IV (12 Byte) und AES-GCM-Chiffretext. */
async function encryptBytes(key: CryptoKey, data: Uint8Array, context: string): Promise<string> {
  const iv = random(IV_LENGTH);
  const ciphertext = new Uint8Array(
    await subtle().encrypt(
      {
        name: 'AES-GCM',
        iv: iv as BufferSource,
        additionalData: new TextEncoder().encode(context),
      },
      key,
      data as BufferSource,
    ),
  );
  const result = new Uint8Array(iv.length + ciphertext.length);
  result.set(iv);
  result.set(ciphertext, iv.length);
  return base64(result);
}

async function decryptBytes(
  key: CryptoKey,
  encrypted: string,
  context: string,
): Promise<Uint8Array> {
  const bytes = fromBase64(encrypted);
  const plain = await subtle().decrypt(
    {
      name: 'AES-GCM',
      iv: bytes.subarray(0, IV_LENGTH) as BufferSource,
      additionalData: new TextEncoder().encode(context),
    },
    key,
    bytes.subarray(IV_LENGTH) as BufferSource,
  );
  return new Uint8Array(plain);
}

function subtle(): SubtleCrypto {
  if (!globalThis.crypto?.subtle) {
    // WebCrypto gibt es nur in sicheren Kontexten (HTTPS oder localhost).
    throw new Error('Verschlüsselung ist nur über HTTPS verfügbar.');
  }
  return globalThis.crypto.subtle;
}

function random(length: number): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(length));
}

export function base64(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
