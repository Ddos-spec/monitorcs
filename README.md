## MonitorCS (Next.js + Tailwind)

UI viewer CRM CS. Butuh backend n8n dengan endpoint:
- `GET {BASE}/sessions`
- `GET {BASE}/messages?session=...&limit=500`

Env wajib:
- `NEXT_PUBLIC_CRM_API_BASE` → contoh `https://YOUR-N8N-DOMAIN/webhook/crm` (lihat `.env.example`)

## Jalankan lokal
```bash
npm install
copy .env.example .env.local   # isi nilai BASE
npm run dev
# buka http://localhost:3000
```

## Build / preview
```bash
npm run build
npm start
```

## Deploy Vercel
```bash
npx vercel login             # jika belum login
npx vercel link --project monitorcs   # pilih/buat project
npx vercel env pull .env.local        # opsional tarik env
npx vercel --prod
```
