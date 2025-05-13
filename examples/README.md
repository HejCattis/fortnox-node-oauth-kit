# Examples

This directory contains examples showing how to use fortnox-node-oauth-kit.

## Running the Examples

1. Build the library:
   ```
   npm run build
   ```

2. Copy and edit the environment file:
   ```
   cp example.env .env
   # Then edit .env with your Fortnox credentials
   ```

3. Run one of the examples:
   ```
   node examples/simple-express-server.js
   # OR
   node examples/secure-server-example.js
   # OR
   node examples/using-services.js
   ```

4. Open your browser and visit:
   ```
   http://localhost:4005/activate
   ```

## Available Examples

### 1. Simple Express Server (`simple-express-server.js`)

Demonstrates basic integration with Express:
- Setting up a FortnoxClient with InMemoryStore
- Implementing the complete OAuth flow with PKCE
- Making authenticated API calls to Fortnox

### 2. Secure Implementation (`secure-server-example.js`)

Demonstrates security best practices when using the library:
- Token encryption at rest
- Secure state management with automatic expiration
- Protection against CSRF attacks
- Proper error handling
- Secure session configuration

To run this example, first generate an encryption key:

```bash
# Generate an encryption key for tokens
node -e "const { TokenEncryption } = require('./dist'); \
  const key = TokenEncryption.generateKey(); \
  console.log('TOKEN_ENCRYPTION_KEY=' + TokenEncryption.keyToString(key));" >> .env
```

### 3. Service-Based Architecture (`using-services.js`)

Demonstrates direct use of the individual service classes instead of the FortnoxClient facade, giving you more control and flexibility:

#### AuthorizationService
Handles the OAuth flow, including:
- Generating authorization URLs
- Managing state and PKCE parameters
- Exchanging authorization codes for tokens

#### TokenManager
Manages tokens with:
- Token storage
- Refreshing expired tokens
- Concurrent refresh handling

#### ApiClientFactory
Creates authenticated API clients with:
- Proper authorization headers
- Token refresh interceptors
- Error handling

## Using PostgreSQL for Token Storage

To use PostgreSQL instead of in-memory storage:

```js
const { Pool } = require('pg');
const { PostgresStore } = require('../dist');

// Create PostgreSQL pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Create and initialize PostgreSQL store
const tokenStore = new PostgresStore({ pool });
await tokenStore.initialize();

// Pass to FortnoxClient or directly to TokenManager
const fortnoxClient = new FortnoxClient({
  // ...other options
  tokenStore
});
```

## Production Recommendations

For production, you should:
- Use HTTPS (required by Fortnox for production)
- Store tokens in a database (not in memory)
- Use a proper session store (not the default in-memory store)
- Generate and securely store cryptographic keys
- Implement token encryption
- Set up proper error handling and logging

See [SECURITY.md](/SECURITY.md) for more details on security best practices. 