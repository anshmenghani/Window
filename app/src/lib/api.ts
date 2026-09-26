import { supabase } from './supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');

export async function api<T>(path: string, body?: unknown): Promise<T> {
  if (!API_URL) throw new Error('The AI server URL is not configured yet.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Please sign in again.');
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('Could not reach the Window server. Check your connection and try again.');
  }
  if (!response.ok) {
    let message = 'Something went wrong. Please try again.';
    try {
      const payload = await response.json();
      if (typeof payload.detail === 'string') message = payload.detail;
    } catch { /* keep the readable fallback */ }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}
