'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * WhatsApp-like CRM Chat UI
 * - Sidebar kiri: daftar kontak/session
 * - Kanan: chat messages
 * - Read-only (no input)
 * - Light/Dark theme toggle
 */

type ChatMessage = {
  msg_id: string;
  ts: string; // ISO
  role: 'individual' | 'me' | string;
  push_name?: string;
  body_text?: string;
  session: string;
  from_jid?: string;
};

type SessionContact = {
  session: string;
  push_name: string;
  last_message: string;
  last_ts: string;
  unread_count: number;
};

type Theme = 'light' | 'dark';

const ENDPOINT_BASE = (process.env.NEXT_PUBLIC_CRM_API_BASE || '').replace(/\/$/, '');

function fmtTime(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function fmtDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return 'Hari ini';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Kemarin';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(d);
}

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

export default function Page() {
  const [allMessages, setAllMessages] = useState<ChatMessage[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [theme, setTheme] = useState<Theme>('dark');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Theme colors
  const colors = useMemo(() => {
    if (theme === 'light') {
      return {
        bg: 'bg-gray-50',
        bgSidebar: 'bg-white',
        bgHeader: 'bg-white',
        bgChat: 'bg-gray-50',
        border: 'border-gray-200',
        text: 'text-gray-900',
        textMuted: 'text-gray-500',
        textSubtle: 'text-gray-400',
        hover: 'hover:bg-gray-100',
        active: 'bg-gray-100',
        input: 'bg-white border-gray-300',
        inputFocus: 'focus:border-gray-400',
        bubbleMe: 'bg-emerald-600 text-white',
        bubbleOther: 'bg-white border border-gray-200 text-gray-900',
        bubbleTimeMe: 'text-emerald-100',
        bubbleTimeOther: 'text-gray-400',
        bubbleName: 'text-emerald-600',
        error: 'bg-red-50 border-red-200 text-red-800',
        errorText: 'text-red-600',
        avatar: 'bg-gray-300 text-gray-700',
      };
    }
    return {
      bg: 'bg-neutral-950',
      bgSidebar: 'bg-neutral-900',
      bgHeader: 'bg-neutral-900',
      bgChat: 'bg-neutral-950',
      border: 'border-neutral-800',
      text: 'text-neutral-100',
      textMuted: 'text-neutral-400',
      textSubtle: 'text-neutral-500',
      hover: 'hover:bg-neutral-800/50',
      active: 'bg-neutral-800',
      input: 'bg-neutral-950 border-neutral-800',
      inputFocus: 'focus:border-neutral-600',
      bubbleMe: 'bg-emerald-700 text-white',
      bubbleOther: 'bg-neutral-800 text-neutral-100',
      bubbleTimeMe: 'text-emerald-200',
      bubbleTimeOther: 'text-neutral-500',
      bubbleName: 'text-emerald-400',
      error: 'bg-red-950/30 border-red-900/60 text-red-200',
      errorText: 'text-red-300/90',
      avatar: 'bg-neutral-700 text-white',
    };
  }, [theme]);

  // Group messages by session untuk bikin contact list
  const sessions = useMemo<SessionContact[]>(() => {
    const grouped = new Map<string, ChatMessage[]>();
    allMessages.forEach((msg: ChatMessage) => {
      if (!grouped.has(msg.session)) {
        grouped.set(msg.session, []);
      }
      grouped.get(msg.session)!.push(msg);
    });

    const result: SessionContact[] = [];
    grouped.forEach((msgs, session) => {
      const sortedMsgs = [...msgs].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
      const lastMsg = sortedMsgs[0];
      const individualMsg = msgs.find((m) => m.role === 'individual');

      result.push({
        session,
        push_name: individualMsg?.push_name || session.substring(0, 12),
        last_message: lastMsg?.body_text || '(no message)',
        last_ts: lastMsg?.ts || '',
        unread_count: 0, // bisa di-extend nanti
      });
    });

    // Sort by last message time
    result.sort((a, b) => new Date(b.last_ts).getTime() - new Date(a.last_ts).getTime());
    return result;
  }, [allMessages]);

  // Filter contact list by search
  const filteredSessions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter(
      (s: SessionContact) =>
        s.push_name.toLowerCase().includes(q) ||
        s.last_message.toLowerCase().includes(q) ||
        s.session.includes(q)
    );
  }, [sessions, search]);

  // Messages untuk session yang dipilih
  const currentMessages = useMemo(() => {
    if (!selectedSession) return [];
    return allMessages
      .filter((m: ChatMessage) => m.session === selectedSession)
      .sort((a: ChatMessage, b: ChatMessage) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  }, [allMessages, selectedSession]);

  // Fetch all messages on mount
  const fetchAllMessages = useCallback(async () => {
    if (!ENDPOINT_BASE) {
      setError('NEXT_PUBLIC_CRM_API_BASE belum diset.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const url = new URL(ENDPOINT_BASE);
      url.searchParams.set('limit', '1000');
      const finalUrl = url.toString();
      console.log('fetch all messages ->', finalUrl);
      const res = await fetch(finalUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error(`messages HTTP ${res.status}`);
      const data = (await res.json()) as ChatMessage[];
      const safe = Array.isArray(data) ? data : [];
      setAllMessages(safe);
      // Auto select first session
      if (safe.length > 0 && !selectedSession) {
        setSelectedSession(safe[0].session);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal load messages';
      setError(message);
      setAllMessages([]);
    } finally {
      setLoading(false);
    }
  }, [selectedSession]);

  useEffect(() => {
    void fetchAllMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Scroll to bottom when messages change
    if (currentMessages.length > 0) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [currentMessages]);

  const selectedContact = sessions.find((s: SessionContact) => s.session === selectedSession);

  return (
    <div className={cls('flex h-screen', colors.bg, colors.text)}>
      {/* Sidebar Kiri - Contact List */}
      <div className={cls('flex w-full max-w-md flex-col border-r', colors.border, colors.bgSidebar)}>
        {/* Header Sidebar */}
        <div className={cls('border-b p-4', colors.border, colors.bgHeader)}>
          <div className="mb-3 flex items-center justify-between">
            <h1 className="text-xl font-semibold">MonitorCS</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className={cls('rounded-lg px-3 py-1.5 text-xs transition', theme === 'dark' ? 'bg-neutral-800 hover:bg-neutral-700' : 'bg-gray-200 hover:bg-gray-300')}
                title="Toggle theme"
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
              <button
                onClick={() => fetchAllMessages()}
                className={cls('rounded-lg px-3 py-1.5 text-xs transition', theme === 'dark' ? 'bg-neutral-800 hover:bg-neutral-700' : 'bg-gray-200 hover:bg-gray-300')}
              >
                Refresh
              </button>
            </div>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            placeholder="Cari kontak atau pesan..."
            className={cls('w-full rounded-lg border px-3 py-2 text-sm outline-none', colors.input, colors.inputFocus)}
          />
        </div>

        {/* Contact List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className={cls('p-4 text-center text-sm', colors.textMuted)}>Loading...</div>
          ) : error ? (
            <div className={cls('m-4 rounded-lg border p-3 text-sm', colors.error)}>
              <div className="font-medium">Error</div>
              <div className={cls('mt-1', colors.errorText)}>{error}</div>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className={cls('p-4 text-center text-sm', colors.textMuted)}>Belum ada chat</div>
          ) : (
            filteredSessions.map((contact: SessionContact) => (
              <button
                key={contact.session}
                onClick={() => setSelectedSession(contact.session)}
                className={cls(
                  'w-full border-b p-4 text-left transition',
                  colors.border,
                  colors.hover,
                  selectedSession === contact.session && colors.active
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className={cls('flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-semibold', colors.avatar)}>
                    {contact.push_name.charAt(0).toUpperCase()}
                  </div>
                  {/* Content */}
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="truncate font-medium">{contact.push_name}</div>
                      <div className={cls('text-xs', colors.textSubtle)}>{fmtDate(contact.last_ts)}</div>
                    </div>
                    <div className={cls('mt-1 truncate text-sm', colors.textMuted)}>{contact.last_message}</div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Area Chat Kanan */}
      <div className={cls('flex flex-1 flex-col', colors.bgChat)}>
        {selectedSession && selectedContact ? (
          <>
            {/* Header Chat */}
            <div className={cls('border-b p-4', colors.border, colors.bgHeader)}>
              <div className="flex items-center gap-3">
                <div className={cls('flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-semibold', colors.avatar)}>
                  {selectedContact.push_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{selectedContact.push_name}</div>
                  <div className={cls('text-xs', colors.textSubtle)}>{selectedContact.session}</div>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className={cls('flex-1 overflow-y-auto p-4', colors.bgChat)}>
              {currentMessages.length === 0 ? (
                <div className={cls('flex h-full items-center justify-center text-sm', colors.textMuted)}>
                  Belum ada pesan
                </div>
              ) : (
                <div className="space-y-3">
                  {currentMessages.map((m: ChatMessage) => {
                    const mine = m.role === 'me';
                    return (
                      <div key={m.msg_id} className={cls('flex', mine ? 'justify-end' : 'justify-start')}>
                        <div className={cls('max-w-[70%] rounded-lg px-3 py-2', mine ? colors.bubbleMe : colors.bubbleOther)}>
                          {!mine && (
                            <div className={cls('mb-1 text-xs font-medium', colors.bubbleName)}>
                              {m.push_name || 'Customer'}
                            </div>
                          )}
                          <div className="whitespace-pre-wrap text-sm break-words">
                            {m.body_text || <span className={colors.textMuted}>(empty)</span>}
                          </div>
                          <div className={cls('mt-1 text-right text-xs', mine ? colors.bubbleTimeMe : colors.bubbleTimeOther)}>
                            {fmtTime(m.ts)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            {/* Footer (Read-only notice) */}
            <div className={cls('border-t p-3 text-center', colors.border, colors.bgHeader)}>
              <div className={cls('text-xs', colors.textSubtle)}>
                Read-only mode - Tidak bisa kirim pesan
              </div>
            </div>
          </>
        ) : (
          <div className={cls('flex h-full items-center justify-center', colors.textMuted)}>
            <div className="text-center">
              <div className="mb-2 text-4xl">💬</div>
              <div className="text-lg font-medium">MonitorCS</div>
              <div className="mt-1 text-sm">Pilih kontak untuk melihat chat</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
