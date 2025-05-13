/**
 * Fortnox Client
 * 
 * Main entry point for the Fortnox OAuth SDK
 * Acts as a facade for the underlying services
 */

import { AxiosInstance } from 'axios';
import { InMemoryStore } from './stores/InMemoryStore';
import { defaultStateStorage } from './utils/stateStorage';
import {
  FortnoxTokens,
  FortnoxClientConfig,
  FortnoxAuthOptions,
  FortnoxAuthPayload,
} from './types';
import {
  AuthorizationService,
  TokenManager,
  ApiClientFactory,
} from './services';

const FORTNOX_AUTH_BASE_URL = 'https://apps.fortnox.se/oauth-v1';
const FORTNOX_API_BASE_URL = 'https://api.fortnox.se/3';

/**
 * FortnoxClient is the main class for interacting with the Fortnox API
 * It provides methods for OAuth flow, token management, and API access
 */
export class FortnoxClient {
  private authService: AuthorizationService;
  private tokenManager: TokenManager;
  private apiClientFactory: ApiClientFactory;

  /**
   * Create a new FortnoxClient
   * @param config Configuration options
   */
  constructor(config: FortnoxClientConfig) {
    const {
      clientId,
      clientSecret,
      redirectUri,
      scopes = [],
      tokenStore = new InMemoryStore(),
      stateStorage = defaultStateStorage,
      apiOptions = {}
    } = config;

    // Initialize services
    this.tokenManager = new TokenManager(
      clientId,
      clientSecret,
      tokenStore,
      FORTNOX_AUTH_BASE_URL
    );

    this.authService = new AuthorizationService(
      clientId,
      clientSecret,
      redirectUri,
      scopes,
      stateStorage,
      tokenStore,
      FORTNOX_AUTH_BASE_URL
    );

    this.apiClientFactory = new ApiClientFactory(
      this.tokenManager,
      {
        baseUrl: FORTNOX_API_BASE_URL,
        ...apiOptions
      }
    );
  }

  /**
   * Generates an authorization URL for the OAuth flow
   * @param userId ID of the user to associate with the tokens
   * @param options Optional parameters for auth flow
   * @returns Authorization URL and state for PKCE flow
   */
  public generateAuthUrl(userId: string, options?: FortnoxAuthOptions): FortnoxAuthPayload {
    return this.authService.generateAuthUrl(userId, options);
  }

  /**
   * Validates the state parameter and retrieves the associated user ID
   * @param state The state parameter from the callback
   * @returns The user ID and code verifier if the state is valid
   */
  public validateState(state: string): { userId: string; codeVerifier: string } | null {
    return this.authService.validateState(state);
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
    return this.authService.exchangeCodeForTokens(userId, code, codeVerifier);
  }

  /**
   * Gets tokens for a user
   * @param userId The user ID to get tokens for
   * @returns The tokens or null if not found
   */
  public async getTokens(userId: string): Promise<FortnoxTokens | null> {
    return this.tokenManager.getTokens(userId);
  }

  /**
   * Refreshes the access token using the refresh token
   * @param userId The ID of the user to refresh tokens for
   * @returns The refreshed tokens
   */
  public async refreshTokens(userId: string): Promise<FortnoxTokens> {
    return this.tokenManager.refreshTokens(userId);
  }

  /**
   * Revokes the tokens for a user
   * @param userId The ID of the user to revoke tokens for
   */
  public async revokeTokens(userId: string): Promise<void> {
    return this.tokenManager.revokeTokens(userId);
  }

  /**
   * Gets a client for making authenticated requests to the Fortnox API
   * @param userId The ID of the user to make requests for
   * @returns An Axios instance configured for API requests
   */
  public async getClient(userId: string): Promise<AxiosInstance> {
    return this.apiClientFactory.createClient(userId);
  }
} 