import { useState, useCallback, useEffect, useRef } from 'react';
import { useUserPreferences, type WidgetLayout } from '@/hooks/useUserPreferences';
import type { ChatSection, ChannelDef } from '@/components/player/ChatPanel';

export interface ChatWidgetConfig {
  widgetId: string;
  portalLabel: string;
  channels: ChannelDef[];
  defaultPos?: { x: number; y: number };
  defaultSize?: { width: number; height: number };
}

const DEFAULT_POS = { x: 24, y: 60 };
const DEFAULT_SIZE = { width: 520, height: 460 };

export interface FloatingChatState {
  open: boolean;
  minimized: boolean;
  collapsed: boolean;
  maximized: boolean;
  pinned: boolean;
  pos: { x: number; y: number };
  size: { width: number; height: number };
  z: number;
  section: ChatSection;
  search: string;
  draft: string;
}

export interface FloatingChatActions {
  setOpen: (v: boolean) => void;
  setMinimized: (v: boolean) => void;
  setCollapsed: (v: boolean) => void;
  setMaximized: (v: boolean) => void;
  setPinned: (v: boolean) => void;
  setPos: (p: { x: number; y: number }) => void;
  setSize: (s: { width: number; height: number }) => void;
  bringToFront: () => void;
  setSection: (s: ChatSection) => void;
  setSearch: (s: string) => void;
  setDraft: (d: string) => void;
  sendMessage: () => void;
  config: ChatWidgetConfig;
}

export function useFloatingChat(
  accountId: string | null | undefined,
  config: ChatWidgetConfig,
  baseZ: number = 15,
): [FloatingChatState, FloatingChatActions] {
  const prefs = useUserPreferences(accountId);
  const dPos = config.defaultPos ?? DEFAULT_POS;
  const dSize = config.defaultSize ?? DEFAULT_SIZE;

  const [open, setOpen] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState(dPos);
  const [size, setSize] = useState(dSize);
  const [z, setZ] = useState(baseZ);
  const [section, setSection] = useState<ChatSection>('general');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (prefs.loading) return;
    const layouts = prefs.prefs.coachWidgetLayouts;
    const saved = layouts[config.widgetId];
    if (saved) {
      setOpen(saved.open);
      setMinimized(saved.minimized);
      setMaximized(saved.maximized);
      setPos({ x: saved.x, y: saved.y });
      setSize({ width: saved.width, height: saved.height });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.loading, config.widgetId]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveLayout = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const layout: WidgetLayout = {
        x: pos.x, y: pos.y, width: size.width, height: size.height,
        open, minimized, maximized,
      };
      prefs.setCoachWidgetLayout(config.widgetId, layout);
    }, 800);
  }, [pos, size, open, minimized, maximized, config.widgetId, prefs]);

  useEffect(() => { saveLayout(); }, [saveLayout]);

  const bringToFront = useCallback(() => {
    setZ((zv) => zv + 1);
  }, []);

  const sendMessage = useCallback(() => {
    if (!draft.trim()) return;
    setDraft('');
  }, [draft]);

  const state: FloatingChatState = {
    open, minimized, collapsed, maximized, pinned, pos, size, z, section, search, draft,
  };

  const actions: FloatingChatActions = {
    setOpen, setMinimized, setCollapsed, setMaximized, setPinned,
    setPos, setSize, bringToFront, setSection, setSearch, setDraft, sendMessage, config,
  };

  return [state, actions];
}
