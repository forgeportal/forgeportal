---
title: Webhooks
sidebar_position: 6
---

# Webhooks

ForgePortal receives **SCM webhook events** (GitHub and GitLab) on a single endpoint. The server verifies the payload signature (or token) and processes push, pull request, and repository events for catalog updates. This page describes the endpoint, expected headers, body format, and signature verification.

---

## Endpoint

**POST** `/api/v1/webhooks/scm`

- **Content-Type**: `application/json`
- **Auth**: None (webhooks are authenticated via signature/token in headers).
- **Rate limit**: 100 requests per minute per IP. Responses **429** with `Retry-After` when exceeded.

---

## Headers (provider-specific)

### GitHub

| Header               | Description |
|----------------------|-------------|
| `X-Hub-Signature-256`| HMAC-SHA256 of the **raw body** using the webhook secret. Format: `sha256=<hex>`. **Required** for verification. |
| `X-GitHub-Event`     | Event type (e.g. `push`, `pull_request`, `repository`). |
| `X-GitHub-Delivery`  | Unique delivery ID (used for deduplication). |

If `X-Hub-Signature-256` is present, the server treats the request as GitHub.

### GitLab

| Header           | Description |
|------------------|-------------|
| `X-Gitlab-Token` | Secret token configured in the GitLab webhook (sent as-is; compared to `scm.gitlab.webhookSecret`). **Required** for verification. |
| `X-Gitlab-Event` | Event type (e.g. `Push Hook`, `Merge Request Hook`). |

If `X-Gitlab-Token` is present, the server treats the request as GitLab.

---

## Request body

The body is the **raw JSON payload** sent by the SCM. For signature verification, the server uses the raw body (before parsing). Examples of payload shapes:

- **GitHub push**: `repository`, `ref`, `commits`, `pusher`, etc.
- **GitHub pull_request**: `action`, `pull_request`, `repository`, etc.
- **GitLab Push Hook**: `project`, `ref`, `commits`, `repository`, etc.

No single schema is documented here; refer to [GitHub Webhook events](https://docs.github.com/en/webhooks/webhook-events-and-payloads) and [GitLab System Hooks / Project Hooks](https://docs.gitlab.com/ee/user/project/integrations/webhooks.html) for the exact structure.

---

## Response

**Success**: The server returns a JSON object that includes at least `status: "ok"`. It may include extra fields (e.g. `action`, `eventId`). Duplicate events (same delivery ID or dedupe key) may return `{ status: "ok", action: "duplicate", eventId: "..." }` without reprocessing.

**Errors** (JSON body with `error` and `message`):

| Status | Condition |
|--------|-----------|
| 401 | Missing webhook signature or token header; or invalid signature/token. |
| 500 | Webhook secret not configured for the provider; or raw body not available; or SCM provider not configured. |
| 429 | Rate limit exceeded. Response includes `Retry-After` header. |

---

## Signature verification (guide)

### GitHub

1. **Configure** the same secret in ForgePortal (`scm.github.webhookSecret`) and in GitHub (Settings → Webhooks → Add webhook → Secret).
2. GitHub signs the **raw body** with HMAC-SHA256 and sends it in `X-Hub-Signature-256` as `sha256=<hex>`.
3. ForgePortal recomputes HMAC-SHA256 of the raw request body with the configured secret and compares it to the header (constant-time). If they differ, the server responds **401 Unauthorized** and does not process the event.

### GitLab

1. **Configure** the same token in ForgePortal (`scm.gitlab.webhookSecret`) and in GitLab (Project/Group → Settings → Webhooks → Secret token).
2. GitLab sends this token in the `X-Gitlab-Token` header.
3. ForgePortal compares the header value to the configured secret. If they differ or the header is missing, the server responds **401 Unauthorized**.

(Some GitLab setups may use a signature instead of a token; the current implementation uses the token header. If your GitLab version sends a signature, ensure the server implementation matches the docs.)

---

## Configuring the webhook (GitHub)

1. Repo or org → **Settings** → **Webhooks** → **Add webhook**.
2. **Payload URL**: `https://<forgeportal-host>/api/v1/webhooks/scm`.
3. **Content type**: `application/json`.
4. **Secret**: Generate a random string (e.g. `openssl rand -hex 32`) and set it in both GitHub and ForgePortal (`scm.github.webhookSecret` or `FORGEPORTAL_SCM__GITHUB__WEBHOOK_SECRET`).
5. **Events**: Choose “Let me select individual events” and enable at least **Push**, and optionally **Pull request**, **Repository**.

---

## Configuring the webhook (GitLab)

1. Project or group → **Settings** → **Webhooks**.
2. **URL**: `https://<forgeportal-host>/api/v1/webhooks/scm`.
3. **Secret token**: Same value as in ForgePortal (`scm.gitlab.webhookSecret` or `FORGEPORTAL_SCM__GITLAB__WEBHOOK_SECRET`).
4. **Trigger**: Enable **Push events** and optionally **Merge request events**.

---

## Example (GitHub ping)

```bash
# GitHub sends a ping on webhook creation; body is like {"zen":"...","hook_id":...}
# You cannot fully test verification with curl without the correct signature;
# use GitHub's "Recent Deliveries" → "Redeliver" to retry.
curl -s -X POST "https://forgeportal.example.com/api/v1/webhooks/scm" \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: ping" \
  -H "X-GitHub-Delivery: unique-id" \
  -H "X-Hub-Signature-256: sha256=<computed-hmac-hex>" \
  -d '{"zen":"Design for failure.","hook_id":123}'
```

Without the correct `X-Hub-Signature-256`, the server returns **401**.
