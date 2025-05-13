/**
 * Fortnox OAuth Reference Server
 * 
 * This server demonstrates how to use the fortnox-node-oauth-kit components
 * for a complete OAuth flow with both InMemoryStore and PostgresStore options.
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { FortnoxClient } from './FortnoxClient';
import { InMemoryStore } from './stores/InMemoryStore';
import { createFortnoxAuthRouter } from './routes/fortnoxAuth';
import { Pool } from 'pg';
import { PostgresStore } from './stores/PostgresStore';

// Load environment variables
dotenv.config();

// Constants and configuration
const PORT = process.env.PORT || 4005;
const REQUIRED_ENV_VARS = ['FORTNOX_CLIENT_ID', 'FORTNOX_CLIENT_SECRET', 'FORTNOX_SCOPES'];
const USER_ID = 'test-user'; // Fixed user ID for this example

// Verify required environment variables
REQUIRED_ENV_VARS.forEach(varName => {
  if (!process.env[varName]) {
    console.error(`Error: Missing environment variable ${varName}`);
    process.exit(1);
  }
});

// Set up Express app
const app = express();
app.use(express.json());
app.use(cors());

// Set the redirect URI to match Fortnox Developer Portal setting
const redirectUri = `http://localhost:${PORT}/auth-redir`;

// Create token store - Choose between InMemoryStore or PostgresStore
let tokenStore;
if (process.env.USE_POSTGRES === 'true') {
  // Create Postgres connection pool
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  
  // Create and initialize PostgresStore
  tokenStore = new PostgresStore({ pool });
  (async () => {
    try {
      await tokenStore.initialize();
      console.log('PostgresStore initialized successfully');
    } catch (error) {
      console.error('Failed to initialize PostgresStore:', error);
      process.exit(1);
    }
  })();
} else {
  // Use InMemoryStore for development/testing
  tokenStore = new InMemoryStore();
  console.log('Using InMemoryStore (tokens will be lost on server restart)');
}

// Create the Fortnox client
const fortnoxClient = new FortnoxClient({
  clientId: process.env.FORTNOX_CLIENT_ID!,
  clientSecret: process.env.FORTNOX_CLIENT_SECRET!,
  redirectUri,
  scopes: process.env.FORTNOX_SCOPES!.split(' '),
  tokenStore,
});

// Create and use FortnoxAuth router for OAuth flow
const fortnoxAuthRouter = createFortnoxAuthRouter({
  fortnoxClient,
  getUserId: (_req: Request) => USER_ID, // Fixed user ID for this example
  activatePath: '/activate',
  callbackPath: '/auth-redir',
  successRedirect: '/auth-success',
  failureRedirect: '/auth-failure',
  afterCallback: (_req, res, _tokens) => {
    console.log('Authentication successful, tokens received');
    res.status(200).json({ 
      message: 'Authentication successful',
      // Don't include tokens in response for security
    });
  }
});

app.use(fortnoxAuthRouter);

// Success and failure pages
app.get('/auth-success', (_req: Request, res: Response) => {
  res.send('<h1>Authentication Successful</h1><p>You can now use the API endpoints.</p>');
});

app.get('/auth-failure', (_req: Request, res: Response) => {
  res.status(400).send('<h1>Authentication Failed</h1><p>Please try again.</p>');
});

// API Handlers
// Token refresh endpoint
app.get('/refresh-token', async (_req: Request, res: Response) => {
  try {
    const tokens = await fortnoxClient.refreshTokens(USER_ID);
    console.log('Token refreshed successfully');
    res.status(200).json({ 
      message: 'Token refreshed successfully',
      expiresIn: tokens.expires_in,
      tokenType: tokens.token_type
    });
  } catch (error: any) {
    console.error('Token refresh error:', error.message);
    res.status(500).json({ 
      error: 'Failed to refresh token',
      details: error.message,
      response: error.response?.data
    });
  }
});

// Check token status
app.get('/token-status', async (_req: Request, res: Response) => {
  try {
    const storedTokens = await tokenStore.getTokens(USER_ID);
    if (storedTokens) {
      const expiryDate = new Date(storedTokens.expiry_date || 0);
      const isExpired = storedTokens.expiry_date ? storedTokens.expiry_date <= Date.now() : true;
      
      res.json({
        hasTokens: true,
        isExpired,
        expiryDate: expiryDate.toISOString(),
        tokenType: storedTokens.token_type,
        scope: storedTokens.scope
      });
    } else {
      res.json({ hasTokens: false });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to check token status' });
  }
});

// Company information API
app.get('/api/company-info', async (_req: Request, res: Response) => {
  try {
    const client = await fortnoxClient.getClient(USER_ID);
    
    console.log('Making API call to Fortnox...');
    
    const response = await client.get('/companyinformation', {
      headers: { 'Accept': 'application/json' }
    });
    
    console.log('API call successful');
    res.json(response.data);
  } catch (error: any) {
    handleApiError(error, res, 'Failed to get company information');
  }
});

// Customers API
app.get('/api/customers', async (_req: Request, res: Response) => {
  try {
    const client = await fortnoxClient.getClient(USER_ID);
    
    console.log('Making API call to Fortnox customers endpoint...');
    
    const response = await client.get('/customers', {
      headers: { 'Accept': 'application/json' }
    });
    
    console.log('API call successful');
    res.json(response.data);
  } catch (error: any) {
    handleApiError(error, res, 'Failed to get customers');
  }
});

// Helper function to handle API errors
function handleApiError(error: any, res: Response, message: string) {
  console.error(`${message}:`, error.message);
  console.error('API error details:', error.response?.data);
  
  res.status(500).json({ 
    error: message,
    details: error.message,
    response: error.response?.data
  });
}

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('-------------------------');
  console.log(`IMPORTANT: Your Fortnox Developer Portal MUST be configured with this EXACT redirect URI:`);
  console.log(`${redirectUri}`);
  console.log('-------------------------');
  console.log(`Token store: ${process.env.USE_POSTGRES === 'true' ? 'PostgresStore' : 'InMemoryStore'}`);
  if (process.env.USE_POSTGRES !== 'true') {
    console.log('Warning: Using InMemoryStore - all tokens will be lost on server restart');
  }
  console.log('-------------------------');
  console.log('Available endpoints:');
  console.log(`- http://localhost:${PORT}/activate - Start the OAuth flow`);
  console.log(`- ${redirectUri} - Callback URL for Fortnox authentication`);
  console.log(`- http://localhost:${PORT}/api/company-info - Get company information`);
  console.log(`- http://localhost:${PORT}/api/customers - Get customers list`);
  console.log(`- http://localhost:${PORT}/refresh-token - Manually refresh the token`);
  console.log(`- http://localhost:${PORT}/token-status - Check current token status`);
});

