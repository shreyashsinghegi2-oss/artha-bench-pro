import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

/**
 * Saved conversations. Every assistant keeps its questions and answers here, so a refresh or a return visit
 * shows the same conversation. The key is in the cloud sync list, so it follows the account to other devices.
 * The user clears a conversation with its own "New conversation" button.
 */
export const CHAT_THREADS_KEY = 'arthamind.chatThreads.v1';
const MAX_MESSAGES = 200;

type Threads = Record<string, unknown[]>;

function readAll(): Threads {
  try {
    const value = JSON.parse(localStorage.getItem(CHAT_THREADS_KEY) || '{}') as unknown;
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Threads) : {};
  } catch {
    return {};
  }
}

export function loadThread<T>(id: string): T[] {
  const list = readAll()[id];
  return Array.isArray(list) ? (list as T[]) : [];
}

export function saveThread<T>(id: string, messages: T[]): void {
  try {
    const all = readAll();
    all[id] = messages.slice(-MAX_MESSAGES);
    localStorage.setItem(CHAT_THREADS_KEY, JSON.stringify(all));
  } catch {
    /* storage full or blocked: the conversation still works for this visit */
  }
}

export function clearThread(id: string): void {
  try {
    const all = readAll();
    delete all[id];
    localStorage.setItem(CHAT_THREADS_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

let lastId = 0;

/** Unique, increasing ids. Time-based, so a new visit never clashes with messages saved on an earlier one. */
export function newId(): number {
  lastId = Math.max(lastId + 1, Date.now() * 1000);
  return lastId;
}

/** Saved history for this thread, or the opening messages when the thread is new. */
function startFor<T>(id: string, opening: T[]): T[] {
  const saved = loadThread<T>(id);
  return saved.length ? saved : opening;
}

/** A list of messages that is loaded from, and saved to, the thread with this id. */
export function usePersistedThread<T>(id: string, opening: T[] = []): [T[], Dispatch<SetStateAction<T[]>>] {
  const [items, setItems] = useState<T[]>(() => startFor(id, opening));
  const loadedFor = useRef(id);

  useEffect(() => {
    // Switching threads (for example, another page) loads that thread's own history.
    if (loadedFor.current !== id) {
      loadedFor.current = id;
      setItems(startFor(id, opening));
      return;
    }
    saveThread(id, items);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `opening` is only read when a thread starts.
  }, [id, items]);

  return [items, setItems];
}
