# Security Best Practices

This document outlines security best practices when using the fortnox-node-oauth-kit library to integrate with Fortnox's OAuth 2.0 API.

## Token Storage

OAuth tokens are highly sensitive credentials that provide access to your Fortnox data. Proper storage and handling of these tokens is critical.

### In Production

For production use:

1. **Use the SecureTokenStore** with encryption:
   ```typescript
   import { SecureTokenStore, InMemoryStore, TokenEncryption } from 'fortnox-node-oauth-kit';
   
   // Generate a random encryption key (store this securely in your environment)
   const key = TokenEncryption.generateKey();
   console.log('Your encryption key:', TokenEncryption.keyToString(key));
   
   // Create a secure token store
   const tokenStore = new SecureTokenStore({
     baseStore: new PostgresStore({ pool }),
     encryptionKey: process.env.TOKEN_ENCRYPTION_KEY,
     enforceEncryption: true
   });
   ```

2. **Store encryption keys securely**:
   - Use environment variables loaded from a secure source
   - Consider a secrets management system like AWS Secrets Manager, HashiCorp Vault, etc.
   - NEVER hardcode encryption keys in your source code

3. **Use PostgresStore or implement a custom TokenStore**:
   - InMemoryStore is not suitable for production as tokens are lost on restart
   - Ensure your database is properly secured and encrypted at rest

## State Management

The OAuth state parameter protects against CSRF attacks. Proper handling of state is essential for secure authentication.

1. **Use the provided StateStorage**:
   ```typescript
   import { FortnoxClient, InMemoryStateStorage } from 'fortnox-node-oauth-kit';
   
   const stateStorage = new InMemoryStateStorage();
   
   const client = new FortnoxClient({
     // ... other options
     stateStorage 
   });
   ```

2. **For distributed environments**:
   - Implement a custom StateStorage backed by Redis or another distributed cache
   - Ensure state values are not predictable or enumerable

## HTTPS

Always use HTTPS for all redirect URIs and API endpoints. Fortnox requires HTTPS for production redirect URIs.

## Credential Handling

1. **Client Secret**: 
   - Treat your client secret as a sensitive credential
   - Store it securely in environment variables
   - Do not commit it to source control

2. **Redirect URI**:
   - Use exact matching redirect URIs
   - Validate and register every redirect URI with Fortnox

## Error Handling

Avoid leaking sensitive information in error messages:

```typescript
try {
  // Authentication code
} catch (error) {
  // Log the full error internally
  logger.error('Authentication error', error);
  
  // Return limited info to the client
  res.status(500).json({ 
    error: 'Authentication failed',
    // Don't include full error messages or stack traces
  });
}
```

## Token Refresh

1. **Implement proper token refresh**:
   - The FortnoxClient handles this automatically, but ensure you're catching and handling refresh errors
   - Be prepared for refresh token expiration

2. **Token rotation**:
   - Fortnox issues a new refresh token with each refresh
   - The library handles this automatically by updating tokens in your store

## Dependency Security

1. **Keep dependencies updated**:
   ```bash
   npm audit
   npm update
   ```

2. **Use lockfiles** (package-lock.json) to ensure consistent dependency versions

## Session Security

When using express-session:

```javascript
app.use(session({
  secret: crypto.randomBytes(32).toString('hex'), // Use a strong random secret
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: true, // Require HTTPS
    httpOnly: true, // Prevent JavaScript access
    sameSite: 'strict' // Protect against CSRF
  }
}));
```

## Additional Resources

- [OAuth 2.0 Threat Model (RFC 6819)](https://datatracker.ietf.org/doc/html/rfc6819)
- [OAuth 2.0 for Browser-Based Apps](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps)
- [OAuth 2.0 Security Best Current Practice](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)

## Reporting Security Issues

If you discover a security issue in this library, please report it by creating a GitHub issue marked as sensitive or contact the maintainers directly. 