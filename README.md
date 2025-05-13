# fortnox-node-oauth-kit

A simple Node.js + TypeScript SDK for authenticating against Fortnox via OAuth 2.

## Quick Start

```bash
# Install
npm install fortnox-node-oauth-kit

# Create .env file with your Fortnox credentials
cp example.env .env
# Edit .env with your credentials

# Start the example server
npm run build
node examples/simple-express-server.js
```

Then visit `http://localhost:4005/activate` to start the OAuth flow.

## Basic Usage

```typescript
import { FortnoxClient, InMemoryStore } from 'fortnox-node-oauth-kit';
import express from 'express';

// Create Express app
const app = express();

// Create Fortnox client
const fortnoxClient = new FortnoxClient({
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  redirectUri: 'http://localhost:4000/callback',
  scopes: ['invoice', 'customer'],
  tokenStore: new InMemoryStore()
});

// Example API call to Fortnox
app.get('/api/customers', async (req, res) => {
  try {
    // Get client for a specific user (you'd normally get this from your auth system)
    const client = await fortnoxClient.getClient('user-123');
    
    // Make API call
    const response = await client.get('/customers');
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

app.listen(4000, () => {
  console.log('Server running on http://localhost:4000');
});
```

## Architecture

The library is built on a service-based architecture with three main components:

### AuthorizationService

Manages the OAuth 2.0 authorization flow:
- Generating authorization URLs with PKCE support
- Securely managing state parameters
- Exchanging authorization codes for tokens
- Protecting against CSRF attacks

```typescript
import { AuthorizationService, InMemoryStore, InMemoryStateStorage } from 'fortnox-node-oauth-kit';

const authService = new AuthorizationService(
  clientId,
  clientSecret,
  redirectUri,
  ['invoice', 'customer'],
  new InMemoryStateStorage(),
  new InMemoryStore()
);

// Generate authorization URL
const { authUrl, state, codeVerifier } = authService.generateAuthUrl('user-123');

// Exchange code for tokens after redirect
const tokens = await authService.exchangeCodeForTokens('user-123', code, codeVerifier);
```

### TokenManager

Handles all token-related operations:
- Storing and retrieving tokens
- Refreshing expired tokens
- Token encryption and security
- Concurrency control for refreshing tokens

```typescript
import { TokenManager, InMemoryStore } from 'fortnox-node-oauth-kit';

const tokenManager = new TokenManager(
  clientId,
  clientSecret,
  new InMemoryStore()
);

// Get valid tokens (automatically refreshes if needed)
const tokens = await tokenManager.getValidTokens('user-123');

// Manually refresh tokens
const newTokens = await tokenManager.refreshTokens('user-123');
```

### ApiClientFactory

Creates authenticated API clients:
- Configured with proper authorization headers
- Automatic token refresh on 401 errors
- Consistent error handling
- Configurable request options

```typescript
import { ApiClientFactory, TokenManager } from 'fortnox-node-oauth-kit';

const apiClientFactory = new ApiClientFactory(
  tokenManager,
  { 
    baseUrl: 'https://api.fortnox.se/3',
    defaultHeaders: {'Accept': 'application/json'},
    timeout: 10000
  }
);

// Create an authenticated client
const client = await apiClientFactory.createClient('user-123');

// Make API calls
const response = await client.get('/customers');
```

## Development

```bash
# Install dependencies
npm install

# Start development server with hot reloading
npm run dev
```

## Features

- Complete OAuth 2.0 flow with PKCE for Fortnox API
- Automatic token refresh with concurrency control
- In-memory and PostgreSQL token storage
- Express router for easy integration
- TypeScript support
- **Enhanced Security Features**:
  - Secure state parameter handling with automatic expiration
  - Token encryption at rest (AES-256-GCM)
  - Protection against CSRF attacks
  - Token key rotation capability
  - Follows OAuth 2.0 security best practices

## Storage Options

### InMemoryStore (Default)
```typescript
// Tokens are stored in memory (lost on restart)
const tokenStore = new InMemoryStore();
```

### PostgresStore
```typescript
// Tokens are stored in PostgreSQL
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const tokenStore = new PostgresStore({ pool });
await tokenStore.initialize(); // Create table if it doesn't exist
```

### SecureTokenStore (Recommended for Production)
```typescript
// Tokens are encrypted before storage
import { SecureTokenStore, PostgresStore, TokenEncryption } from 'fortnox-node-oauth-kit';

// Generate a key during deployment (store securely)
// const key = TokenEncryption.generateKey();
// console.log('Save this key:', TokenEncryption.keyToString(key));

const tokenStore = new SecureTokenStore({
  baseStore: new PostgresStore({ pool }),
  encryptionKey: process.env.TOKEN_ENCRYPTION_KEY,
  enforceEncryption: true
});
```

## Security

This library follows OAuth 2.0 security best practices. For detailed security guidelines, please see [SECURITY.md](SECURITY.md).

## Examples

Check the `examples` directory for:
- A simple Express server example (`simple-express-server.js`)
- Secure implementation with token encryption (`secure-server-example.js`)
- Direct service usage for advanced use cases (`using-services.js`)

## License

MIT 