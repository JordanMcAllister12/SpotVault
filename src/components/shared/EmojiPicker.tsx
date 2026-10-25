import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Smile } from 'lucide-react';

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: 'Faces',
    emojis: ['😀', '😂', '🤣', '😊', '😎', '🤔', '😭', '😡', '🙏', '💪'],
  },
  {
    label: 'Reactions',
    emojis: ['❤️', '🔥', '👍', '👎', '👏', '🎉', '💯', '🚀', '👀', '🎯'],
  },
  {
    label: 'Poker',
    emojis: ['♠️', '♥️', '♦️', '♣️', '🃏', '🏆', '💰'],
  },
];

interface EmojiPickerProps {
  onInsert: (emoji: string) => void;
  className?: string;
}

export function EmojiPicker({ onInsert, className = '' }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; bottom: number; width: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const width = Math.min(280, window.innerWidth - 16);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const bottom = window.innerHeight - rect.top + 6;
    setPos({ left, bottom, width });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(!open)}
        title="Insert emoji"
        className="flex h-7 w-7 items-center justify-center rounded-lg border transition-colors active:scale-95"
        style={{ borderColor: 'rgba(212,165,44,0.18)', background: 'rgba(192,145,30,0.06)', color: '#d4a52c' }}
      >
        <Smile className="h-3.5 w-3.5" strokeWidth={1.5} />
      </button>
      {open && pos && (
        <div
          className="fixed z-50 rounded-xl border p-2 backdrop-blur-xl"
          style={{
            left: pos.left,
            bottom: pos.bottom,
            width: pos.width,
            maxHeight: '220px',
            overflowY: 'auto',
            borderColor: 'rgba(212,165,44,0.18)',
            background: 'rgba(8,7,6,0.95)',
            boxShadow: '0 12px 40px -8px rgba(0,0,0,0.8)',
          }}
        >
          {EMOJI_CATEGORIES.map((cat) => (
            <div key={cat.label} className="mb-1.5">
              <div className="mb-1 text-[8px] font-bold tracking-widest text-white/30 uppercase">{cat.label}</div>
              <div className="flex flex-wrap gap-0.5">
                {cat.emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => { onInsert(emoji); setOpen(false); }}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-base transition-colors hover:bg-white/10"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
