import { useState } from 'react';
import { Bookmark, Check, Clock, Infinity as InfinityIcon, X, Loader2 } from 'lucide-react';
import { saveSpot, changeSaveDuration } from '@/lib/savedSpotsStore';

const GOLD = '#d4a52c';

export function SaveSpotModal({
  userId,
  spotId,
  spotTitle,
  isAlreadySaved,
  currentDuration,
  onSaved,
  onClose,
}: {
  userId: string;
  spotId: string;
  spotTitle: string;
  isAlreadySaved: boolean;
  currentDuration: '30days' | 'forever' | null;
  onSaved: (duration: '30days' | 'forever') => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<'30days' | 'forever'>(
    currentDuration || 'forever'
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    if (isAlreadySaved && currentDuration) {
      const ok = await changeSaveDuration(userId, spotId, selected);
      if (ok) {
        setSaved(true);
        onSaved(selected);
        setTimeout(onClose, 1200);
      }
    } else {
      const result = await saveSpot(userId, spotId, selected);
      if (result) {
        setSaved(true);
        onSaved(selected);
        setTimeout(onClose, 1200);
      }
    }
    setSaving(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border p-5 shadow-2xl"
        style={{
          background: '#0d0e10',
          borderColor: 'rgba(192,145,30,0.18)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">
            {isAlreadySaved ? 'Change Save Duration' : 'Save to My Spots'}
          </h3>
          <button onClick={onClose} className="text-white/30 transition hover:text-white/60">
            <X size={16} />
          </button>
        </div>
        <p className="mb-4 truncate text-[11px] text-white/40">{spotTitle}</p>

        {saved ? (
          <div className="flex flex-col items-center gap-2 py-6">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: 'rgba(74,222,128,0.12)' }}
            >
              <Check size={24} style={{ color: '#4ade80' }} strokeWidth={2} />
            </div>
            <p className="text-[13px] font-semibold text-white">Saved to My Spots</p>
          </div>
        ) : (
          <>
            <p className="mb-3 text-[11px] text-white/50">
              How long would you like to keep this in My Spots?
            </p>

            <div className="mb-4 flex flex-col gap-2">
              <button
                onClick={() => setSelected('30days')}
                className="flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all"
                style={{
                  borderColor:
                    selected === '30days'
                      ? 'rgba(192,145,30,0.4)'
                      : 'rgba(255,255,255,0.08)',
                  background:
                    selected === '30days'
                      ? 'rgba(192,145,30,0.06)'
                      : 'transparent',
                }}
              >
                <Clock
                  size={18}
                  style={{
                    color: selected === '30days' ? GOLD : '#6b7280',
                  }}
                  strokeWidth={1.5}
                />
                <div className="flex-1">
                  <p className="text-[12px] font-semibold text-white">30 Days</p>
                  <p className="text-[10px] text-white/40">
                    Auto-removes from My Spots after 30 days
                  </p>
                </div>
                {selected === '30days' && (
                  <Check size={16} style={{ color: GOLD }} />
                )}
              </button>

              <button
                onClick={() => setSelected('forever')}
                className="flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all"
                style={{
                  borderColor:
                    selected === 'forever'
                      ? 'rgba(192,145,30,0.4)'
                      : 'rgba(255,255,255,0.08)',
                  background:
                    selected === 'forever'
                      ? 'rgba(192,145,30,0.06)'
                      : 'transparent',
                }}
              >
                <InfinityIcon
                  size={18}
                  style={{
                    color: selected === 'forever' ? GOLD : '#6b7280',
                  }}
                  strokeWidth={1.5}
                />
                <div className="flex-1">
                  <p className="text-[12px] font-semibold text-white">Keep Forever</p>
                  <p className="text-[10px] text-white/40">
                    Remains in My Spots until you remove it
                  </p>
                </div>
                {selected === 'forever' && (
                  <Check size={16} style={{ color: GOLD }} />
                )}
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 rounded-lg border py-2.5 text-[11px] font-semibold uppercase tracking-wider transition-all hover:bg-white/5"
                style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#8a93a2' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2.5 text-[11px] font-bold uppercase tracking-wider transition-all hover:scale-[1.02]"
                style={{ borderColor: GOLD, color: '#080706', background: GOLD }}
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Bookmark size={14} fill="#080706" />
                )}
                {isAlreadySaved ? 'Update' : 'Save'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
