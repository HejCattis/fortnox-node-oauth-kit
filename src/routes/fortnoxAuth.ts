import { Router, Request, Response } from 'express';
import { FortnoxClient } from '../FortnoxClient';

// Add Express session declaration to support session-based storage
declare module 'express-session' {
  interface SessionData {
    fortnoxState?: string;
    fortnoxCodeVerifier?: string;
  }
}

export interface FortnoxAuthRouterOptions {
  fortnoxClient: FortnoxClient;
  getUserId: (req: Request) => string;
  afterActivate?: (req: Request, res: Response, payload: { state: string; codeVerifier: string }) => void;
  afterCallback?: (req: Request, res: Response, tokens: any) => void;
  activatePath?: string;
  callbackPath?: string;
  successRedirect?: string;
  failureRedirect?: string;
}

/**
 * Creates an Express router for handling Fortnox OAuth authentication
 */
export const createFortnoxAuthRouter = (options: FortnoxAuthRouterOptions): Router => {
  const {
    fortnoxClient,
    getUserId,
    afterActivate,
    afterCallback,
    activatePath = '/activate',
    callbackPath = '/callback',
    successRedirect = '/',
    failureRedirect = '/error',
  } = options;

  const router = Router();

  // Route for initiating OAuth flow
  router.get(activatePath, (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { authUrl, state, codeVerifier } = fortnoxClient.generateAuthUrl(userId);

      // Allow custom handling after activation
      if (afterActivate) {
        afterActivate(req, res, { state, codeVerifier });
      } else {
        // Store PKCE state in session if available
        if (req.session) {
          req.session.fortnoxState = state;
          req.session.fortnoxCodeVerifier = codeVerifier;
        }
      }

      // Redirect to Fortnox authorization page
      res.redirect(authUrl);
    } catch (error) {
      console.error('Failed to generate Fortnox auth URL:', error);
      res.redirect(failureRedirect);
    }
  });

  // Route for handling OAuth callback
  router.get(callbackPath, async (req: Request, res: Response) => {
    try {
      const { code, state, error } = req.query;

      if (error) {
        console.error('Fortnox auth error:', error);
        return res.redirect(failureRedirect);
      }

      if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
        console.error('Missing required parameters');
        return res.redirect(failureRedirect);
      }

      // Method 1: Use state validation from FortnoxClient
      const stateData = fortnoxClient.validateState(state);

      if (stateData) {
        const { userId, codeVerifier } = stateData;
        const tokens = await fortnoxClient.exchangeCodeForTokens(userId, code, codeVerifier);

        // Allow custom handling after successful callback
        if (afterCallback) {
          afterCallback(req, res, tokens);
        } else {
          res.redirect(successRedirect);
        }
        return;
      }

      // Method 2: Fall back to session-based verification if available
      if (req.session && req.session.fortnoxState === state) {
        const userId = getUserId(req);
        const codeVerifier = req.session.fortnoxCodeVerifier;

        if (!codeVerifier) {
          console.error('Missing code verifier in session');
          return res.redirect(failureRedirect);
        }

        const tokens = await fortnoxClient.exchangeCodeForTokens(userId, code, codeVerifier);

        // Clean up session
        delete req.session.fortnoxState;
        delete req.session.fortnoxCodeVerifier;

        // Allow custom handling after successful callback
        if (afterCallback) {
          afterCallback(req, res, tokens);
        } else {
          res.redirect(successRedirect);
        }
        return;
      }

      // Invalid state
      console.error('Invalid state parameter');
      res.redirect(failureRedirect);
    } catch (error) {
      console.error('Failed to handle Fortnox callback:', error);
      res.redirect(failureRedirect);
    }
  });

  return router;
}; 