import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHAT_THREADS_KEY, clearThread, loadThread, newId, saveThread } from '../src/services/chatThreads';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => { data.set(k, String(v)); },
    removeItem: (k: string) => { data.delete(k); },
  };
}

describe('saved conversations', () => {
  beforeEach(() => { vi.stubGlobal('localStorage', memoryStorage()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('keeps each thread separate and returns it after a reload', () => {
    saveThread('cfo', [{ id: 1, text: 'Hello' }]);
    saveThread('dashboard', [{ id: 2, text: 'Hi there' }]);
    expect(loadThread<{ id: number; text: string }>('cfo')).toEqual([{ id: 1, text: 'Hello' }]);
    expect(loadThread<{ id: number; text: string }>('dashboard')[0].text).toBe('Hi there');
    expect(loadThread('unknown')).toEqual([]);
  });

  it('keeps only the latest 60 messages in a thread', () => {
    saveThread('cfo', Array.from({ length: 250 }, (_, i) => ({ i })));
    const kept = loadThread<{ i: number }>('cfo');
    expect(kept).toHaveLength(60);
    expect(kept[0].i).toBe(190);
  });

  it('clears one thread without touching the others', () => {
    saveThread('cfo', [{ a: 1 }]);
    saveThread('voice', [{ b: 2 }]);
    clearThread('cfo');
    expect(loadThread('cfo')).toEqual([]);
    expect(loadThread('voice')).toEqual([{ b: 2 }]);
  });

  it('survives damaged storage without throwing', () => {
    localStorage.setItem(CHAT_THREADS_KEY, '{not json');
    expect(loadThread('cfo')).toEqual([]);
    saveThread('cfo', [{ ok: true }]);
    expect(loadThread('cfo')).toEqual([{ ok: true }]);
  });

  it('gives new message ids that do not repeat', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newId()));
    expect(ids.size).toBe(50);
  });
});
