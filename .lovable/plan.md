

# Fix AlinmaPay 601 Error — Match Exact Postman Contract

## Problem
The current edge function sends a **top-level `trackId`** field in the request body. The official Postman documentation does NOT include this field — the order identifier only appears inside `order.orderId`. This extra/unexpected field is likely causing the gateway to reject with 601.

## Root Cause (from Postman docs vs current code)

Current code sends:
```json
{
  "terminalId": "...",
  "password": "...",
  "trackId": "1234567890123",   // ← NOT in Postman docs
  "paymentType": 1,
  "signature": "...",
  ...
}
```

Postman docs show (Hosted Payment Page):
```json
{
  "terminalId": "...",
  "password": "...",
  "signature": "...",
  "paymentType": 1,
  "merchantIp": "10.10.10.10",
  "customerIp": "10.10.10.10",
  "amount": "5.00",
  "country": "SA",
  "currency": "SAR",
  "order": { "orderId": "UNIQUE_ID" },
  "customer": { ... },
  "additionalDetails": { "userData": "{...}" }
}
```

## Plan

### Step 1: Rewrite the payload in `create-alinma-payment/index.ts`

- **Remove** top-level `trackId` from the request body
- **Keep** the signature formula as `orderId|terminalId|password|merchantKey|amount|currency` (same as before, just using orderId variable name for clarity)
- **Match exact field order** from Postman: `terminalId`, `password`, `signature`, `paymentType`, `merchantIp`, `customerIp`, `amount`, `country`, `currency`, `order`, `customer`, `additionalDetails`
- **Remove** all retry/variant logic — send exactly ONE payload to ONE URL
- **No headers auth** — Postman shows no special headers (no `authorization` header for Hosted Payment Page)

### Step 2: Simplify the function

- Remove `payloadVariants` loop, `callGateway` with auth header variations
- Single `fetch()` call to `https://pg.alinmapay.com.sa/Transactions/v2/payments/pay-request`
- Keep signature generation, payment record creation, and error handling

### Step 3: Deploy and verify

- Deploy the edge function
- Check logs to confirm the exact payload being sent

## Technical Details

The signature input string remains: `orderId|terminalId|password|merchantKey|amount|currency`

The request body will be exactly:
```json
{
  "terminalId": "TER...",
  "password": "TER...",
  "signature": "<sha256_hex>",
  "paymentType": 1,
  "merchantIp": "10.10.10.10",
  "customerIp": "10.10.10.10",
  "amount": "5.00",
  "country": "SA",
  "currency": "SAR",
  "order": {
    "orderId": "<unique_per_request>"
  },
  "customer": {
    "cardHolderName": "Customer Name",
    "customerEmail": "email@example.com",
    "billingAddressStreet": "",
    "billingAddressCountry": "SA"
  },
  "additionalDetails": {
    "userData": "{\"paymentId\":\"...\",\"courseId\":\"...\"}"
  }
}
```

No extra fields. No retries. No header-based auth. Exact Postman match.

