/**
 * Crypto utilities that can be mocked in tests
 */

export function generateRandomBytes(length: number): Uint8Array {
  const array = new Uint8Array(length);
  return crypto.getRandomValues(array);
} 