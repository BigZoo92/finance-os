<!-- GENERATED — DO NOT EDIT
     Source: .agentic/source/skills/finance-os/powens-integration/SKILL.md
     Hash:   sha256:7c54a07d578b6100
     Sync:   pnpm agent:skills:sync -->

---
name: finance-os-powens-integration
description: "Powens banking aggregation integration — OAuth2 flow, token encryption, callback security, sync lifecycle. Use when working on bank connections, sync, or the Powens client."
---

# Finance-OS Powens Integration

## When to use
- Working on bank connection flows (connect, reconnect, manage)
- Modifying the Powens HTTP client or token handling
- Touching callback endpoints or state validation
- Debugging sync failures or connection statuses
- Modifying the encryption/decryption layer

## When NOT to use
- UI-only changes to the integrations page (use `ui-cockpit`)
- Worker sync logic (use `worker-sync`)
- General API route changes unrelated to Powens

---

## 1. OAuth2 Connect Flow

```
User clicks "Connect bank"
  → API generates connect URL with signed state
  → User redirected to Powens webview
  → Powens redirects back to callback URL with code + state
  → API validates state (HMAC + TTL)
  → API exchanges code for access token
  → Token encrypted AES-256-GCM and stored in DB
  → Sync job enqueued
```

### State Parameter Security
- State is HMAC-SHA256 signed with `APP_ENCRYPTION_KEY`
- Contains: `userId`, `timestamp`, `nonce`
- TTL: 10 minutes — reject if expired
- Single-use: store nonce, reject replays

```typescript
// State generation
const state = signState({ userId, timestamp: Date.now(), nonce: crypto.randomUUID() });

// State validation in callback
const { valid, payload } = verifyState(state, { maxAge: 600_000 }); // 10min
if (!valid) throw new ForbiddenError('Invalid or expired state');
```

---

## 2. Token Encryption

All Powens access tokens are encrypted before storage. Never store plaintext tokens.

**Format**: `v1:base64(iv):base64(authTag):base64(encrypted)`

```typescript
// Encrypt before storage
const encrypted = encrypt(accessToken, APP_ENCRYPTION_KEY);
await db.update(powensConnections).set({ accessToken: encrypted });

// Decrypt before use
const decrypted = decrypt(connection.accessToken, APP_ENCRYPTION_KEY);
const accounts = await powensClient.getAccounts(decrypted);
```

**Rules**:
- `APP_ENCRYPTION_KEY` must be exactly 32 bytes
- Key accepts raw bytes, hex, or base64 encoding
- Never log decrypted tokens
- Never pass decrypted tokens to client/frontend

---

## 3. Connection Statuses

| Status | Meaning | UI indicator |
|---|---|---|
| `active` | Connected, syncing normally | Green |
| `needs_reauth` | Token expired, user must reconnect | Amber warning |
| `error` | Provider error, retry possible | Red |
| `disconnected` | User explicitly disconnected | Grey |

---

## 4. Callback Endpoint Security

The callback endpoint (`/integrations/powens/callback`) is critical:

- [ ] Validate HMAC signature on state parameter
- [ ] Check TTL (reject > 10 minutes)
- [ ] Check nonce for replay prevention
- [ ] Exchange code for token server-side only
- [ ] Encrypt token immediately after exchange
- [ ] Log callback receipt (without token values)
- [ ] Return redirect to UI, never raw token data

---

## 5. Powens HTTP Client

Located in `packages/powens/`. Retry policy:

| Status | Action |
|---|---|
| 408, 429, 5xx | Retry up to 2 times |
| 401 | Mark connection as `needs_reauth` |
| Other 4xx | Fail immediately |

- Timeout: 30 seconds per request
- All requests include `x-request-id` for tracing

---

## 6. Safe Logging

```typescript
// CORRECT — log connection lifecycle, not secrets
logger.info({ connectionId, status: 'active', accountCount: 3 });

// WRONG — never log tokens
logger.info({ connectionId, accessToken: decrypted });
```

## Common Mistakes

1. **Storing plaintext tokens** — always encrypt with AES-256-GCM
2. **Not validating state TTL** — allows old callbacks to succeed
3. **Logging token values** — secret leak in logs
4. **Returning token to client** — tokens are server-side only
5. **Not handling `needs_reauth`** — user sees stale "connected" status

## References
- [EXTERNAL-SERVICES.md](docs/context/EXTERNAL-SERVICES.md) — Powens section
- [APP-ARCHITECTURES.md](docs/context/APP-ARCHITECTURES.md) — packages/powens
- [FEATURES.md](docs/context/FEATURES.md) — Powens Integration feature
- GitNexus cluster: `powens` (29 symbols)
