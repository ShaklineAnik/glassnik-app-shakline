import { useSyncExternalStore } from 'react';

// Tiny shared store: which feed videos are currently paused by the viewer.
const paused = new Set<string>();
const listeners = new Set<() => void>();

export function reportPaused(id: string, isPaused: boolean) {
  const has = paused.has(id);
  if (isPaused === has) return;
  if (isPaused) paused.add(id);
  else paused.delete(id);
  listeners.forEach((l) => l());
}

export function useVideoPaused(id: string | null | undefined): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => (id ? paused.has(id) : false),
    () => false
  );
}