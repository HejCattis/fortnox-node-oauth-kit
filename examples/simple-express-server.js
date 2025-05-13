/**
 * Fortnox OAuth Simple Example
 * 
 * This is a minimal example of using fortnox-node-oauth-kit with Express.
 * Run this example after building the library with:
 * - npm run build
 * - node examples/simple-express-server.js
 */

// Load environment variables from .env file (copy example.env to .env first)
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const session = require('express-session');

// Import the library components from the built package
const { 
  FortnoxClient, 
  InMemoryStore, 
  createFortnoxAuthRouter, 
  InMemoryStateStorage 
} = require('../dist');

// ===== CONFIGURATION =====
const PORT = process.env.PORT || 4005;
const USER_ID = 'example-user'; // This would typically come from your user system

// Check that required env vars are set
['FORTNOX_CLIENT_ID', 'FORTNOX_CLIENT_SECRET', 'FORTNOX_SCOPES'].forEach(varName => {
  if (!process.env[varName]) {
    console.error(`Error: Missing ${varName} in .env file`);
    process.exit(1);
  }
});

// ===== EXPRESS SETUP =====
const app = express();
app.use(express.json());
app.use(cors());

// Add session support for better state management
app.use(session({
  secret: 'fortnox-example-secret', // In production, use a proper secret
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Use secure: true in production with HTTPS
}));

// ===== FORTNOX CLIENT SETUP =====

// Set the redirect URI for OAuth
const redirectUri = `http://localhost:${PORT}/auth-redir`;

// 1. Create a token store (InMemoryStore is simplest to start with)
const tokenStore = new InMemoryStore();

// Create a secure state storage with automatic cleanup
const stateStorage = new InMemoryStateStorage();

// 2. Create the Fortnox client
const fortnoxClient = new FortnoxClient({
  clientId: process.env.FORTNOX_CLIENT_ID,
  clientSecret: process.env.FORTNOX_CLIENT_SECRET,
  redirectUri,
  scopes: process.env.FORTNOX_SCOPES.split(' '),
  tokenStore,
  stateStorage, // Use the secure state storage
});

// 3. Create OAuth router and add it to Express
const fortnoxAuthRouter = createFortnoxAuthRouter({
  fortnoxClient,
  getUserId: () => USER_ID, // Always use the same test user
  activatePath: '/activate',
  callbackPath: '/auth-redir',
  successRedirect: '/auth-success',
  failureRedirect: '/auth-failure',
  // Custom handlers (optional)
  afterActivate: (req, res, { state, codeVerifier }) => {
    // Store PKCE data in session
    req.session.fortnoxState = state;
    req.session.fortnoxCodeVerifier = codeVerifier;
    // Let the router handle the redirect
  },
  afterCallback: (req, res, tokens) => {
    console.log('Authentication successful! Tokens received:', {
      access_token: tokens.access_token ? `${tokens.access_token.substring(0, 10)}...` : undefined,
      refresh_token: tokens.refresh_token ? `${tokens.refresh_token.substring(0, 10)}...` : undefined,
      expires_in: tokens.expires_in,
      token_type: tokens.token_type,
    });
    // Redirect to success page
    res.redirect('/auth-success');
  }
});

app.use(fortnoxAuthRouter);

// ===== SUCCESS/FAILURE PAGES =====

app.get('/auth-success', (req, res) => {
  res.send(`
    <h1>Authentication Successful!</h1>
    <p>You can now use the API endpoints.</p>
    <p><a href="/api/company-info">View Company Info</a></p>
  `);
});

app.get('/auth-failure', (req, res) => {
  res.status(400).send(`
    <h1>Authentication Failed</h1>
    <p>Please <a href="/activate">try again</a>.</p>
  `);
});

// ===== API ENDPOINTS =====

// Example API call to fetch company information from Fortnox
app.get('/api/company-info', async (req, res) => {
  try {
    // Get authenticated API client for our user
    const client = await fortnoxClient.getClient(USER_ID);
    
    // Make the API call
    const response = await client.get('/companyinformation', {
      headers: { 'Accept': 'application/json' }
    });
    
    // Return the data
    res.json(response.data);
  } catch (error) {
    console.error('API error:', error.message);
    res.status(500).json({ 
      error: 'Failed to get company information',
      message: error.message
    });
  }
});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log(`
=====================================================
🚀 Example server running on http://localhost:${PORT}

🔑 To authenticate:
   Visit http://localhost:${PORT}/activate

⚠️ Make sure your Fortnox application is configured with:
   Redirect URI: ${redirectUri}
=====================================================
  `);
}); 