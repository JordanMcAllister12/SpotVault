import type { ReactNode } from 'react';

const GOLD = 'var(--portal-accent, #d4a52c)';

interface PortalWorkspaceShellProps {
  children: ReactNode;
  maxWidth?: string;
  /** Extra padding for the inner content area. */
  contentClassName?: string;
}

/**
 * Reusable dark workspace shell for functional portal pages.
 *
 * Portal backgrounds provide atmosphere; this shell provides a readable
 * working surface. Near-black charcoal, ~93% opaque, thin accent border,
 * rounded corners, subtle shadow/glow. The room remains visible around it.
 *
 * Use for: Subscriptions, Paid Requests, Rolodex, settings, directories,
 * dashboards, tables, forms — any functional page that would otherwise
 * float directly over detailed wallpaper.
 *
 * Do NOT use for: immersive Home rooms, floating widgets (chat, media player).
 */
export function PortalWorkspaceShell({
  children,
  maxWidth = 'max-w-5xl',
  contentClassName = 'px-5 py-5 sm:px-6 sm:py-6',
}: PortalWorkspaceShellProps) {
  return (
    <div className="flex justify-center px-3 py-4 sm:px-6 sm:py-6">
      <div
        className={`w-full ${maxWidth} overflow-hidden rounded-2xl border`}
        style={{
          borderColor: 'rgba(var(--portal-accent-rgb, 212,165,44), 0.22)',
          background: 'rgba(8, 7, 6, 0.93)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.04), 0 24px 60px -16px rgba(0,0,0,0.8), 0 0 0 1px rgba(var(--portal-accent-rgb, 212,165,44), 0.04)',
        }}
      >
        <div className={`max-h-[calc(100vh-8rem)] overflow-y-auto ${contentClassName}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
