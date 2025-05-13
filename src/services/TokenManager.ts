/**
 * Token Manager
 * 
 * Responsible for managing OAuth tokens:
 * - Refreshing tokens when they expire
 * - Retrieving tokens for API requests
 * - Revoking tokens when needed
 * - Managing token storage
 */

import axios from 'axios';
import qs from 'qs';
import { FortnoxTokens, TokenStore } from '../types';

export class TokenManager {
  private clientId: string;
  private clientSecret: string;
  private tokenStore: TokenStore;
  private authBaseUrl: string;
  private refreshing: boolean = false;
  private refreshQueue: Map<string, Array<(tokens: FortnoxTokens) => void>> = new Map();

  constructor(
    clientId: string,
    clientSecret: string,
    tokenStore: TokenStore,
    authBaseUrl: string = 'https://apps.fortnox.se/oauth-v1'
  ) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.tokenStore = tokenStore;
    this.authBaseUrl = authBaseUrl;
  }

  /**
   * Get tokens for a user
   * @param userId The user ID to get tokens for
   * @returns The user's tokens or null if not found
   */
  public async getTokens(userId: string): Promise<FortnoxTokens | null> {
    return this.tokenStore.getTokens(userId);
  }

  /**
   * Check if tokens are expired or about to expire
   * @param tokens The tokens to check
   * @param bufferMs Buffer time in milliseconds before expiry to consider tokens as expired
   * @returns True if tokens are expired or about to expire
   */
  public isTokenExpired(tokens: FortnoxTokens, bufferMs: number = 5 * 60 * 1000): boolean {
    if (!tokens.expiry_date) {
      return true;
    }
    
    return tokens.expiry_date - Date.now() < bufferMs;
  }

  /**
   * Refreshes the access token for a user
   * @param userId The ID of the user to refresh tokens for
   * @returns The refreshed tokens
   */
  public async refreshTokens(userId: string): Promise<FortnoxTokens> {
    // If already refreshing for this user, queue the request
    if (this.isRefreshing(userId)) {
      return new Promise((resolve) => {
        this.addToRefreshQueue(userId, (tokens) => {
          resolve(tokens);
        });
      });
    }
    
    try {
      this.setRefreshing(userId, true);
      
      const tokens = await this.tokenStore.getTokens(userId);
      
      if (!tokens) {
        throw new Error('No tokens found for user');
      }

      const tokenUrl = `${this.authBaseUrl}/token`;
      const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      
      const data = {
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
      };

      const response = await axios.post(tokenUrl, qs.stringify(data), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
        },
      });

      const newTokens: FortnoxTokens = {
        ...response.data,
        expiry_date: Date.now() + response.data.expires_in * 1000,
      };

      // Update the tokens
      await this.tokenStore.updateTokens(userId, newTokens);

      // Process any queued requests
      this.processRefreshQueue(userId, newTokens);
      
      return newTokens;
    } catch (error) {
      // Process the queue with error
      this.processRefreshQueue(userId, null);
      
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(`Failed to refresh token: ${error.response.data.error_description || error.message}`);
      }
      throw error;
    } finally {
      this.setRefreshing(userId, false);
    }
  }

  /**
   * Revokes the tokens for a user
   * @param userId The ID of the user to revoke tokens for
   */
  public async revokeTokens(userId: string): Promise<void> {
    await this.tokenStore.deleteTokens(userId);
  }

  /**
   * Gets current valid tokens or refreshes them if expired
   * @param userId User ID to get tokens for
   * @returns Valid tokens
   */
  public async getValidTokens(userId: string): Promise<FortnoxTokens> {
    const tokens = await this.tokenStore.getTokens(userId);
    
    if (!tokens) {
      throw new Error('No tokens found for user');
    }
    
    // Check if token is expired or about to expire
    if (this.isTokenExpired(tokens)) {
      return this.refreshTokens(userId);
    }
    
    return tokens;
  }

  /**
   * Rotates the encryption key for tokens
   * @param userId User ID to rotate tokens for
   * @param rotationCallback Function that handles encryption key rotation
   */
  public async rotateTokenEncryption(
    userId: string, 
    rotationCallback: (tokens: FortnoxTokens) => Promise<void>
  ): Promise<void> {
    const tokens = await this.tokenStore.getTokens(userId);
    
    if (!tokens) {
      return;
    }
    
    // Let the callback handle the token rotation with new encryption
    await rotationCallback(tokens);
  }

  /**
   * Check if tokens are currently being refreshed for a user
   */
  private isRefreshing(userId: string): boolean {
    return this.refreshQueue.has(userId);
  }

  /**
   * Set the refreshing state for a user
   */
  private setRefreshing(userId: string, refreshing: boolean): void {
    if (refreshing) {
      this.refreshQueue.set(userId, []);
    } else {
      this.refreshQueue.delete(userId);
    }
  }

  /**
   * Add a callback to the refresh queue for a user
   */
  private addToRefreshQueue(userId: string, callback: (tokens: FortnoxTokens) => void): void {
    const queue = this.refreshQueue.get(userId) || [];
    queue.push(callback);
    this.refreshQueue.set(userId, queue);
  }

  /**
   * Process all callbacks in the refresh queue for a user
   */
  private processRefreshQueue(userId: string, tokens: FortnoxTokens | null): void {
    const queue = this.refreshQueue.get(userId) || [];
    
    // Process all callbacks with the new tokens
    queue.forEach((callback) => {
      if (tokens) {
        callback(tokens);
      } else {
        // If tokens is null, it means the refresh failed
        // The promise will be rejected elsewhere
      }
    });
    
    // Clear the queue
    this.refreshQueue.set(userId, []);
  }
} 