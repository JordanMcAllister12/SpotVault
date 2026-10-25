import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212,165,44,0.12)';

interface CompactToolHeaderProps {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
}

export function CompactToolHeader({ icon: Icon, title, children }: CompactToolHeaderProps) {
  return (
    <div
      className="mb-3 flex items-center gap-3 rounded-xl px-4 py-2.5"
      style={{
        background: 'rgba(8,7,6,0.82)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        border: `1px solid ${BORDER}`,
        boxShadow: '0 2px 12px -4px rgba(0,0,0,0.5)',
      }}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{
          background: 'linear-gradient(135deg, rgba(192,145,30,0.12), rgba(192,145,30,0.04))',
          border: '1px solid rgba(192,145,30,0.15)',
        }}
      >
        <Icon className="h-4 w-4" strokeWidth={1.5} style={{ color: GOLD }} />
      </div>
      <span className="text-[13px] font-bold tracking-tight text-white">{title}</span>
      {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
    </div>
  );
}

export { GOLD, GOLD_SOFT, BORDER };
