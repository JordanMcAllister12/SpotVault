import { useState, type ReactNode, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

export function PortalPopover({
  anchorRef,
  open,
  onClose,
  align = 'left',
  direction = 'up',
  width = 192,
  className = '',
  children,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  align?: 'left' | 'right';
  direction?: 'up' | 'down';
  width?: number;
  className?: string;
  children: ReactNode;
}) {
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [anchorVisible, setAnchorVisible] = useState(false);

  const updatePos = useCallback(() => {
    if (!open || !anchorRef.current) {
      setAnchorVisible(false);
      return;
    }
    const rect = anchorRef.current.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setAnchorVisible(false);
      return;
    }
    setAnchorVisible(true);
    const GAP = 8;

    if (direction === 'down') {
      setPos({
        top: rect.bottom + GAP,
        left: align === 'right' ? rect.right - width : rect.left,
      });
    } else {
      setPos({
        top: rect.top - GAP,
        left: align === 'right' ? rect.right - width : rect.left,
      });
    }
  }, [open, anchorRef, align, direction, width]);

  useEffect(() => {
    updatePos();
  }, [updatePos]);

  useEffect(() => {
    if (!open) return;
    const handler = () => updatePos();
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    window.addEventListener('visualviewportheightchange', handler);
    // visualViewport resize fires when mobile browser chrome expands/collapses
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handler);
    }
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('visualviewportheightchange', handler);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handler);
      }
    };
  }, [open, updatePos]);

  if (!open || !anchorVisible) return null;

  // Use visualViewport height when available — it accounts for mobile browser
  // chrome (address bar, navigation bar) that 100dvh may not fully capture.
  const vvHeight = typeof window !== 'undefined' ? window.visualViewport?.height ?? null : null;
  const BOTTOM_SPACING = 24;
  const availableHeight = vvHeight ?? window.innerHeight;
  const maxHeight = direction === 'down'
    ? `${Math.max(80, availableHeight - pos.top - BOTTOM_SPACING)}px`
    : `${Math.max(80, pos.top - BOTTOM_SPACING)}px`;

  return createPortal(
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 99998 }} onClick={onClose} />
      <div
        style={{
          position: 'fixed',
          top: direction === 'down' ? pos.top : undefined,
          bottom: direction === 'up' ? window.innerHeight - pos.top : undefined,
          left: pos.left,
          width,
          zIndex: 99999,
          maxHeight,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          // Extra bottom padding ensures the final row clears mobile browser controls.
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)',
        }}
        className={className}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
