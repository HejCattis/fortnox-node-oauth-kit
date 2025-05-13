/**
 * API Client Factory
 * 
 * Responsible for creating authenticated API clients for Fortnox:
 * - Creating Axios instances with proper authorization headers
 * - Setting up interceptors for token refresh
 * - Handling API errors
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { FortnoxTokens } from '../types';
import { TokenManager } from './TokenManager';

export interface ApiClientOptions {
  baseUrl?: string;
  defaultHeaders?: Record<string, string>;
  timeout?: number;
}

export class ApiClientFactory {
  private tokenManager: TokenManager;
  private baseUrl: string;
  private defaultOptions: ApiClientOptions;

  constructor(
    tokenManager: TokenManager,
    options: ApiClientOptions = {}
  ) {
    this.tokenManager = tokenManager;
    this.baseUrl = options.baseUrl || 'https://api.fortnox.se/3';
    this.defaultOptions = {
      defaultHeaders: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.defaultHeaders
      },
      timeout: options.timeout || 30000
    };
  }

  /**
   * Creates an authenticated API client for a specific user
   * @param userId User ID to create client for
   * @returns Axios instance configured for API requests
   */
  public async createClient(userId: string): Promise<AxiosInstance> {
    // Get valid tokens for the user (refreshes if needed)
    const tokens = await this.tokenManager.getValidTokens(userId);
    
    // Create a new client with authentication
    const client = this.createAxiosInstance(tokens, userId);
    
    // Add interceptors for automatic token refresh
    this.setupTokenRefreshInterceptor(client, userId);
    
    return client;
  }

  /**
   * Creates an Axios instance with the current access token
   */
  private createAxiosInstance(tokens: FortnoxTokens, userId: string): AxiosInstance {
    return axios.create({
      baseURL: this.baseUrl,
      headers: {
        ...this.defaultOptions.defaultHeaders,
        'Authorization': `Bearer ${tokens.access_token}`,
        'X-User-ID': userId, // Used by interceptors
      },
      timeout: this.defaultOptions.timeout
    });
  }

  /**
   * Sets up an interceptor to refresh the token if it expires
   */
  private setupTokenRefreshInterceptor(client: AxiosInstance, userId: string): void {
    client.interceptors.response.use(
      // Success handler
      (response) => response,
      
      // Error handler
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };
        
        // Only handle 401 errors (Unauthorized) that haven't been retried yet
        if (
          error.response?.status === 401 && 
          !originalRequest._retry &&
          originalRequest
        ) {
          originalRequest._retry = true;
          
          try {
            // Refresh the token
            const newTokens = await this.tokenManager.refreshTokens(userId);
            
            // Update the Authorization header
            if (originalRequest.headers) {
              originalRequest.headers['Authorization'] = `Bearer ${newTokens.access_token}`;
            } else {
              originalRequest.headers = {
                'Authorization': `Bearer ${newTokens.access_token}`
              };
            }
            
            // Retry the original request
            return axios(originalRequest);
          } catch (refreshError) {
            // If we can't refresh the token, propagate the error
            return Promise.reject(refreshError);
          }
        }
        
        // For other errors, just propagate
        return Promise.reject(this.normalizeError(error));
      }
    );
  }

  /**
   * Normalizes API errors for consistency
   */
  private normalizeError(error: AxiosError): Error {
    if (error.response?.data) {
      // Extract Fortnox API error if available
      const apiError = error.response.data as any;
      
      if (apiError.error_description) {
        return new Error(`API Error (${apiError.error}): ${apiError.error_description}`);
      }
      
      if (apiError.ErrorInformation?.message) {
        return new Error(`API Error: ${apiError.ErrorInformation.message}`);
      }
    }
    
    // Default error handling
    return error;
  }
} 