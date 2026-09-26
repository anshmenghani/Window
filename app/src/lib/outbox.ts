// Capture starts sending in the background and jumps straight to the Sending screen.
// If the upload fails, this tiny store lets the Sending screen find out.
type Listener = (message: string) => void;

const errors = new Map<string, string>();
const listeners = new Map<string, Set<Listener>>();

export function reportSendError(windowId: string, message: string) {
  errors.set(windowId, message);
  listeners.get(windowId)?.forEach((l) => l(message));
}

export function onSendError(windowId: string, listener: Listener): () => void {
  const existing = errors.get(windowId);
  if (existing) listener(existing);
  if (!listeners.has(windowId)) listeners.set(windowId, new Set());
  listeners.get(windowId)!.add(listener);
  return () => listeners.get(windowId)?.delete(listener);
}
