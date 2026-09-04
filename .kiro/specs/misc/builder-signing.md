# Builder Signing Endpoint

Remote signing for the Polymarket Builder Program. Keeps builder credentials on the server and returns signature headers for the CLOB client.

## Endpoint

- **URL**: `POST /api/polymarket/sign`
- **Spec**: [Polymarket relayer client](https://docs.polymarket.com/developers/builders/relayer-client)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `POLYMARKET_BUILDER_ID` | Yes | Builder API key |
| `POLYMARKET_BUILDER_SIGNING_KEY` | Yes | Base64-encoded signing secret |
| `POLYMARKET_BUILDER_PASSPHRASE` | Yes | Builder passphrase |
| `POLYMARKET_SIGN_TOKENS` | No | Comma-separated Bearer tokens. When set, requests must include `Authorization: Bearer <token>`. |

## Securing the Endpoint

To restrict who can obtain builder signatures:

1. Set `POLYMARKET_SIGN_TOKENS` to one or more secret tokens (e.g. from your secret manager).
2. Configure the client that calls the sign endpoint (e.g. web app or server-side CLOB client) to send `Authorization: Bearer <your-token>` on each request.
3. Requests without a valid token receive `401 Unauthorized`.

If `POLYMARKET_SIGN_TOKENS` is unset or empty, the endpoint does not require authentication (useful for local dev or legacy deployments).
