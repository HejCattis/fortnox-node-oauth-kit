/**
 * PKCE (Proof Key for Code Exchange) Utilities
 * 
 * These functions implement the PKCE extension to OAuth 2.0 for public clients,
 * providing protection against authorization code interception attacks.
 * 
 * @see https://oauth.net/2/pkce/
 * @see https://datatracker.ietf.org/doc/html/rfc7636
 */

import crypto from 'crypto';
import { generateSecureState } from './stateStorage';

/**
 * Generates a cryptographically secure random string for use as a code verifier
 * 
 * @param length - Length of the code verifier (min 43, max 128 per RFC7636)
 * @returns A random string for use as a PKCE code verifier
 */
export const createCodeVerifier = (length = 64): string => {
  if (length < 43 || length > 128) {
    throw new Error('Code verifier length must be between 43 and 128 characters');
  }
  return crypto.randomBytes(length).toString('base64url').slice(0, length);
};

/**
 * Creates a code challenge from a code verifier using the S256 method
 * 
 * @param codeVerifier - The code verifier to generate a challenge from
 * @returns Base64URL-encoded SHA-256 hash of the code verifier (S256 method)
 */
export const createCodeChallenge = (codeVerifier: string): string => {
  if (!codeVerifier || codeVerifier.length < 43 || codeVerifier.length > 128) {
    throw new Error('Invalid code verifier');
  }
  
  const hash = crypto.createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  
  return hash;
};

/**
 * Creates a secure random state parameter for OAuth redirects
 * This state is critical for CSRF protection in the OAuth flow
 * 
 * @returns A cryptographically secure random state string
 */
export const createState = (): string => {
  return generateSecureState();
};

/**
 * Verifies that a code challenge matches a code verifier
 * This is typically done on the server side of the OAuth provider
 * 
 * @param codeVerifier - The original code verifier
 * @param codeChallenge - The code challenge to verify
 * @returns true if the challenge matches the verifier, false otherwise
 */
export const verifyCodeChallenge = (codeVerifier: string, codeChallenge: string): boolean => {
  if (!codeVerifier || !codeChallenge) {
    return false;
  }
  
  const calculatedChallenge = createCodeChallenge(codeVerifier);
  
  // Use a timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(calculatedChallenge),
    Buffer.from(codeChallenge)
  );
}; 