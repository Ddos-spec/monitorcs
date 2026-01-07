## Workflow n8n (GET /webhook/crm-messages)

Gunakan workflow berikut (versi diringkas) supaya frontend bisa fetch messages:

```json
{
  "nodes": [
    {
      "parameters": {
        "path": "crm-messages",
        "httpMethod": "GET",
        "responseMode": "responseNode",
        "options": {
          "responseHeaders": {
            "entries": [
              { "name": "Access-Control-Allow-Origin", "value": "https://monitorcs.vercel.app" },
              { "name": "Access-Control-Allow-Methods", "value": "GET" },
              { "name": "Access-Control-Allow-Headers", "value": "Content-Type" }
            ]
          }
        }
      },
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2.1,
      "position": [-1680, 896],
      "name": "nampilin chat - webhook (GET)"
    },
    {
      "parameters": {
        "jsCode": "const esc = (v) => (v ?? '').toString().replace(/'/g, \"''\");\n\nreturn $input.all().map((item) => {\n  const root = Array.isArray(item.json) ? item.json[0] : item.json;\n  const q = root.query || {};\n\n  const session = esc(q.session);\n  const limit = Math.min(Math.max(Number(q.limit || 500), 1), 2000);\n\n  return { json: { session, limit } };\n});"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [-1440, 896],
      "name": "nampilin chat - parse query"
    },
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "SELECT\n  session,\n  msg_id,\n  ts,\n  role,\n  push_name,\n  body_text\nFROM chats\nWHERE session = '{{ $json.session }}'\nORDER BY ts ASC\nLIMIT {{ $json.limit }};"
      },
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.6,
      "position": [-1232, 896],
      "name": "nampilin chat - select from postgres",
      "credentials": { "postgres": { "id": "GLBNyhp2zJxmYKqL", "name": "trial cs" } }
    },
    {
      "parameters": {
        "responseMode": "lastNode",
        "responseCode": 200,
        "options": {
          "responseHeaders": {
            "entries": [
              { "name": "Access-Control-Allow-Origin", "value": "https://monitorcs.vercel.app" },
              { "name": "Access-Control-Allow-Methods", "value": "GET" },
              { "name": "Access-Control-Allow-Headers", "value": "Content-Type" }
            ]
          }
        }
      },
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.5,
      "position": [-1040, 896],
      "name": "nampilin chat - respond"
    }
  ],
  "connections": {
    "nampilin chat - webhook (GET)": { "main": [ [ { "node": "nampilin chat - parse query", "type": "main", "index": 0 } ] ] },
    "nampilin chat - parse query": { "main": [ [ { "node": "nampilin chat - select from postgres", "type": "main", "index": 0 } ] ] },
    "nampilin chat - select from postgres": { "main": [ [ { "node": "nampilin chat - respond", "type": "main", "index": 0 } ] ] }
  }
}
```

Catatan penting:
- Path webhook wajib `crm-messages` dan method GET.
- `responseMode` di webhook: `responseNode`; node Respond mengirim data dari query.
- Header CORS dibikin konsisten di Webhook dan Respond: `Access-Control-Allow-Origin: https://monitorcs.vercel.app`, Methods `GET`, Headers `Content-Type`.
- Query params: `session`, `limit` (dibatasi 1–2000; default 500).
- Frontend memanggil: `GET {NEXT_PUBLIC_CRM_API_BASE}?session=<id>&limit=500` dengan env di Vercel diisi URL webhook penuh, mis. `https://projek-n8n-n8n.qk6yxt.easypanel.host/webhook/crm-messages`.
