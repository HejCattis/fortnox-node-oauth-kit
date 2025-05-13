/**
 * Secure Token Store
 * 
 * A token store wrapper that adds encryption for sensitive token data.
 * This wraps any other token store implementation (InMemoryStore, PostgresStore, etc.)
 * and handles encryption/decryption of tokens transparently.
 */

import { FortnoxTokens, TokenStore } from '../types';
import { TokenEncryption, TokenEncryptionOptions } from './TokenEncryption';

/**
 * Options for the SecureTokenStore
 */
export interface SecureTokenStoreOptions extends TokenEncryptionOptions {
  /**
   * The underlying token store implementation to use
   */
  baseStore: TokenStore;
}

/**
 * A token store that adds encryption to any other token store
 */
export class SecureTokenStore implements TokenStore {
  private baseStore: TokenStore;
  private encryption: TokenEncryption;

  /**
   * Create a new SecureTokenStore
   * @param options Configuration options
   */
  constructor(options: SecureTokenStoreOptions) {
    this.baseStore = options.baseStore;
    this.encryption = new TokenEncryption({
      encryptionKey: options.encryptionKey,
      enforceEncryption: options.enforceEncryption,
    });
  }

  /**
   * Save tokens with encryption
   * @param userId The user ID
   * @param tokens The tokens to encrypt and save
   */
  public async saveTokens(userId: string, tokens: FortnoxTokens): Promise<void> {
    const encryptedTokens = this.encryptTokens(tokens);
    await this.baseStore.saveTokens(userId, encryptedTokens);
  }

  /**
   * Get and decrypt tokens
   * @param userId The user ID
   * @returns Decrypted tokens or null if not found
   */
  public async getTokens(userId: string): Promise<FortnoxTokens | null> {
    const encryptedTokens = await this.baseStore.getTokens(userId);
    
    if (!encryptedTokens) {
      return null;
    }
    
    return this.decryptTokens(encryptedTokens);
  }

  /**
   * Update tokens with encryption
   * @param userId The user ID
   * @param tokens The tokens to encrypt and update
   */
  public async updateTokens(userId: string, tokens: FortnoxTokens): Promise<void> {
    const encryptedTokens = this.encryptTokens(tokens);
    await this.baseStore.updateTokens(userId, encryptedTokens);
  }

  /**
   * Delete tokens
   * @param userId The user ID
   */
  public async deleteTokens(userId: string): Promise<void> {
    await this.baseStore.deleteTokens(userId);
  }

  /**
   * Encrypt sensitive fields in token object
   * @param tokens The tokens to encrypt
   * @returns A copy with encrypted sensitive fields
   */
  private encryptTokens(tokens: FortnoxTokens): FortnoxTokens {
    return {
      ...tokens,
      access_token: this.encryption.encrypt(tokens.access_token),
      refresh_token: this.encryption.encrypt(tokens.refresh_token),
    };
  }

  /**
   * Decrypt sensitive fields in token object
   * @param tokens The tokens to decrypt
   * @returns A copy with decrypted sensitive fields
   */
  private decryptTokens(tokens: FortnoxTokens): FortnoxTokens {
    return {
      ...tokens,
      access_token: this.encryption.decrypt(tokens.access_token),
      refresh_token: this.encryption.decrypt(tokens.refresh_token),
    };
  }
} 