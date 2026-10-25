import { MessageSquare, Maximize2 } from 'lucide-react';
import { FloatingWindow } from '@/components/player/FloatingWindow';
import { ChatPanel, type ChatSection, type ChannelDef } from '@/components/player/ChatPanel';
import { useMessagingUnread } from '@/lib/messagingCenterStore';

const GOLD = '#d4a52c';

interface ChatWidgetProps {
  onOpenFullChat: () => void;
  position: { x: number; y: number };
  size: { width: number; height: number };
  collapsed: boolean;
  maximized: boolean;
  minimized: boolean;
  open: boolean;
  pinned: boolean;
  zIndex: number;
  onChangePosition: (pos: { x: number; y: number }) => void;
  onChangeSize: (size: { width: number; height: number }) => void;
  onToggleCollapse: () => void;
  onToggleMaximize: () => void;
  onToggleMinimize: () => void;
  onTogglePin: () => void;
  onClose: () => void;
  onBringToFront: () => void;
  section: ChatSection;
  onSelectSection: (s: ChatSection) => void;
  search: string;
  onSearchChange: (s: string) => void;
  draft: string;
  onDraftChange: (s: string) => void;
  channels?: ChannelDef[];
  portalLabel?: string;
  subtitle?: string;
  userId?: string;
}

export function ChatWidget(props: ChatWidgetProps) {
  const {
    onOpenFullChat, position, size, collapsed, maximized, minimized, open, pinned, zIndex,
    onChangePosition, onChangeSize, onToggleCollapse, onToggleMaximize, onToggleMinimize, onTogglePin, onClose, onBringToFront,
    section, onSelectSection, search, onSearchChange, draft, onDraftChange,
    channels, portalLabel, subtitle = 'Player Lounge',
    userId,
  } = props;

  const { total: unread } = useMessagingUnread(userId);
  if (!open) return null;

  const sendMessage = () => {
    if (!draft.trim()) return;
    onDraftChange('');
  };

  const title = `Chat${unread > 0 ? `  ${unread}` : ''}`;

  return (
    <FloatingWindow
      id="chat-widget"
      title={title}
      subtitle={subtitle}
      icon={<MessageSquare className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} />}
      position={position}
      size={size}
      collapsed={collapsed}
      maximized={maximized}
      minimized={minimized}
      keepAliveOnMinimize
      pinned={pinned}
      zIndex={zIndex}
      onChangePosition={onChangePosition}
      onChangeSize={onChangeSize}
      onToggleCollapse={onToggleCollapse}
      onToggleMaximize={onToggleMaximize}
      onToggleMinimize={onToggleMinimize}
      onTogglePin={onTogglePin}
      onClose={onClose}
      onBringToFront={onBringToFront}
      minWidth={420}
      resizable
    >
      <div className="relative flex h-full min-h-0">
        <ChatPanel
          section={section}
          onSelectSection={onSelectSection}
          search={search}
          onSearchChange={onSearchChange}
          draft={draft}
          onDraftChange={onDraftChange}
          onSend={sendMessage}
          compact
          channels={channels}
          portalLabel={portalLabel}
        />
        <button
          onClick={onOpenFullChat}
          className="absolute right-12 top-2.5 flex h-7 w-7 items-center justify-center rounded-md text-white/40 transition-colors hover:bg-white/10 hover:text-white"
          title="Open Full Chat"
          aria-label="Open Full Chat"
          style={{ zIndex: 10 }}
        >
          <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      </div>
    </FloatingWindow>
  );
}
