import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const REMEMBER_ME_KEY = 'spotvault-remember-me';

export function setRememberMe(enabled: boolean): void {
  try {
    if (enabled) {
      window.localStorage.setItem(REMEMBER_ME_KEY, 'true');
    } else {
      window.localStorage.removeItem(REMEMBER_ME_KEY);
    }
  } catch { /* ignore */ }
}

export function isRememberMeEnabled(): boolean {
  try {
    return window.localStorage.getItem(REMEMBER_ME_KEY) === 'true';
  } catch {
    return false;
  }
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'spotvault-auth',
    flowType: 'implicit',
    detectSessionInUrl: true,
  },
});
