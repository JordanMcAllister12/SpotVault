import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Lock, Check, X, Loader2, Eye, EyeOff } from 'lucide-react';
import { changePassword } from '@/lib/securityEngine';
import { sendSecurityNotification } from '@/lib/mfaAuth';
import { logSecurityEvent } from '@/lib/securityEngine';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212,165,44,0.18)';

function StatusBadge({ status, label }: { status: 'ok' | 'warn' | 'off'; label: string }) {
  const colors = {
    ok: { bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.3)', text: '#4ade80', icon: Check },
    warn: { bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.3)', text: '#fbbf24', icon: X },
    off: { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)', text: 'rgba(255,255,255,0.35)', icon: X },
  };
  const c = colors[status];
  const Icon = c.icon;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[9px] font-bold tracking-widest uppercase" style={{ borderColor: c.border, background: c.bg, color: c.text }}>
      <Icon className="h-2.5 w-2.5" strokeWidth={2.5} /> {label}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold tracking-widest text-white/90 uppercase">{label}</label>
      {children}
    </div>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border p-5" style={{ borderColor: BORDER, background: 'rgba(8,10,12,0.95)' }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold tracking-widest text-white/90 uppercase">{title}</h3>
          <button onClick={onClose} className="text-white/85 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function PasswordSection({ email, onReload }: { email: string | null; onReload?: () => void }) {
  const [modal, setModal] = useState(false);
  const [current, setCurrent] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    setError('');
    if (newPwd.length < 10) { setError('Password must be at least 10 characters.'); return; }
    if (newPwd !== confirm) { setError('Passwords do not match.'); return; }
    setSaving(true);
    const result = await changePassword(current, newPwd);
    setSaving(false);
    if (!result.ok) { setError(result.error || 'Failed to change password.'); return; }
    if (email) await sendSecurityNotification('password_changed', email);
    await logSecurityEvent('password_changed');
    setSuccess(true);
    setModal(false);
    setCurrent(''); setNewPwd(''); setConfirm('');
    onReload?.();
  };

  return (
    <div className="rounded-xl border p-4 md:p-5" style={{ borderColor: BORDER, background: 'rgba(8,10,12,0.75)', backdropFilter: 'blur(8px)' }}>
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg border" style={{ borderColor: 'rgba(212,165,44,0.2)', background: 'rgba(212,165,44,0.06)' }}>
          <Lock className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} />
        </span>
        <h3 className="text-[11px] font-bold tracking-widest text-white/85 uppercase">Password</h3>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/85">••••••••••</span>
            <StatusBadge status="ok" label="Protected" />
          </div>
          <p className="mt-1 text-[10px] text-white/85">Your password is managed securely by our authentication provider.</p>
        </div>
        <button onClick={() => setModal(true)} className="rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-[10px] font-semibold tracking-widest text-white/90 uppercase transition-colors hover:text-white">
          Change Password
        </button>
      </div>
      {success && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
          <Check className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2} />
          <span className="text-[11px] text-emerald-300">Password changed successfully.</span>
        </div>
      )}
      {modal && (
        <ModalShell title="Change Password" onClose={() => { setModal(false); setError(''); }}>
          <div className="space-y-3">
            <Field label="Current Password">
              <input type={show ? 'text' : 'password'} value={current} onChange={e => setCurrent(e.target.value)} placeholder="Enter current password" className="auth-input" />
            </Field>
            <Field label="New Password">
              <div className="relative">
                <input type={show ? 'text' : 'password'} value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="At least 10 characters" className="auth-input pr-9" />
                <button onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/85 hover:text-white/90">
                  {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </Field>
            <Field label="Confirm New Password">
              <input type={show ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Re-enter new password" className="auth-input" />
            </Field>
            {error && <p className="text-[10px] font-mono tracking-widest text-red-400 uppercase">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setModal(false); setError(''); }} className="flex-1 rounded-lg border border-white/10 bg-white/5 py-3 text-[10px] font-semibold tracking-widest text-white/90 uppercase hover:text-white">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-3 text-[10px] font-semibold tracking-widest uppercase disabled:opacity-50" style={{ borderColor: GOLD + '60', background: GOLD + '15', color: GOLD_SOFT }}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Change
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
