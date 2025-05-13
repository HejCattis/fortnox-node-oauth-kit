import { StateStorage } from './utils/stateStorage';
import { ApiClientOptions } from './services';

export interface FortnoxTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  expiry_date?: number; // Calculate and store when we get the token
}

export interface TokenStore {
  saveTokens(userId: string, tokens: FortnoxTokens): Promise<void>;
  getTokens(userId: string): Promise<FortnoxTokens | null>;
  updateTokens(userId: string, tokens: FortnoxTokens): Promise<void>;
  deleteTokens(userId: string): Promise<void>;
}

export interface FortnoxClientConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: string[];
  tokenStore?: TokenStore;
  stateStorage?: StateStorage; // Added for secure state management
  apiOptions?: ApiClientOptions; // Options for API client configuration
}

export interface FortnoxAuthOptions {
  state?: string;
  codeVerifier?: string;
}

export interface FortnoxAuthPayload {
  authUrl: string;
  state: string;
  codeVerifier: string;
} 