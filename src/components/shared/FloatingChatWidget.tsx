import { MessageSquare } from 'lucide-react';
import { FloatingWindow } from '@/components/player/FloatingWindow';
import { ChatPanel } from '@/components/player/ChatPanel';
import type { FloatingChatState, FloatingChatActions } from '@/hooks/useFloatingChat';

const GOLD = '#d4a52c';
const GOLD_BORDER = 'rgba(192,145,30,0.25)';

interface Props {
  state: FloatingChatState;
  actions: FloatingChatActions;
}

export function FloatingChatWidget({ state, actions }: Props) {
  const { config } = actions;

  return (
    <>
      {state.open && !state.minimized && (
        <FloatingWindow
          id={config.widgetId}
          title="Chat"
          subtitle={config.portalLabel}
          icon={<MessageSquare className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} />}
          position={state.pos}
          size={state.size}
          collapsed={state.collapsed}
          maximized={state.maximized}
          minimized={state.minimized}
          pinned={state.pinned}
          zIndex={state.z}
          onChangePosition={actions.setPos}
          onChangeSize={actions.setSize}
          onToggleCollapse={() => actions.setCollapsed(!state.collapsed)}
          onToggleMaximize={() => actions.setMaximized(!state.maximized)}
          onToggleMinimize={() => actions.setMinimized(true)}
          onTogglePin={() => actions.setPinned(!state.pinned)}
          onClose={() => actions.setOpen(false)}
          onBringToFront={actions.bringToFront}
          minWidth={420}
          resizable
        >
          <ChatPanel
            section={state.section}
            onSelectSection={actions.setSection}
            search={state.search}
            onSearchChange={actions.setSearch}
            draft={state.draft}
            onDraftChange={actions.setDraft}
            onSend={actions.sendMessage}
            compact
            channels={config.channels}
            portalLabel={config.portalLabel}
          />
        </FloatingWindow>
      )}

      {/* Dock buttons */}
      <div className="pointer-events-none absolute bottom-4 right-4 z-[200] flex flex-col items-end gap-2">
        {state.open && state.minimized && (
          <button
            onClick={() => { actions.setMinimized(false); actions.bringToFront(); }}
            className="pointer-events-auto flex items-center gap-2 rounded-full border px-4 py-2.5 transition-all hover:scale-105"
            style={{ background: 'rgba(8,7,6,0.85)', borderColor: GOLD_BORDER, backdropFilter: 'blur(14px)', boxShadow: '0 8px 32px -8px rgba(0,0,0,0.6)' }}
            title="Restore chat"
            aria-label="Restore chat"
          >
            <MessageSquare className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
            <span className="text-[11px] font-semibold tracking-wide text-white/85">Chat</span>
          </button>
        )}
        {!state.open && (
          <button
            onClick={() => { actions.setOpen(true); actions.setMinimized(false); actions.bringToFront(); }}
            className="pointer-events-auto flex items-center gap-2 rounded-full border px-4 py-2.5 transition-all hover:scale-105"
            style={{ background: 'rgba(8,7,6,0.85)', borderColor: GOLD_BORDER, backdropFilter: 'blur(14px)', boxShadow: '0 8px 32px -8px rgba(0,0,0,0.6)' }}
            title="Open chat"
            aria-label="Open chat"
          >
            <MessageSquare className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
            <span className="text-[11px] font-semibold tracking-wide text-white/85">Open Chat</span>
          </button>
        )}
      </div>
    </>
  );
}
