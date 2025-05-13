import { TokenStore, FortnoxTokens } from '../types';

/**
 * In-memory implementation of TokenStore
 * Warning: This store is not persistent across server restarts
 */
export class InMemoryStore implements TokenStore {
  private store: Map<string, FortnoxTokens>;

  constructor() {
    this.store = new Map<string, FortnoxTokens>();
  }

  async saveTokens(userId: string, tokens: FortnoxTokens): Promise<void> {
    this.store.set(userId, tokens);
  }

  async getTokens(userId: string): Promise<FortnoxTokens | null> {
    const tokens = this.store.get(userId);
    return tokens || null;
  }

  async updateTokens(userId: string, tokens: FortnoxTokens): Promise<void> {
    this.store.set(userId, tokens);
  }

  async deleteTokens(userId: string): Promise<void> {
    this.store.delete(userId);
  }
} 