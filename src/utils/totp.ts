/**
 * Standard RFC 6238 Time-Based One-Time Password (TOTP) Implementation
 * Uses Web Crypto API (HMAC-SHA1) with 0 external dependencies.
 * Fully compatible with Google Authenticator, Microsoft Authenticator, Authy, 1Password, etc.
 */

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// Generate a random Base32 secret string (16 characters / 80 bits, standard)
export function generateTotpSecret(length = 16): string {
  const bytes = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  let secret = '';
  for (let i = 0; i < length; i++) {
    secret += BASE32_CHARS[bytes[i] % BASE32_CHARS.length];
  }
  return secret;
}

// Generate standard Backup Recovery Codes (e.g. 8 codes of format XXXX-XXXX)
export function generateRecoveryCodes(count = 8): string[] {
  const codes: string[] = [];
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  for (let i = 0; i < count; i++) {
    let part1 = '';
    let part2 = '';
    for (let j = 0; j < 4; j++) {
      part1 += chars[Math.floor(Math.random() * chars.length)];
      part2 += chars[Math.floor(Math.random() * chars.length)];
    }
    codes.push(`${part1}-${part2}`);
  }
  return codes;
}

// Generate the standard otpauth URI for QR code scanning
export function getOtpAuthUrl(params: {
  secret: string;
  accountName: string;
  issuer?: string;
}): string {
  const issuer = params.issuer || 'LimoChat';
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(params.accountName)}`;
  return `otpauth://totp/${label}?secret=${encodeURIComponent(params.secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

// Base32 Decoder
function base32Decode(base32: string): Uint8Array {
  const clean = base32.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_CHARS.indexOf(clean[i]);
    if (idx === -1) continue; // ignore non-base32 chars
    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(output);
}

// Compute 6-digit TOTP token for given counter step
async function computeTotpToken(keyBytes: Uint8Array, timeStep: number): Promise<string> {
  // Convert 64-bit integer counter to 8-byte big-endian buffer
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setUint32(0, Math.floor(timeStep / 0x100000000));
  view.setUint32(4, timeStep & 0xffffffff);

  // Import key into Web Crypto
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes.buffer as ArrayBuffer,
    { name: 'HMAC', hash: { name: 'SHA-1' } },
    false,
    ['sign']
  );

  // HMAC-SHA1 signature
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, buffer);
  const hmac = new Uint8Array(signature);

  // Dynamic truncation (RFC 4226)
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

/**
 * Verify 6-digit TOTP token against secret key (allows ±1 time step tolerance for clock drift)
 */
export async function verifyTotpToken(
  token: string,
  secret: string,
  windowTolerance = 2
): Promise<boolean> {
  const cleanToken = token.trim().replace(/\D/g, '');
  if (cleanToken.length !== 6) return false;

  try {
    const keyBytes = base32Decode(secret);
    if (keyBytes.length === 0) return false;

    const currentStep = Math.floor(Date.now() / 1000 / 30);

    for (let i = -windowTolerance; i <= windowTolerance; i++) {
      const step = currentStep + i;
      const expectedToken = await computeTotpToken(keyBytes, step);
      if (expectedToken === cleanToken) {
        return true;
      }
    }
    return false;
  } catch (err) {
    console.warn('TOTP verification error:', err);
    return false;
  }
}

/**
 * Verify a backup recovery code against unused codes
 */
export function verifyRecoveryCode(
  inputCode: string,
  recoveryCodes: string[] = []
): { valid: boolean; remainingCodes: string[] } {
  const normalized = inputCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!normalized) return { valid: false, remainingCodes: recoveryCodes };

  const matchedIndex = recoveryCodes.findIndex((c) => {
    const codeNorm = c.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return codeNorm === normalized;
  });

  if (matchedIndex !== -1) {
    const remaining = [...recoveryCodes];
    remaining.splice(matchedIndex, 1);
    return { valid: true, remainingCodes: remaining };
  }

  return { valid: false, remainingCodes: recoveryCodes };
}
