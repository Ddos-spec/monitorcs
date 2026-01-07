'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * KISS CRM Chat UI
 * - Drop this into: app/page.tsx (Next.js App Router)
 * - Set env in Vercel:
 *   NEXT_PUBLIC_CRM_API_BASE="https://YOUR-N8N-DOMAIN/webhook/crm"
 *
 * Expected backend (n8n) endpoints:
 *   GET  {BASE}/sessions
 *     -> [{ session, lastTs, pushName, fromJid }]
 *   GET  {BASE}/messages?session=...&limit=500
 *     -> [{ msg_id, ts, role, push_name, body_text }]
 */

type SessionItem = {
  session: string;
  lastTs?: string; // ISO
  pushName?: string;
  fromJid?: string;
};

type ChatMessage = {
  msg_id: string;
  ts: string; // ISO
  role: 'individual' | 'me' | string;
  push_name?: string;
  body_text?: string;
};

const API_BASE = (process.env.NEXT_PUBLIC_CRM_API_BASE || '').replace(/\/$/, '');

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
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  const [selectedSession, setSelectedSession] = useState<string>('');
  const [sessionQuery, setSessionQuery] = useState('');

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const filteredSessions = useMemo(() => {
    const q = sessionQuery.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => {
      return (
        s.session.toLowerCase().includes(q) ||
        (s.pushName || '').toLowerCase().includes(q) ||
        (s.fromJid || '').toLowerCase().includes(q)
      );
    });
  }, [sessions, sessionQuery]);

  const filteredMessages = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => (m.body_text || '').toLowerCase().includes(q));
  }, [messages, search]);

  const fetchSessions = useCallback(async () => {
    if (!API_BASE) {
      setSessionsError('NEXT_PUBLIC_CRM_API_BASE belum diset.');
      return;
    }
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const res = await fetch(`${API_BASE}/sessions`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`sessions HTTP ${res.status}`);
      const data = (await res.json()) as SessionItem[];
      const list = Array.isArray(data) ? data : [];
      setSessions(list);
      setSelectedSession((prev) => {
        if (prev || !list.length) return prev;
        return list[0].session;
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal load sessions';
      setSessionsError(message);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  async function fetchMessages(session: string) {
    if (!API_BASE) {
      setMessagesError('NEXT_PUBLIC_CRM_API_BASE belum diset.');
      return;
    }
    if (!session) return;
    setMessagesLoading(true);
    setMessagesError(null);
    try {
      const url = new URL(`${API_BASE}/messages`);
      url.searchParams.set('session', session);
      url.searchParams.set('limit', '500');
      const res = await fetch(url.toString(), { cache: 'no-store' });
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
  }

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    if (selectedSession) fetchMessages(selectedSession);
  }, [selectedSession]);

  const selectedMeta = useMemo(() => sessions.find((s) => s.session === selectedSession), [sessions, selectedSession]);

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
            <button
              onClick={fetchSessions}
              className="rounded-xl bg-neutral-800 px-3 py-2 text-sm hover:bg-neutral-700"
              title="Refresh sessions"
            >
              Refresh
            </button>
            <div className="hidden text-xs text-neutral-500 md:block">
              API: {API_BASE || '(unset)'}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[360px_1fr]">
          {/* Sidebar */}
          <aside className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3">
            <div className="mb-3 flex items-center gap-2">
              <input
                value={sessionQuery}
                onChange={(e) => setSessionQuery(e.target.value)}
                placeholder="Cari session / nama / nomor"
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-600"
              />
            </div>

            {sessionsError ? (
              <div className="rounded-xl border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-200">
                <div className="font-medium">Sessions tidak bisa diload</div>
                <div className="mt-1 text-red-300/90">{sessionsError}</div>
                <div className="mt-3 text-neutral-200">
                  KISS fallback: masukkan <span className="font-mono">session</span> manual.
                </div>
              </div>
            ) : null}

            <div className="mt-3 space-y-2">
              {sessionsLoading ? (
                <div className="text-sm text-neutral-400">Loading sessions...</div>
              ) : filteredSessions.length ? (
                filteredSessions.map((s) => {
                  const active = s.session === selectedSession;
                  return (
                    <button
                      key={s.session}
                      onClick={() => setSelectedSession(s.session)}
                      className={cls(
                        'w-full rounded-2xl border p-3 text-left transition',
                        active
                          ? 'border-neutral-600 bg-neutral-800/60'
                          : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">
                            {s.pushName || '(no name)'}
                          </div>
                          <div className="truncate text-xs text-neutral-400">{s.fromJid || s.session}</div>
                        </div>
                        <div className="shrink-0 text-xs text-neutral-500">{fmtTime(s.lastTs)}</div>
                      </div>
                      <div className="mt-2 truncate font-mono text-[11px] text-neutral-500">{s.session}</div>
                    </button>
                  );
                })
              ) : (
                <div className="text-sm text-neutral-400">Belum ada session.</div>
              )}
            </div>

            <div className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-950 p-3">
              <div className="text-xs text-neutral-400">Manual open session</div>
              <div className="mt-2 flex gap-2">
                <input
                  value={selectedSession}
                  onChange={(e) => setSelectedSession(e.target.value)}
                  placeholder="paste session id"
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm font-mono outline-none focus:border-neutral-600"
                />
                <button
                  onClick={() => fetchMessages(selectedSession)}
                  className="rounded-xl bg-neutral-800 px-3 py-2 text-sm hover:bg-neutral-700"
                >
                  Open
                </button>
              </div>
            </div>
          </aside>

          {/* Main */}
          <main className="rounded-2xl border border-neutral-800 bg-neutral-900/40">
            <div className="border-b border-neutral-800 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-base font-semibold">
                    {selectedMeta?.pushName || 'Pilih session'}
                  </div>
                  <div className="mt-0.5 text-sm text-neutral-400">
                    {selectedMeta?.fromJid || selectedSession || '-'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search text"
                    className="w-56 rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-600"
                  />
                  <button
                    onClick={() => fetchMessages(selectedSession)}
                    className="rounded-xl bg-neutral-800 px-3 py-2 text-sm hover:bg-neutral-700"
                  >
                    Reload
                  </button>
                </div>
              </div>
            </div>

            <div className="h-[70vh] overflow-y-auto p-4">
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
              UI ini hanya viewer. Kalau mau bisa reply dari UI, kamu bikin endpoint n8n:
              <span className="ml-1 font-mono">POST {API_BASE || '{BASE}'}/send</span>.
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
