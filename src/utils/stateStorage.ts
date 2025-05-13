/**
 * Secure State Storage
 * 
 * This module provides a secure way to store and validate PKCE states for the OAuth flow.
 * It uses a Map with automatic expiration to prevent memory leaks and timing attacks.
 */

import crypto from 'crypto';

// Default expiration is 10 minutes
const DEFAULT_EXPIRY_MS = 10 * 60 * 1000;

interface StateEntry {
  data: string;
  expires: number;
}

/**
 * Interface for state storage implementations
 */
export interface StateStorage {
  /**
   * Store state data with automatic expiration
   */
  saveState(state: string, data: string, expiryMs?: number): void;
  
  /**
   * Retrieve and remove state data if it exists and has not expired
   * @returns The stored data or null if not found or expired
   */
  validateAndRemoveState(state: string): string | null;
  
  /**
   * Clear all expired states
   */
  clearExpired(): void;
}

/**
 * In-memory state storage with automatic expiration
 * This is suitable for single-server deployments
 */
export class InMemoryStateStorage implements StateStorage {
  private states = new Map<string, StateEntry>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(cleanupIntervalMs = 60000) {
    // Set up periodic cleanup to prevent memory leaks
    this.cleanupInterval = setInterval(() => {
      this.clearExpired();
    }, cleanupIntervalMs);
    
    // Clean up interval on process exit
    process.on('exit', () => {
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }
    });
  }

  public saveState(state: string, data: string, expiryMs = DEFAULT_EXPIRY_MS): void {
    const stateEntry: StateEntry = {
      data,
      expires: Date.now() + expiryMs
    };
    this.states.set(state, stateEntry);
  }

  public validateAndRemoveState(state: string): string | null {
    const entry = this.states.get(state);
    
    // Remove the state regardless of whether it's valid to prevent replay attacks
    this.states.delete(state);
    
    // Check if state exists and hasn't expired
    if (!entry || entry.expires < Date.now()) {
      return null;
    }
    
    return entry.data;
  }

  public clearExpired(): void {
    const now = Date.now();
    for (const [state, entry] of this.states.entries()) {
      if (entry.expires < now) {
        this.states.delete(state);
      }
    }
  }
}

/**
 * Generate a cryptographically secure random state for CSRF protection
 */
export function generateSecureState(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Default singleton instance for simple use cases
export const defaultStateStorage = new InMemoryStateStorage(); 