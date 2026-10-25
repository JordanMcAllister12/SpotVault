import { useRef, useState, useCallback, useEffect, type ReactNode, type MouseEvent } from 'react';
import { ChevronDown, ChevronUp, Maximize2, Minimize2, Minus, Pin, PinOff, X, Eye, EyeOff, GripVertical } from 'lucide-react';

const BORDER = 'rgba(212, 165, 44, 0.18)';

export interface FloatingWindowProps {
  id: string;
  title: string;
  subtitle?: string;
  icon: ReactNode;
  children: ReactNode;
  position: { x: number; y: number };
  size: { width: number; height: number };
  collapsed: boolean;
  maximized: boolean;
  minimized: boolean;
  zIndex: number;
  onChangePosition: (pos: { x: number; y: number }) => void;
  onChangeSize: (size: { width: number; height: number }) => void;
  onToggleCollapse: () => void;
  onToggleMaximize: () => void;
  onToggleMinimize: () => void;
  onTogglePin: () => void;
  onClose: () => void;
  onBringToFront: () => void;
  pinned?: boolean;
  transparentMode?: boolean;
  onToggleTransparent?: () => void;
  isActive?: boolean;
  inactiveOpacity?: number;
  minWidth?: number;
  collapsedHeight?: number;
  resizable?: boolean;
  className?: string;
  keepAliveOnMinimize?: boolean;
}

export function FloatingWindow({
  title,
  subtitle,
  icon,
  children,
  position,
  size,
  collapsed,
  maximized,
  minimized,
  zIndex,
  onChangePosition,
  onChangeSize,
  onToggleCollapse,
  onToggleMaximize,
  onToggleMinimize,
  onTogglePin,
  onClose,
  pinned = false,
  transparentMode = false,
  onToggleTransparent,
  isActive = true,
  inactiveOpacity = 0.35,
  onBringToFront,
  minWidth = 280,
  collapsedHeight = 40,
  resizable = true,
  className = '',
  keepAliveOnMinimize = false,
}: FloatingWindowProps) {
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Drag handlers via global listeners (mouse + touch)
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: globalThis.MouseEvent | TouchEvent) => {
      if (!dragRef.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const dx = clientX - dragRef.current.startX;
      const dy = clientY - dragRef.current.startY;
      let newX = dragRef.current.origX + dx;
      let newY = dragRef.current.origY + dy;
      const el = containerRef.current?.parentElement;
      const pad = 16;
      const cw = el ? el.clientWidth : window.innerWidth;
      const ch = el ? el.clientHeight : window.innerHeight;
      const minX = pad;
      const minY = 8;
      const maxX = Math.max(minX, cw - size.width - pad);
      const maxY = Math.max(minY, ch - size.height - pad);
      newX = Math.max(minX, Math.min(newX, maxX));
      newY = Math.max(minY, Math.min(newY, maxY));
      onChangePosition({ x: newX, y: newY });
    };
    const onUp = () => {
      dragRef.current = null;
      setIsDragging(false);
    };
    window.addEventListener('mousemove', onMove as EventListener);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove as EventListener, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove as EventListener);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove as EventListener);
      window.removeEventListener('touchend', onUp);
    };
  }, [isDragging, onChangePosition, size.width, size.height]);

  // Resize handlers via global listeners (mouse + touch)
  useEffect(() => {
    if (!isResizing) return;
    const onMove = (e: globalThis.MouseEvent | TouchEvent) => {
      if (!resizeRef.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const dw = clientX - resizeRef.current.startX;
      const dh = clientY - resizeRef.current.startY;
      onChangeSize({
        width: Math.max(minWidth, resizeRef.current.origW + dw),
        height: Math.max(200, resizeRef.current.origH + dh),
      });
    };
    const onUp = () => {
      resizeRef.current = null;
      setIsResizing(false);
    };
    window.addEventListener('mousemove', onMove as EventListener);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove as EventListener, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove as EventListener);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove as EventListener);
      window.removeEventListener('touchend', onUp);
    };
  }, [isResizing, onChangeSize, minWidth]);

  const handleDragStart = useCallback((e: MouseEvent | TouchEvent) => {
    if (maximized || pinned) return;
    e.preventDefault();
    onBringToFront();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragRef.current = { startX: clientX, startY: clientY, origX: position.x, origY: position.y };
    setIsDragging(true);
  }, [maximized, pinned, onBringToFront, position.x, position.y]);

  const handleResizeStart = useCallback((e: MouseEvent | TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onBringToFront();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    resizeRef.current = { startX: clientX, startY: clientY, origW: size.width, origH: size.height };
    setIsResizing(true);
  }, [onBringToFront, size.width, size.height]);

  // Minimized windows are not rendered — they live in the dock.
  // keepAliveOnMinimize preserves children (e.g. audio/video) in a hidden container.
  if (minimized) {
    if (!keepAliveOnMinimize) return null;
    return (
      <div aria-hidden style={{ position: 'fixed', left: -9999, top: -9999, width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}>
        {children}
      </div>
    );
  }

  const currentWidth = maximized ? '100%' : size.width;
  const currentHeight = collapsed ? collapsedHeight : maximized ? '100%' : size.height;
  const currentX = maximized ? 0 : position.x;
  const currentY = maximized ? 0 : position.y;

  const faded = transparentMode && !isActive && !collapsed;
  const effectiveOpacity = faded ? inactiveOpacity : 1;

  return (
    <div
      ref={containerRef}
      className={`pointer-events-auto absolute flex flex-col overflow-hidden ${className}`}
      style={{
        left: currentX,
        top: currentY,
        width: currentWidth,
        height: typeof currentHeight === 'number' ? `${currentHeight}px` : currentHeight,
        zIndex,
        opacity: effectiveOpacity,
        background: faded ? 'rgba(8, 7, 6, 0.45)' : 'rgba(8, 7, 6, 0.82)',
        border: `1px solid ${BORDER}`,
        borderRadius: maximized ? '0' : '12px',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 24px 60px -20px rgba(0,0,0,0.7), 0 8px 32px -12px rgba(0,0,0,0.5)',
        backdropFilter: faded ? 'blur(4px)' : 'blur(14px)',
        WebkitBackdropFilter: faded ? 'blur(4px)' : 'blur(14px)',
        transition: isDragging || isResizing ? 'none' : 'opacity 0.4s ease',
      }}
    >
      {/* Header / drag handle */}
      <div
        className={`flex h-10 shrink-0 select-none items-center justify-between border-b border-white/[0.06] bg-black/30 px-3 ${pinned ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
        onMouseDown={handleDragStart as (e: MouseEvent) => void}
        onTouchStart={handleDragStart as (e: TouchEvent) => void}
      >
        <div className="flex min-w-0 items-center gap-2">
          <GripVertical className={`h-4 w-4 shrink-0 ${pinned ? 'text-white/15' : 'text-white/30'} ${!pinned ? 'cursor-grab' : ''}`} strokeWidth={1.5} />
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border" style={{ borderColor: BORDER, background: 'rgba(192,145,30,0.1)' }}>
            {icon}
          </div>
          <div className="min-w-0">
            <span className="truncate text-[11px] font-semibold text-white">{title}</span>
            {subtitle && <span className="ml-2 hidden text-[10px] text-white/35 sm:inline">{subtitle}</span>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5" onMouseDown={(e) => e.stopPropagation()}>
          {onToggleTransparent && (
            <TransparentControl enabled={transparentMode} onClick={onToggleTransparent} />
          )}
          <PinControl pinned={pinned} onClick={onTogglePin} />
          <WindowControl icon={collapsed ? ChevronUp : ChevronDown} label={collapsed ? 'Expand' : 'Collapse'} onClick={onToggleCollapse} />
          <WindowControl icon={maximized ? Minimize2 : Maximize2} label={maximized ? 'Restore Size' : 'Maximize'} onClick={onToggleMaximize} />
          <WindowControl icon={Minus} label="Minimize" onClick={onToggleMinimize} />
          <WindowControl icon={X} label="Close" onClick={onClose} />
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="min-h-0 flex-1 overflow-hidden">
          {children}
        </div>
      )}

      {/* Resize handle */}
      {resizable && !collapsed && !maximized && (
        <div
          className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize"
          onMouseDown={handleResizeStart as (e: MouseEvent) => void}
          onTouchStart={handleResizeStart as (e: TouchEvent) => void}
          style={{
            background: 'linear-gradient(135deg, transparent 50%, rgba(212,165,44,0.3) 50%)',
          }}
        />
      )}
    </div>
  );
}

function WindowControl({ icon: Icon, label, onClick }: { icon: typeof X; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-7 w-7 items-center justify-center rounded-md text-white/40 transition-colors hover:bg-white/10 hover:text-white"
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
    </button>
  );
}

function PinControl({ pinned, onClick }: { pinned: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={pinned ? 'Unpin — allow dragging' : 'Pin — lock in place'}
      aria-label={pinned ? 'Unpin' : 'Pin'}
      className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-white/10"
      style={{ color: pinned ? '#d4a52c' : 'rgba(255,255,255,0.4)' }}
    >
      {pinned ? <Pin className="h-3.5 w-3.5" strokeWidth={2} /> : <PinOff className="h-3.5 w-3.5" strokeWidth={1.5} />}
    </button>
  );
}

function TransparentControl({ enabled, onClick }: { enabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={enabled ? 'Transparent mode on — click to disable' : 'Transparent mode — fade when inactive'}
      aria-label={enabled ? 'Disable transparent mode' : 'Enable transparent mode'}
      className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-white/10"
      style={{ color: enabled ? '#d4a52c' : 'rgba(255,255,255,0.4)' }}
    >
      {enabled ? <EyeOff className="h-3.5 w-3.5" strokeWidth={2} /> : <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />}
    </button>
  );
}
