import { ArrowLeft } from 'lucide-react';

interface Props {
  onBack: () => void;
  label?: string;
}

export function ReturnToPortalButton({ onBack, label = 'SpotVault' }: Props) {
  return (
    <button
      onClick={onBack}
      className="flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 text-[10px] font-semibold tracking-widest text-white/50 uppercase transition-all hover:border-[#c0911e]/40 hover:text-[#d4a52c] active:scale-95"
      style={{ minHeight: 32 }}
    >
      <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> {label}
    </button>
  );
}
