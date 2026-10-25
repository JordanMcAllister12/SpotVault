import type { ReactNode } from 'react';

const GOLD_BORDER = 'rgba(212,165,44,0.12)';

export function PlayerRoomHeader({ children }: { children: ReactNode }) {
  return (
    <div
      className="mb-4 rounded-xl p-4"
      style={{
        background: 'rgba(8,7,6,0.82)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        border: `1px solid ${GOLD_BORDER}`,
        boxShadow: '0 2px 12px -4px rgba(0,0,0,0.5)',
      }}
    >
      {children}
    </div>
  );
}
