---
name: Relayer API audit plan
overview: "Audit of all Polymarket Relayer usage in the codebase against the official Relayer API documentation (OpenAPI: POST /submit, GET /transaction, GET /nonce, GET /relay-payload, GET /deployed, GET /relayer/api/keys). Findings: base URL and SDK usage align; custom GET /safe/{eoa} is undocumented; optional alignment and hardening steps are recommended."
todos: []
isProject: false
---

# Relayer API Audit vs Official Documentation

## Summary

- **Base URL**: Matches (`https://relayer-v2.polymarket.com` in [packages/types/src/polymarket.ts](packages/types/src/polymarket.ts)).
- **Submit / execute / deploy**: Implemented via `@polymarket/builder-relayer-client` (RelayClient), which uses the **documented** endpoints POST /submit, GET /nonce, GET /relay-payload, GET /deployed, GET /transaction. Auth is Builder API keys only (remote signing).
- **Gap**: The codebase calls **GET `/safe/{eoaAddress}`** in three places to resolve “Safe address for this EOA”. This endpoint is **not** in the OpenAPI spec you provided. The spec only has GET /deployed?address= (proxy address), which answers “is this Safe deployed?” not “what is the Safe for this EOA?”.

---

## 1. Documented Relayer API (reference)

| Endpoint          | Method | Purpose                             | Auth                        |
| ----------------- | ------ | ----------------------------------- | --------------------------- |
| /submit           | POST   | Submit transaction                  | Builder or Relayer API keys |
| /transaction      | GET    | Get tx by id                        | —                           |
| /nonce            | GET    | Current nonce (address, type=PROXY  | SAFE)                       |
| /relay-payload    | GET    | Relayer address + nonce             | —                           |
| /deployed         | GET    | Is Safe deployed? (address = proxy) | —                           |
| /transactions     | GET    | Get recent transactions for a user  | Builder or Relayer API keys |
| /relayer/api/keys | GET    | List relayer API keys               | Gamma or Relayer API key    |

Base URL: `https://relayer-v2.polymarket.com`. Request/response schemas: SubmitRequest (from, to, proxyWallet, data, nonce, signature, signatureParams, type), SubmitResponse (transactionID, transactionHash, state), RelayerTransaction, NonceResponse, RelayPayloadResponse, DeployedResponse.

---

## 2. Codebase usage

### 2.1 Base URL and SDK

- [packages/types/src/polymarket.ts](packages/types/src/polymarket.ts): `RELAYER_URL = "https://relayer-v2.polymarket.com"` — **correct**.
- All submit/deploy/execute flows use **RelayClient** from `@polymarket/builder-relayer-client` (v0.0.8). The SDK’s `dist/endpoints.js` uses:
  - `POST /submit` (with Builder auth)
  - `GET /nonce`, `GET /relay-payload`, `GET /transaction`, `GET /deployed`
  - Plus `GET /transactions` — **documented** as [Get recent transactions for a user](https://docs.polymarket.com/api-reference/relayer/get-recent-transactions-for-a-user.md) (Builder or Relayer API key auth).

So all SDK-used endpoints are documented; the codebase aligns with the spec via the SDK.

### 2.2 Undocumented endpoint: GET /safe/{eoa}

Three call sites use **GET `${RELAYER_URL}/safe/${eoaAddress}`** and expect JSON with `safeAddress` or `proxyAddress` or `address`:

1. [apps/web/src/lib/trading/find-safe-address.ts](apps/web/src/lib/trading/find-safe-address.ts) (lines 28–36) — “Auto-find Safe”: tries relayer first, then Polygonscan.
2. [apps/web/src/hooks/use-deploy-safe.ts](apps/web/src/hooks/use-deploy-safe.ts) (lines 36–50) — `fetchSafeFromRelayer()` used when deploy fails with “already deployed” to resolve the Safe address.
3. [apps/web/src/components/onboarding/safe-onboarding.tsx](apps/web/src/components/onboarding/safe-onboarding.tsx) (lines 441–446, 529) — “Auto-find Safe Address” and the help link that points users at the relayer.

The [official Relayer API doc index](https://docs.polymarket.com) and the full [relayer-openapi.yaml](https://docs.polymarket.com/api-spec/relayer-openapi.yaml) define **only** these paths: `/submit`, `/transaction`, `/transactions`, `/nonce`, `/relay-payload`, `/deployed`, `/relayer/api/keys`. There is **no** `/safe` path in the spec. So either:

- The endpoint is **undocumented/legacy**, or  
- The public spec is incomplete.

**Implication**: If Polymarket removes or changes GET /safe/{eoa}, the three call sites above would break. The SDK does **not** use /safe/; it uses `deriveSafe(eoa)` + `getDeployed(derivedSafe)` (documented). So we already have a documented path for “is this Safe deployed?” and for deriving the address; we do **not** have a documented way to “look up Safe by EOA” other than this undocumented /safe/ call.

### 2.3 Auth

- **Builder auth**: Used everywhere we talk to the relayer (via RelayClient). Remote signing at [apps/server/src/routes/polymarket/sign.ts](apps/server/src/routes/polymarket/sign.ts) returns `POLY_BUILDER_SIGNATURE`, `POLY_BUILDER_TIMESTAMP`, `POLY_BUILDER_API_KEY`, `POLY_BUILDER_PASSPHRASE` — matches the doc’s Builder API key auth for /submit.
- **Relayer API keys**: Not used. No references to `RELAYER_API_KEY` or `RELAYER_API_KEY_ADDRESS` in app code. GET /relayer/api/keys is unused.

### 2.4 Types and error handling

- We do not define our own SubmitRequest / SubmitResponse / RelayerTransaction types; we rely on the SDK (e.g. `RelayerTransactionResponse` in [packages/api/src/lib/builder.ts](packages/api/src/lib/builder.ts)). SDK state enum matches the doc (STATE_NEW, STATE_EXECUTED, STATE_MINED, STATE_CONFIRMED, STATE_INVALID, STATE_FAILED).
- [packages/api/src/lib/relayer-errors.ts](packages/api/src/lib/relayer-errors.ts): Maps SDK/relayer messages and JSON `{ error, status }` to user-facing copy; 429 is mapped to “Too many requests” — consistent with doc’s “quota exceeded”.

### 2.5 Rate limiting

- [apps/server/src/lib/resilience/rate-limit-config.ts](apps/server/src/lib/resilience/rate-limit-config.ts): `relayer` service has a general limit (25 req/60s) and no per-endpoint overrides. Relayer calls are made from the **client** (web) via RelayClient and direct fetch, not via server proxy, so this server-side relayer bucket may apply only to server-side RelayClient usage (e.g. [packages/api/src/lib/builder.ts](packages/api/src/lib/builder.ts) if used from server). Client-side relayer traffic is not going through this limiter.

---

## 3. Alignment matrix

| Doc item                                                           | Codebase                                                  | Status                         |
| ------------------------------------------------------------------ | --------------------------------------------------------- | ------------------------------ |
| Base URL relayer-v2.polymarket.com                                 | RELAYER_URL in @doji/types                                | Match                          |
| POST /submit (Builder auth)                                        | RelayClient via remote sign → POLY_BUILDER_*              | Match                          |
| GET /nonce, /relay-payload, /deployed, /transaction, /transactions | Used inside RelayClient (getTransaction, getTransactions) | Match                          |
| GET /deployed?address= (proxy)                                     | SDK passes derived Safe address                           | Correct usage                  |
| SubmitRequest (proxyWallet, signatureParams, type, etc.)           | Built by SDK                                              | Assumed match (SDK contract)   |
| GET /safe/{eoa}                                                    | Used in 3 places for “Safe for EOA”                       | **Not in spec** (undocumented) |
| Relayer API key auth / GET /relayer/api/keys                       | Not used                                                  | N/A                            |
| Error handling 400/401/429/500                                     | relayer-errors.ts + status 429/5xx                        | Adequate                       |

---

## 4. Recommendations

1. **Confirm GET /safe/{eoa} with Polymarket** — Ask whether GET `/safe/{eoaAddress}` is supported long-term or legacy. If deprecated, plan to remove reliance on it.
2. **Optional: Derive-first + GET /deployed for “Safe for EOA”** — To rely only on documented endpoints: derive Safe address (same logic as SDK, e.g. `deriveSafe(eoa)` from builder-relayer-client), call GET /deployed?address={derivedSafe}, if `deployed === true` use derived address. Then remove or deprioritize GET /safe/{eoa} in [find-safe-address.ts](apps/web/src/lib/trading/find-safe-address.ts), [use-deploy-safe.ts](apps/web/src/hooks/use-deploy-safe.ts), and [safe-onboarding.tsx](apps/web/src/components/onboarding/safe-onboarding.tsx); update or remove the help link to `/safe/{address}`.
3. **Optional: Document Relayer in repo** — Add a short section (e.g. in AGENTS.md or docs): we use relayer-v2.polymarket.com and Builder auth only; list flows that use RelayClient vs direct fetch (GET /safe/); link to [Relayer API docs](https://docs.polymarket.com/api-spec/relayer-openapi.yaml) or [llms.txt](https://docs.polymarket.com/llms.txt).
4. **No change required for** — Base URL, SDK usage, Builder auth, or error mapping for 429/5xx. Relayer API keys and GET /relayer/api/keys can remain unused unless you add a relayer-key-based feature.

---

## 5. Files to touch (if you implement recommendation 2)

- [apps/web/src/lib/trading/find-safe-address.ts](apps/web/src/lib/trading/find-safe-address.ts) — replace or supplement relayer /safe/ with derive + GET /deployed (and possibly keep Polygonscan as fallback).
- [apps/web/src/hooks/use-deploy-safe.ts](apps/web/src/hooks/use-deploy-safe.ts) — `fetchSafeFromRelayer`: same derive + GET /deployed approach; ensure derive matches SDK for consistency.
- [apps/web/src/components/onboarding/safe-onboarding.tsx](apps/web/src/components/onboarding/safe-onboarding.tsx) — “Auto-find” and help link: use the new resolution method; update or remove the direct link to `/safe/{address}` if that endpoint is deprecated.

No changes are strictly required for the codebase to match the **documented** Relayer API; the only divergence is the use of the **undocumented** GET /safe/{eoa} for EOA → Safe lookup.

---

## 6. Extra confirmation (official docs + OpenAPI)

Checked against the Polymarket documentation index and the full relayer OpenAPI spec:

- **Doc index** ([api-reference](https://docs.polymarket.com)) lists these relayer pages: Get all relayer API keys, Check if a safe is deployed, Get a transaction by ID, Get current nonce for a user, **Get recent transactions for a user**, Get relayer address and nonce, Submit a transaction. **No** “Get Safe by EOA” or “GET /safe” page.
- **relayer-openapi.yaml** ([api-spec/relayer-openapi.yaml](https://docs.polymarket.com/api-spec/relayer-openapi.yaml)): `paths` contains only `/submit`, `/transaction`, `/transactions`, `/nonce`, `/relay-payload`, `/deployed`, `/relayer/api/keys`. **No** `/safe` or `/safe/{address}`.
- **GET /transactions** is documented as [Get recent transactions for a user](https://docs.polymarket.com/api-reference/relayer/get-recent-transactions-for-a-user.md); requires Builder or Relayer API key auth; returns an array of `RelayerTransaction`. The SDK’s `getTransactions()` uses this endpoint.

Conclusion: GET /safe/{eoa} is **not** part of the official Relayer API surface. Our three call sites rely on an undocumented (or legacy) endpoint.
