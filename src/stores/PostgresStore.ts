import { Pool } from 'pg';
import { TokenStore, FortnoxTokens } from '../types';

export interface PostgresStoreConfig {
  pool: Pool;
  tableName?: string;
}

/**
 * Postgres implementation of TokenStore
 */
export class PostgresStore implements TokenStore {
  private pool: Pool;
  private tableName: string;

  constructor({ pool, tableName = 'fortnox_credentials' }: PostgresStoreConfig) {
    this.pool = pool;
    this.tableName = tableName;
  }

  /**
   * Initializes the database table
   */
  async initialize(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        user_id VARCHAR(255) PRIMARY KEY,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expires_in INTEGER NOT NULL,
        scope TEXT NOT NULL,
        token_type TEXT NOT NULL,
        expiry_date BIGINT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await this.pool.query(query);
  }

  async saveTokens(userId: string, tokens: FortnoxTokens): Promise<void> {
    const query = `
      INSERT INTO ${this.tableName} (
        user_id, access_token, refresh_token, expires_in, scope, token_type, expiry_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        expires_in = EXCLUDED.expires_in,
        scope = EXCLUDED.scope,
        token_type = EXCLUDED.token_type,
        expiry_date = EXCLUDED.expiry_date,
        updated_at = CURRENT_TIMESTAMP
    `;

    const values = [
      userId,
      tokens.access_token,
      tokens.refresh_token,
      tokens.expires_in,
      tokens.scope,
      tokens.token_type,
      tokens.expiry_date,
    ];

    await this.pool.query(query, values);
  }

  async getTokens(userId: string): Promise<FortnoxTokens | null> {
    const query = `
      SELECT access_token, refresh_token, expires_in, scope, token_type, expiry_date
      FROM ${this.tableName}
      WHERE user_id = $1
    `;

    const result = await this.pool.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return {
      access_token: result.rows[0].access_token,
      refresh_token: result.rows[0].refresh_token,
      expires_in: result.rows[0].expires_in,
      scope: result.rows[0].scope,
      token_type: result.rows[0].token_type,
      expiry_date: result.rows[0].expiry_date,
    };
  }

  async updateTokens(userId: string, tokens: FortnoxTokens): Promise<void> {
    const query = `
      UPDATE ${this.tableName}
      SET 
        access_token = $2,
        refresh_token = $3,
        expires_in = $4,
        scope = $5,
        token_type = $6,
        expiry_date = $7,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
    `;

    const values = [
      userId,
      tokens.access_token,
      tokens.refresh_token,
      tokens.expires_in,
      tokens.scope,
      tokens.token_type,
      tokens.expiry_date,
    ];

    await this.pool.query(query, values);
  }

  async deleteTokens(userId: string): Promise<void> {
    const query = `DELETE FROM ${this.tableName} WHERE user_id = $1`;
    await this.pool.query(query, [userId]);
  }
} 