/**
 * Secure Fortnox OAuth Example
 * 
 * This example demonstrates security best practices when using fortnox-node-oauth-kit:
 * - Secure state storage with automatic expiration
 * - Token encryption at rest
 * - CSRF protection
 * - Secure session handling
 * - Proper error handling
 * 
 * To run this example:
 * 1. npm run build
 * 2. node examples/secure-server-example.js
 */

// Load environment variables
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const crypto = require('crypto');
const { 
  FortnoxClient, 
  InMemoryStore, 
  PostgresStore,
  SecureTokenStore, 
  TokenEncryption,
  InMemoryStateStorage, 
  createFortnoxAuthRouter 
} = require('../dist');

// ===== CONFIGURATION =====
const PORT = process.env.PORT || 4005;
const USER_ID = 'example-user';

// Required environment variables
const requiredEnvVars = [
  'FORTNOX_CLIENT_ID', 
  'FORTNOX_CLIENT_SECRET', 
  'FORTNOX_SCOPES'
];

// Check environment variables
requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    console.error(`Error: Missing ${varName} in .env file`);
    process.exit(1);
  }
});

// ===== EXPRESS SETUP =====
const app = express();
app.use(express.json());

// Configure secure sessions (in production, use a persistent session store)
app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production', // Require HTTPS in production
    httpOnly: true,  // Prevent JavaScript access
    sameSite: 'lax'  // CSRF protection (use 'strict' in production)
  }
}));

// ===== FORTNOX CLIENT SETUP =====

// Set the redirect URI
const redirectUri = `http${process.env.NODE_ENV === 'production' ? 's' : ''}://localhost:${PORT}/auth-redir`;

// Create a secure state storage with automatic expiration
const stateStorage = new InMemoryStateStorage();

// Create a token store with encryption
let tokenStore;

if (process.env.DATABASE_URL && process.env.TOKEN_ENCRYPTION_KEY) {
  // For production: PostgreSQL with encryption
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  // Create the base Postgres store
  const postgresStore = new PostgresStore({ pool });
  
  // Initialize the database table
  (async () => {
    try {
      await postgresStore.initialize();
      console.log('PostgreSQL store initialized');
    } catch (error) {
      console.error('Failed to initialize PostgreSQL store:', error.message);
      process.exit(1);
    }
  })();
  
  // Wrap with encryption
  tokenStore = new SecureTokenStore({
    baseStore: postgresStore,
    encryptionKey: process.env.TOKEN_ENCRYPTION_KEY,
    enforceEncryption: true
  });
  
  console.log('Using encrypted PostgreSQL token storage');
} else {
  // For development: In-memory storage
  console.log('Using in-memory token storage (tokens will be lost on restart)');
  
  // Use SecureTokenStore with in-memory base store for demonstration
  // In production, always use a persistent store
  if (process.env.TOKEN_ENCRYPTION_KEY) {
    tokenStore = new SecureTokenStore({
      baseStore: new InMemoryStore(),
      encryptionKey: process.env.TOKEN_ENCRYPTION_KEY
    });
    console.log('Token encryption enabled');
  } else {
    tokenStore = new InMemoryStore();
    console.warn('⚠️ Token encryption disabled - not recommended for production');
  }
}

// Create Fortnox client with security features
const fortnoxClient = new FortnoxClient({
  clientId: process.env.FORTNOX_CLIENT_ID,
  clientSecret: process.env.FORTNOX_CLIENT_SECRET,
  redirectUri,
  scopes: process.env.FORTNOX_SCOPES.split(' '),
  tokenStore,
  stateStorage,
});

// Create Fortnox auth router with custom handlers
const fortnoxAuthRouter = createFortnoxAuthRouter({
  fortnoxClient,
  getUserId: () => USER_ID,
  activatePath: '/activate',
  callbackPath: '/auth-redir',
  successRedirect: '/auth-success',
  failureRedirect: '/auth-failure',
  afterActivate: (req, res, { state, codeVerifier }) => {
    // Store PKCE data in session
    req.session.fortnoxState = state;
    req.session.fortnoxCodeVerifier = codeVerifier;
    // Let router handle the redirect
  },
  afterCallback: (req, res, tokens) => {
    // Log success (but don't log the actual tokens)
    console.log('Authentication successful!', { 
      user: USER_ID,
      scope: tokens.scope,
      expires_in: tokens.expires_in
    });
    
    // Clean up session data
    delete req.session.fortnoxState;
    delete req.session.fortnoxCodeVerifier;
    
    // Redirect to success page
    res.redirect('/auth-success');
  }
});

// Add router to Express
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

// Error handling middleware
function handleApiError(error, req, res, message) {
  // Log full error details (for server logs only)
  console.error(`API error - ${message}:`, error.message);
  
  // Return limited error info to client
  res.status(500).json({
    error: message,
    // Avoid detailed error info in production responses
    ...(process.env.NODE_ENV !== 'production' && { details: error.message })
  });
}

// Example API call to fetch company information
app.get('/api/company-info', async (req, res) => {
  try {
    // Get authenticated API client
    const client = await fortnoxClient.getClient(USER_ID);
    
    // Make API call
    const response = await client.get('/companyinformation', {
      headers: { 'Accept': 'application/json' }
    });
    
    // Return the data
    res.json(response.data);
  } catch (error) {
    handleApiError(error, req, res, 'Failed to get company information');
  }
});

// Token status endpoint (for demonstration)
app.get('/api/token-status', async (req, res) => {
  try {
    const tokens = await tokenStore.getTokens(USER_ID);
    
    if (!tokens) {
      return res.json({ authenticated: false });
    }
    
    // Calculate expiry
    const now = Date.now();
    const expiryDate = tokens.expiry_date || 0;
    const expiresIn = Math.max(0, Math.floor((expiryDate - now) / 1000));
    
    // Return token status (without the actual tokens)
    res.json({
      authenticated: true,
      scope: tokens.scope,
      expiresIn,
      isExpired: expiresIn <= 0
    });
  } catch (error) {
    handleApiError(error, req, res, 'Failed to check token status');
  }
});

// Revoke tokens endpoint
app.post('/api/revoke-tokens', async (req, res) => {
  try {
    await fortnoxClient.revokeTokens(USER_ID);
    res.json({ success: true, message: 'Tokens revoked successfully' });
  } catch (error) {
    handleApiError(error, req, res, 'Failed to revoke tokens');
  }
});

// ===== HELPER ENDPOINTS =====

// For testing/demo purposes only - never expose in production
if (process.env.NODE_ENV !== 'production') {
  // Generate encryption key
  app.get('/generate-key', (req, res) => {
    const key = TokenEncryption.generateKey();
    res.json({ 
      key: TokenEncryption.keyToString(key),
      note: 'Save this key securely in your environment variables'
    });
  });
}

// Status endpoint
app.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    features: {
      encryptedTokens: !!process.env.TOKEN_ENCRYPTION_KEY,
      persistentStorage: !!process.env.DATABASE_URL,
      secureState: true
    }
  });
});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log(`
=====================================================
🔒 Secure Fortnox OAuth server running on http://localhost:${PORT}

🔑 Authentication:
   Visit http://localhost:${PORT}/activate to begin OAuth flow

📋 Security features:
   - ${process.env.TOKEN_ENCRYPTION_KEY ? '✅' : '❌'} Token encryption
   - ${process.env.DATABASE_URL ? '✅' : '❌'} Persistent token storage
   - ✅ Secure state management
   - ✅ CSRF protection
   - ${process.env.NODE_ENV === 'production' ? '✅' : '❌'} Production mode

⚠️ Important:
   Make sure your Fortnox application uses this exact redirect URI:
   ${redirectUri}
=====================================================
  `);
}); 