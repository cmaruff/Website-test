// ============================================================
// Token encryption helpers — AES-GCM at the application layer
//
// Required to comply with Intuit's QBO security policy:
//   "Encrypt the refresh token with a symmetric algorithm (AES).
//    Store your AES key in your app, in a separate configuration file."
//
// We use Web Crypto's AES-GCM with a 256-bit key loaded from the
// TOKEN_ENCRYPTION_KEY env var (separate from the database). This
// is a SECOND layer on top of Supabase's at-rest disk encryption.
//
// Generate the key once:  openssl rand -base64 32
// Set it as a Supabase Edge Function secret called TOKEN_ENCRYPTION_KEY.
// ============================================================

let cachedKey: CryptoKey | null = null;

async function getKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const raw = Deno.env.get("TOKEN_ENCRYPTION_KEY");
  if (!raw) throw new Error("TOKEN_ENCRYPTION_KEY not set");
  const keyBytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  if (keyBytes.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be 32 random bytes, base64-encoded");
  }
  cachedKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
  return cachedKey;
}

export async function encryptToken(plaintext: string): Promise<string> {
  if (!plaintext) return plaintext;
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded,
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  // Prefix with 'enc:' so we can tell encrypted values apart from
  // legacy plaintext during a rotation/migration.
  return "enc:" + btoa(String.fromCharCode(...combined));
}

export async function decryptToken(stored: string): Promise<string> {
  if (!stored) return stored;
  // Backwards compatibility: anything without the 'enc:' prefix is
  // a plaintext token from before encryption was added. Just return
  // it as-is so existing connections don't break on rollout.
  if (!stored.startsWith("enc:")) return stored;
  const key = await getKey();
  const combined = Uint8Array.from(atob(stored.slice(4)), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(decrypted);
}
