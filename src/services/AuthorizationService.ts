/**
 * Authorization Service
 * 
 * Responsible for the OAuth 2.0 authorization flow, including:
 * - Generating authorization URLs
 * - Managing state and PKCE parameters
 * - Exchanging authorization codes for tokens
 */

import axios from 'axios';
import qs from 'qs';
import { createCodeChallenge, createCodeVerifier, createState } from '../utils/PKCE';
import { StateStorage } from '../utils/stateStorage';
import { FortnoxAuthOptions, FortnoxAuthPayload, FortnoxTokens, TokenStore } from '../types';

export class AuthorizationService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private scopes: string[];
  private stateStorage: StateStorage;
  private tokenStore: TokenStore;
  private authBaseUrl: string;

  constructor(
    clientId: string,
    clientSecret: string,
    redirectUri: string,
    scopes: string[],
    stateStorage: StateStorage,
    tokenStore: TokenStore,
    authBaseUrl: string = 'https://apps.fortnox.se/oauth-v1'
  ) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
    this.scopes = scopes;
    this.stateStorage = stateStorage;
    this.tokenStore = tokenStore;
    this.authBaseUrl = authBaseUrl;
  }

  /**
   * Generates an authorization URL for the OAuth flow
   * @param userId ID of the user to associate with the tokens
   * @param options Optional parameters for auth flow
   * @returns Authorization URL and state for PKCE flow
   */
  public generateAuthUrl(userId: string, options?: FortnoxAuthOptions): FortnoxAuthPayload {
    const state = options?.state || createState();
    const codeVerifier = options?.codeVerifier || createCodeVerifier();
    const codeChallenge = createCodeChallenge(codeVerifier);

    // Store the state and user ID mapping for verification in the callback
    const stateData = JSON.stringify({ userId, codeVerifier });
    
    // Store state data securely with a 10-minute expiration
    this.stateStorage.saveState(state, stateData);
    
    const queryParams = {
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: this.scopes.join(' '),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    };

    const authUrl = `${this.authBaseUrl}/auth?${qs.stringify(queryParams)}`;

    return {
      authUrl,
      state,
      codeVerifier,
    };
  }

  /**
   * Validates the state parameter and retrieves the associated user ID
   * @param state The state parameter from the callback
   * @returns The user ID and code verifier if the state is valid
   */
  public validateState(state: string): { userId: string; codeVerifier: string } | null {
    const stateData = this.stateStorage.validateAndRemoveState(state);
    
    if (!stateData) {
      return null;
    }
    
    try {
      const { userId, codeVerifier } = JSON.parse(stateData);
      return { userId, codeVerifier };
    } catch (error) {
      return null;
    }
  }

  /**
   * Exchanges an authorization code for access and refresh tokens
   * @param userId The ID of the user to associate with the tokens
   * @param code The authorization code from the callback
   * @param codeVerifier The code verifier used in the authorization request
   * @returns The tokens received from Fortnox
   */
  public async exchangeCodeForTokens(
    userId: string,
    code: string,
    codeVerifier: string,
  ): Promise<FortnoxTokens> {
    const tokenUrl = `${this.authBaseUrl}/token`;
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    
    const data = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
      code_verifier: codeVerifier,
    };

    try {
      const response = await axios.post(tokenUrl, qs.stringify(data), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
        },
      });

      const tokens: FortnoxTokens = {
        ...response.data,
        // Add expiry date for easier token refresh
        expiry_date: Date.now() + response.data.expires_in * 1000,
      };

      // Save the tokens
      await this.tokenStore.saveTokens(userId, tokens);

      return tokens;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(`Failed to exchange code: ${error.response.data.error_description || error.message}`);
      }
      throw error;
    }
  }
} 