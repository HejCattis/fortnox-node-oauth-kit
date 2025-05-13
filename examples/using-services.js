/**
 * Example Using Individual Services
 * 
 * This example demonstrates how to use the individual service classes
 * directly instead of using the FortnoxClient facade. This approach
 * provides more control and flexibility for advanced use cases.
 */

// Load environment variables
require('dotenv').config();

const express = require('express');
const session = require('express-session');

// Import the services and utilities directly
const { 
  AuthorizationService, 
  TokenManager, 
  ApiClientFactory,
  InMemoryStore,
  InMemoryStateStorage
} = require('../dist');

// ===== CONFIGURATION =====
const PORT = process.env.PORT || 4006;
const USER_ID = 'example-user';

// Constants
const AUTH_BASE_URL = 'https://apps.fortnox.se/oauth-v1';
const API_BASE_URL = 'https://api.fortnox.se/3';

// Check required environment variables
['FORTNOX_CLIENT_ID', 'FORTNOX_CLIENT_SECRET', 'FORTNOX_SCOPES'].forEach(varName => {
  if (!process.env[varName]) {
    console.error(`Error: Missing ${varName} in .env file`);
    process.exit(1);
  }
});

// ===== EXPRESS SETUP =====
const app = express();
app.use(express.json());

// Configure session
app.use(session({
  secret: process.env.SESSION_SECRET || 'test-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// ===== SERVICES SETUP =====

// Create a token store
const tokenStore = new InMemoryStore();

// Create a state storage
const stateStorage = new InMemoryStateStorage();

// Initialize the token manager
const tokenManager = new TokenManager(
  process.env.FORTNOX_CLIENT_ID,
  process.env.FORTNOX_CLIENT_SECRET,
  tokenStore,
  AUTH_BASE_URL
);

// Initialize the authorization service
const authService = new AuthorizationService(
  process.env.FORTNOX_CLIENT_ID,
  process.env.FORTNOX_CLIENT_SECRET,
  `http://localhost:${PORT}/callback`,
  process.env.FORTNOX_SCOPES.split(' '),
  stateStorage,
  tokenStore,
  AUTH_BASE_URL
);

// Initialize the API client factory
const apiClientFactory = new ApiClientFactory(
  tokenManager,
  {
    baseUrl: API_BASE_URL,
    defaultHeaders: {
      'Accept': 'application/json'
    }
  }
);

// ===== ROUTES =====

// Authorization redirect
app.get('/activate', (req, res) => {
  try {
    // Generate authorization URL
    const { authUrl, state, codeVerifier } = authService.generateAuthUrl(USER_ID);
    
    // Store PKCE data in session
    req.session.state = state;
    req.session.codeVerifier = codeVerifier;
    
    // Redirect to Fortnox
    res.redirect(authUrl);
  } catch (error) {
    console.error('Failed to generate auth URL:', error);
    res.status(500).send('Failed to generate authorization URL');
  }
});

// OAuth callback
app.get('/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
    if (error) {
      console.error('Auth error:', error);
      return res.redirect('/error');
    }
    
    if (!code || !state) {
      return res.redirect('/error?reason=missing_params');
    }
    
    // Validate the state from session
    if (req.session.state !== state) {
      return res.redirect('/error?reason=invalid_state');
    }
    
    // Exchange code for tokens
    await authService.exchangeCodeForTokens(
      USER_ID,
      code,
      req.session.codeVerifier
    );
    
    // Clean up session
    delete req.session.state;
    delete req.session.codeVerifier;
    
    res.redirect('/success');
  } catch (error) {
    console.error('Auth callback error:', error);
    res.redirect(`/error?reason=${encodeURIComponent(error.message)}`);
  }
});

// Success page
app.get('/success', (req, res) => {
  res.send(`
    <h1>Authentication Successful!</h1>
    <p>You can now use the API endpoints.</p>
    <p><a href="/api/company">View Company Information</a></p>
    <p><a href="/api/token-status">View Token Status</a></p>
  `);
});

// Error page
app.get('/error', (req, res) => {
  res.status(400).send(`
    <h1>Authentication Failed</h1>
    <p>Reason: ${req.query.reason || 'Unknown error'}</p>
    <p><a href="/activate">Try Again</a></p>
  `);
});

// API endpoint
app.get('/api/company', async (req, res) => {
  try {
    // Create an API client
    const client = await apiClientFactory.createClient(USER_ID);
    
    // Make API request
    const response = await client.get('/companyinformation');
    
    res.json(response.data);
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch company information',
      message: error.message
    });
  }
});

// Token status endpoint
app.get('/api/token-status', async (req, res) => {
  try {
    const tokens = await tokenManager.getTokens(USER_ID);
    
    if (!tokens) {
      return res.json({ authenticated: false });
    }
    
    const isExpired = tokenManager.isTokenExpired(tokens);
    const expiresIn = tokens.expiry_date 
      ? Math.floor((tokens.expiry_date - Date.now()) / 1000)
      : 0;
    
    res.json({
      authenticated: true,
      isExpired,
      expiresIn,
      scopes: tokens.scope
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Token refresh endpoint
app.post('/api/refresh', async (req, res) => {
  try {
    const refreshedTokens = await tokenManager.refreshTokens(USER_ID);
    
    res.json({
      success: true,
      expiresIn: refreshedTokens.expires_in
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log(`
======================================================
Service-based example server running on http://localhost:${PORT}

This example demonstrates using the individual services:
- AuthorizationService: OAuth flow & authorization
- TokenManager: Token storage & refresh
- ApiClientFactory: API client creation with interceptors

To authenticate:
  Visit http://localhost:${PORT}/activate
======================================================
  `);
}); 