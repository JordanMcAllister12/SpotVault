import { supabase } from '@/lib/supabase';

const SESSION_KEY = 'sv_visit_session';
const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const PRODUCTION_DOMAINS = ['thespotvault.com', 'www.thespotvault.com'];

function isProductionDomain(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return PRODUCTION_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

function getOrCreateSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as { id: string; ts: number };
      if (Date.now() - parsed.ts < SESSION_DURATION_MS) {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: parsed.id, ts: Date.now() }));
        return parsed.id;
      }
    }
  } catch {
    // sessionStorage not available
  }
  return null;
}

function createNewSession(): string {
  const id = crypto.randomUUID();
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id, ts: Date.now() }));
  } catch {
    // ignore
  }
  return id;
}

let hasRecordedThisSession = false;

/**
 * Record a single visit for the current browsing session.
 * Only fires once per 30-minute session, only on the production domain.
 * Does not count dev/preview/local traffic.
 */
export async function recordVisit(): Promise<void> {
  if (hasRecordedThisSession) return;
  if (!isProductionDomain()) return;

  let sessionId = getOrCreateSessionId();
  if (sessionId) {
    // Existing session — already recorded or within session window
    hasRecordedThisSession = true;
    return;
  }

  sessionId = createNewSession();
  hasRecordedThisSession = true;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from('page_views').insert({
      path: window.location.pathname,
      visitor_id: sessionId,
      is_authenticated: !!session,
      user_agent: navigator.userAgent,
      referrer: document.referrer || null,
    });
  } catch {
    // Non-critical — don't disrupt the user experience
  }
}
