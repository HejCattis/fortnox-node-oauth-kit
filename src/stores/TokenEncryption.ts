/**
 * Token Encryption Utilities
 * 
 * This module provides methods to encrypt and decrypt sensitive token data
 * before storing it in any persistent storage. This helps protect tokens
 * at rest in case of database breaches.
 */

import crypto from 'crypto';

// Algorithm constants
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For AES, this is always 16 bytes
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

/**
 * Options for token encryption
 */
export interface TokenEncryptionOptions {
  /**
   * The encryption key to use. Must be 32 bytes (256 bits) for AES-256-GCM.
   * If not provided, tokens will not be encrypted (not recommended for production).
   */
  encryptionKey?: Buffer | string;
  
  /**
   * Whether to enforce encryption. If true and no encryptionKey is provided,
   * an error will be thrown.
   * @default false
   */
  enforceEncryption?: boolean;
}

/**
 * Handles encryption and decryption of sensitive token data
 */
export class TokenEncryption {
  private encryptionKey?: Buffer;
  private enforceEncryption: boolean;

  /**
   * Create a new TokenEncryption instance
   * @param options Encryption options
   */
  constructor(options: TokenEncryptionOptions = {}) {
    if (options.encryptionKey) {
      this.encryptionKey = typeof options.encryptionKey === 'string'
        ? Buffer.from(options.encryptionKey, 'hex')
        : options.encryptionKey;
      
      if (this.encryptionKey.length !== KEY_LENGTH) {
        throw new Error(`Encryption key must be ${KEY_LENGTH} bytes (${KEY_LENGTH * 8} bits)`);
      }
    }
    
    this.enforceEncryption = options.enforceEncryption || false;
    
    if (this.enforceEncryption && !this.encryptionKey) {
      throw new Error('Encryption key is required when enforceEncryption is true');
    }
  }

  /**
   * Encrypt a string
   * @param text Text to encrypt
   * @returns Encrypted data as a hex string, or the original if no encryption key is set
   */
  public encrypt(text: string): string {
    if (!this.encryptionKey) {
      if (this.enforceEncryption) {
        throw new Error('Cannot encrypt: No encryption key is set');
      }
      return text; // No encryption
    }

    // Generate a random initialization vector
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, this.encryptionKey, iv);
    
    // Encrypt the data
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get the authentication tag
    const authTag = cipher.getAuthTag();
    
    // Format: iv:authTag:encryptedData
    return Buffer.concat([
      iv,
      authTag,
      Buffer.from(encrypted, 'hex')
    ]).toString('hex');
  }

  /**
   * Decrypt an encrypted string
   * @param encryptedText Text to decrypt
   * @returns Decrypted string, or the original if no encryption key is set
   */
  public decrypt(encryptedText: string): string {
    if (!this.encryptionKey) {
      if (this.enforceEncryption) {
        throw new Error('Cannot decrypt: No encryption key is set');
      }
      return encryptedText; // No encryption
    }
    
    try {
      // Convert from hex
      const encryptedBuffer = Buffer.from(encryptedText, 'hex');
      
      // Extract parts
      const iv = encryptedBuffer.subarray(0, IV_LENGTH);
      const authTag = encryptedBuffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
      const encryptedData = encryptedBuffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH).toString('hex');
      
      // Create decipher
      const decipher = crypto.createDecipheriv(ALGORITHM, this.encryptionKey, iv);
      decipher.setAuthTag(authTag);
      
      // Decrypt
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${(error as Error).message}`);
    }
  }

  /**
   * Generate a random encryption key suitable for AES-256-GCM
   * @returns A Buffer containing a random 32-byte key
   */
  public static generateKey(): Buffer {
    return crypto.randomBytes(KEY_LENGTH);
  }
  
  /**
   * Convert a key buffer to a hex string for storage
   * @param key The key buffer
   * @returns Hex string representation of the key
   */
  public static keyToString(key: Buffer): string {
    return key.toString('hex');
  }
} 