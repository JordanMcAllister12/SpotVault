import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface StaffAccount {
  user_id: string;
  email: string;
  display_name: string;
  username: string;
  role: string;
  status: string;
  created_at: string;
  last_sign_in_at: string | null;
  primary_role: string;
  poker_role: string;
  membership_tier: string;
  profile_complete?: boolean;
  sv_user_id?: string | null;
}

export type SortMode = 'newest' | 'oldest' | 'alpha_az' | 'alpha_za';

export interface StaffTraffic {
  today: number;
  last_7_days: number;
  last_30_days: number;
  total: number;
  page_views_today: number;
  page_views_total: number;
  authenticated_today: number;
  daily: Array<{ date: string; visits: number }>;
  weekly: Array<{ week_start: string; visits: number }>;
  monthly: Array<{ month: string; visits: number }>;
}

export interface StaffAccountResult {
  accounts: StaffAccount[];
  totalCount: number;
  loading: boolean;
  error: string | null;
  search: (term: string) => void;
  sort: (mode: SortMode) => void;
  page: (offset: number) => void;
  refresh: () => void;
  currentPage: number;
  pageSize: number;
  currentSearch: string;
  currentSort: SortMode;
}

const PAGE_SIZE = 50;

export function useStaffAccounts(): StaffAccountResult {
  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [offset, setOffset] = useState(0);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshData.session) {
          console.error('[StaffAccounts] Session refresh failed:', refreshError?.message);
          setError('SESSION INVALID');
          setLoading(false);
          return;
        }
        session = refreshData.session;
      }

      const listResult = await supabase.rpc('sv_staff_get_accounts', {
        p_search: searchTerm || null,
        p_sort: sortMode,
        p_limit: PAGE_SIZE,
        p_offset: offset,
      });

      if (listResult.error) {
        console.error('[StaffAccounts] sv_staff_get_accounts error:', {
          code: listResult.error.code,
          message: listResult.error.message,
          details: listResult.error.details,
          hint: listResult.error.hint,
        });
        if (listResult.error.message.includes('Permission denied')) {
          setError('PERMISSION DENIED');
        } else {
          setError(`ACCOUNT DIRECTORY ERROR: ${listResult.error.message}`);
        }
        setLoading(false);
        return;
      }

      const list = (listResult.data as unknown as StaffAccount[]) ?? [];
      setAccounts(list);
      setTotalCount(list.length);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'UNKNOWN ERROR';
      console.error('[StaffAccounts] Fetch failed:', msg);
      setError(`NETWORK ERROR: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, sortMode, offset]);

  useEffect(() => { void fetch(); }, [fetch]);

  return {
    accounts,
    totalCount,
    loading,
    error,
    search: (term: string) => { setSearchTerm(term); setOffset(0); },
    sort: (mode: SortMode) => { setSortMode(mode); setOffset(0); },
    page: (newOffset: number) => setOffset(Math.max(0, newOffset)),
    refresh: () => { void fetch(); },
    currentPage: Math.floor(offset / PAGE_SIZE),
    pageSize: PAGE_SIZE,
    currentSearch: searchTerm,
    currentSort: sortMode,
  };
}

export function useStaffTraffic() {
  const [traffic, setTraffic] = useState<StaffTraffic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshData.session) {
          setError('SESSION INVALID');
          setLoading(false);
          return;
        }
        session = refreshData.session;
      }

      const { data, error: rpcError } = await supabase.rpc('sv_staff_get_traffic');
      if (rpcError) {
        console.error('[StaffTraffic] sv_staff_get_traffic error:', rpcError.code, rpcError.message);
        throw rpcError;
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        setTraffic({ today: 0, last_7_days: 0, last_30_days: 0, total: 0, daily: [], weekly: [], monthly: [] });
        return;
      }

      const parseArr = (raw: unknown): Array<{ date?: string; week_start?: string; month?: string; visits: number }> => {
        if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return []; } }
        return Array.isArray(raw) ? raw : [];
      };

      setTraffic({
        today: Number(row.today) || 0,
        last_7_days: Number(row.last_7_days) || 0,
        last_30_days: Number(row.last_30_days) || 0,
        total: Number(row.total) || 0,
        page_views_today: Number(row.page_views_today) || 0,
        page_views_total: Number(row.page_views_total) || 0,
        authenticated_today: Number(row.authenticated_today) || 0,
        daily: parseArr(row.daily),
        weekly: parseArr(row.weekly),
        monthly: parseArr(row.monthly),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load traffic';
      console.error('[StaffTraffic] Fetch failed:', msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetch(); }, [fetch]);

  return { traffic, loading, error, refresh: () => { void fetch(); } };
}

// ============================================================
// LOGIN ACTIVITY
// ============================================================

export interface LoginActivityRow {
  user_id: string;
  email: string;
  display_name: string;
  role: string;
  login_count: number;
  first_login: string;
  latest_login: string;
  portal: string | null;
  device_type: string | null;
}

export interface LoginCounts {
  authenticated_users: number;
  total_login_events: number;
}

export type LoginPeriod = 'today' | 'yesterday' | '7days' | '30days';

export function useLoginActivity() {
  const [rows, setRows] = useState<LoginActivityRow[]>([]);
  const [counts, setCounts] = useState<LoginCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<LoginPeriod>('today');

  const fetch = useCallback(async (p: LoginPeriod) => {
    setLoading(true);
    setError(null);
    try {
      const [activityRes, countsRes] = await Promise.all([
        supabase.rpc('sv_staff_get_login_activity', { p_period: p }),
        supabase.rpc('sv_staff_get_login_counts', { p_period: p }),
      ]);

      if (activityRes.error) {
        if (activityRes.error.message.includes('Permission denied')) {
          setError('PERMISSION DENIED');
        } else {
          setError(`LOGIN ACTIVITY ERROR: ${activityRes.error.message}`);
        }
        setLoading(false);
        return;
      }

      setRows((activityRes.data as unknown as LoginActivityRow[]) ?? []);

      if (countsRes.error) {
        console.error('[LoginActivity] counts error:', countsRes.error.message);
        setCounts(null);
      } else {
        const c = Array.isArray(countsRes.data) ? countsRes.data[0] : countsRes.data;
        setCounts(c ? { authenticated_users: Number(c.authenticated_users) || 0, total_login_events: Number(c.total_login_events) || 0 } : null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'UNKNOWN ERROR';
      console.error('[LoginActivity] Fetch failed:', msg);
      setError(`NETWORK ERROR: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetch(period); }, [period, fetch]);

  return { rows, counts, loading, error, period, setPeriod, refresh: () => void fetch(period) };
}
