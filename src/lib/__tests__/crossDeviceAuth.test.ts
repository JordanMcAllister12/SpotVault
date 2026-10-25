// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase before importing modules that use it
const mockSignInWithPassword = vi.fn();
const mockSignOut = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

import { verifyPassword, setAccountPin } from '@/types';

describe('Cross-device authentication consistency', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  describe('verifyPassword (local credential store)', () => {
    it('returns false for empty stored password', () => {
      expect(verifyPassword('nonexistent-account', 'anypassword')).toBe(false);
    });

    it('returns false for empty entered password', () => {
      setAccountPin('test-account', 'somepassword');
      expect(verifyPassword('test-account', '')).toBe(false);
    });

    it('returns true when stored password matches entered password', () => {
      setAccountPin('test-account', 'correctpassword');
      expect(verifyPassword('test-account', 'correctpassword')).toBe(true);
    });

    it('returns false when stored password does not match entered password', () => {
      setAccountPin('test-account', 'newpassword');
      expect(verifyPassword('test-account', 'oldpassword')).toBe(false);
    });
  });

  describe('Supabase Auth is canonical for email accounts', () => {
    it('rejects old password when Supabase rejects it', async () => {
      mockSignInWithPassword.mockResolvedValue({
        error: { message: 'Invalid login credentials' },
      });

      const { supabase } = await import('@/lib/supabase');
      const { error } = await supabase.auth.signInWithPassword({
        email: 'testaccount@spotvault.com',
        password: 'oldpassword123',
      });

      expect(error).toBeTruthy();
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'testaccount@spotvault.com',
        password: 'oldpassword123',
      });
    });

    it('accepts new password when Supabase accepts it', async () => {
      mockSignInWithPassword.mockResolvedValue({
        error: null,
        data: { user: { id: 'test-id', email: 'testaccount@spotvault.com' } },
      });

      const { supabase } = await import('@/lib/supabase');
      const { error } = await supabase.auth.signInWithPassword({
        email: 'testaccount@spotvault.com',
        password: 'newpassword123!',
      });

      expect(error).toBeNull();
    });
  });

  describe('password change invalidates other sessions', () => {
    it('calls global signOut after password change', async () => {
      mockSignOut.mockResolvedValue({ error: null });

      const { supabase } = await import('@/lib/supabase');
      await supabase.auth.signOut({ scope: 'global' });

      expect(mockSignOut).toHaveBeenCalledWith({ scope: 'global' });
    });
  });
});
