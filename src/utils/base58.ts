import { createHash } from "crypto";

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Plain Base58 (Bitcoin alphabet) encoding — no checksum. */
export function base58Encode(buffer: Buffer): string {
  if (buffer.length === 0) {
    return "";
  }

  let digits = [0];

  for (const byte of buffer) {
    let carry = byte;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }

  let leadingZeros = 0;
  for (const byte of buffer) {
    if (byte === 0) {
      leadingZeros++;
    } else {
      break;
    }
  }

  return (
    BASE58_ALPHABET[0].repeat(leadingZeros) +
    digits
      .reverse()
      .map((digit) => BASE58_ALPHABET[digit])
      .join("")
  );
}

function sha256(data: Buffer): Buffer {
  return createHash("sha256").update(data).digest();
}

/**
 * Base58Check encoding: appends a 4-byte double-SHA256 checksum to the
 * payload before Base58-encoding it. Used by both Bitcoin- and Tron-style
 * addresses (see `src/utils/depositWallet.ts`).
 */
export function base58CheckEncode(payload: Buffer): string {
  const checksum = sha256(sha256(payload)).subarray(0, 4);
  return base58Encode(Buffer.concat([payload, checksum]));
}

/** Plain Base58 (Bitcoin alphabet) decoding — no checksum verification. */
export function base58Decode(encoded: string): Buffer {
  if (encoded.length === 0) {
    return Buffer.alloc(0);
  }

  const bytes = [0];

  for (const char of encoded) {
    const value = BASE58_ALPHABET.indexOf(char);
    if (value < 0) {
      throw new Error(`Invalid Base58 character: ${char}`);
    }

    let carry = value;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  let leadingZeros = 0;
  for (const char of encoded) {
    if (char === BASE58_ALPHABET[0]) {
      leadingZeros++;
    } else {
      break;
    }
  }

  return Buffer.from([...Array(leadingZeros).fill(0), ...bytes.reverse()]);
}

/**
 * Decodes a Base58Check string and verifies its 4-byte checksum.
 * Throws if the alphabet is invalid or the checksum does not match.
 */
export function base58CheckDecode(encoded: string): Buffer {
  const decoded = base58Decode(encoded);
  if (decoded.length < 5) {
    throw new Error("Base58Check payload too short.");
  }

  const payload = decoded.subarray(0, decoded.length - 4);
  const checksum = decoded.subarray(decoded.length - 4);
  const expected = sha256(sha256(payload)).subarray(0, 4);

  if (!checksum.equals(expected)) {
    throw new Error("Invalid Base58Check checksum.");
  }

  return payload;
}
