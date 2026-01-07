'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * KISS CRM Chat UI (focus: messages only)
 * Env: NEXT_PUBLIC_CRM_API_BASE="https://projek-n8n-n8n.qk6yxt.easypanel.host/webhook"
 * Contract: GET {BASE}/crm-messages?session=<SESSION_ID>&limit=500
 * No custom headers, GET only (hindari preflight).
 */

type ChatMessage = {
  msg_id: string;
  ts: string; // ISO
  role: 'individual' | 'me' | string;
  push_name?: string;
  body_text?: string;
};

const ENDPOINT_BASE = (process.env.NEXT_PUBLIC_CRM_API_BASE || '').replace(/\/$/, '');

function fmtTime(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('id-ID', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

export default function Page() {
  const [sessionId, setSessionId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const filteredMessages = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => (m.body_text || '').toLowerCase().includes(q));
  }, [messages, search]);

  const finalUrlDisplay = ENDPOINT_BASE
    ? sessionId
      ? `${ENDPOINT_BASE}?session=${encodeURIComponent(sessionId)}&limit=500`
      : ENDPOINT_BASE
    : '(unset base)';

  const fetchMessages = useCallback(async (session: string) => {
    if (!ENDPOINT_BASE) {
      setMessagesError('NEXT_PUBLIC_CRM_API_BASE belum diset.');
      return;
    }
    setMessagesLoading(true);
    setMessagesError(null);
    try {
      const url = new URL(ENDPOINT_BASE);
      if (session) {
        url.searchParams.set('session', session);
        url.searchParams.set('limit', '500');
      }
      const finalUrl = url.toString();
      // Debug deliverable: log URL yang dipanggil
      console.log('fetch messages ->', finalUrl);
      const res = await fetch(finalUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error(`messages HTTP ${res.status}`);
      const data = (await res.json()) as ChatMessage[];
      const safe = Array.isArray(data) ? data : [];
      // sort just in case
      safe.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
      setMessages(safe);
      // scroll to bottom
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal load messages';
      setMessagesError(message);
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMessages(sessionId);
  }, [fetchMessages, sessionId]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-xl font-semibold tracking-tight">CRM CS (KISS)</div>
            <div className="text-sm text-neutral-400">
              Backend: n8n webhook | UI: Vercel | Data: Postgres
            </div>
          </div>
          <div className="flex items-center gap-2">
              <div className="hidden text-xs text-neutral-500 md:block">
                API: {ENDPOINT_BASE || '(unset)'}
              </div>
          </div>
        </header>

        {/* Main (messages-only) */}
        <main className="rounded-2xl border border-neutral-800 bg-neutral-900/40">
          <div className="border-b border-neutral-800 p-4 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <input
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                placeholder="Session ID (opsional)"
                className="w-full max-w-sm rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm font-mono outline-none focus:border-neutral-600"
              />
              <button
                onClick={() => fetchMessages(sessionId)}
                className="rounded-xl bg-neutral-800 px-3 py-2 text-sm hover:bg-neutral-700"
              >
                Reload (GET)
              </button>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter text"
                className="w-full max-w-xs rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-600"
              />
            </div>
            <div className="text-xs text-neutral-500">
              Endpoint: {finalUrlDisplay}
            </div>
            <div className="text-xs text-neutral-500">
              Refresh = GET {ENDPOINT_BASE || '(unset base)'}
            </div>
            <div className="text-xs text-neutral-500">
              Session optional: kalau kosong, fetch langsung ke URL env (mirip curl -i).
            </div>
          </div>

          <div className="h-[75vh] overflow-y-auto p-4">
            {messagesError ? (
              <div className="rounded-xl border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-200">
                <div className="font-medium">Messages tidak bisa diload</div>
                <div className="mt-1 text-red-300/90">{messagesError}</div>
              </div>
            ) : null}

            {messagesLoading ? (
              <div className="text-sm text-neutral-400">Loading messages...</div>
            ) : filteredMessages.length ? (
              <div className="space-y-2">
                {filteredMessages.map((m) => {
                  const mine = m.role === 'me';
                  return (
                    <div key={m.msg_id} className={cls('flex', mine ? 'justify-end' : 'justify-start')}>
                      <div
                        className={cls(
                          'max-w-[85%] rounded-2xl border px-3 py-2',
                          mine
                            ? 'border-neutral-700 bg-neutral-800'
                            : 'border-neutral-800 bg-neutral-950'
                        )}
                      >
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <div className="text-xs text-neutral-400">
                            {mine ? 'Me' : m.push_name || 'Individual'}
                          </div>
                          <div className="text-xs text-neutral-500">{fmtTime(m.ts)}</div>
                        </div>
                        <div className="whitespace-pre-wrap break-words text-sm">
                          {m.body_text || <span className="text-neutral-500">(empty)</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            ) : (
              <div className="text-sm text-neutral-400">Belum ada message untuk session ini.</div>
            )}
          </div>

          <div className="border-t border-neutral-800 p-4 text-xs text-neutral-500">
            Fokus messages-only. Pastikan CORS di webhook mengizinkan origin ini.
          </div>
        </main>
      </div>
    </div>
  );
}
