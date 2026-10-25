import { useState, useCallback, useEffect, useRef } from 'react';
import { MessageSquare, Minus } from 'lucide-react';
import { usePersistentState } from '@/hooks/usePersistentState';
import { FloatingWindow } from '@/components/player/FloatingWindow';
import { ChatPanel, type ChatSection } from '@/components/player/ChatPanel';
import { supabase } from '@/lib/supabase';
import {
  fetchDMConversations,
  fetchDMMessages,
  getOrCreateConversation,
  sendDMMessage,
  markConversationRead,
  fetchUnreadCounts,
  type DMUser,
  type DMConversation,
  type DMMessage,
} from '@/lib/dmStore';

const GOLD = '#d4a52c';
const BORDER = 'rgba(212, 165, 44, 0.18)';

interface ChatWorkspaceProps {
  onClose: () => void;
}

export function ChatWorkspace({ onClose }: ChatWorkspaceProps) {
  const [section, setSection] = usePersistentState<ChatSection>('chat-section', 'general');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');

  const [position, setPosition] = usePersistentState('chat-pos', { x: 80, y: 20 });
  const [size, setSize] = usePersistentState('chat-size', { width: 900, height: 600 });
  const [collapsed, setCollapsed] = usePersistentState('chat-collapsed', false);
  const [maximized, setMaximized] = usePersistentState('chat-maximized', false);
  const [minimized, setMinimized] = useState(false);
  const [zIndex, setZIndex] = useState(100);

  // DM state
  const [activeDM, setActiveDM] = useState<string | null>(null);
  const [dmConversations, setDmConversations] = useState<DMConversation[]>([]);
  const [dmMessages, setDmMessages] = useState<DMMessage[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const unreadRef = useRef<Record<string, number>>({});

  const bringToFront = useCallback(() => setZIndex((z) => Math.max(z + 1, 100)), [setZIndex]);

  // Get current user ID
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    })();
  }, []);

  // Load conversations when user ID is available
  const loadConversations = useCallback(async () => {
    if (!currentUserId) return;
    const [convs, unread] = await Promise.all([
      fetchDMConversations(currentUserId),
      fetchUnreadCounts(currentUserId),
    ]);
    unreadRef.current = unread;
    setDmConversations(convs.map((c) => ({ ...c, unread: unread[c.conversationId] ?? 0 })));
  }, [currentUserId]);

  useEffect(() => {
    if (currentUserId) loadConversations();
  }, [currentUserId, loadConversations]);

  // Load messages when a DM is selected
  useEffect(() => {
    if (!activeDM) {
      setDmMessages([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const msgs = await fetchDMMessages(activeDM);
      if (!cancelled) {
        setDmMessages(msgs);
        // Mark as read
        if (currentUserId) {
          await markConversationRead(activeDM, currentUserId);
          // Update unread count locally
          setDmConversations((prev) =>
            prev.map((c) => c.conversationId === activeDM ? { ...c, unread: 0 } : c),
          );
        }
      }
    })();
    return () => { cancelled = true; };
  }, [activeDM, currentUserId]);

  // Realtime subscription for new messages in active conversation
  useEffect(() => {
    if (!activeDM) return;
    const channel = supabase
      .channel(`dm-${activeDM}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_inbox_messages',
          filter: `conversation_id=eq.${activeDM}`,
        },
        (payload) => {
          setDmMessages((prev) => [...prev, payload.new as DMMessage]);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeDM]);

  // Realtime subscription for new conversations (to refresh the list)
  useEffect(() => {
    if (!currentUserId) return;
    const channel = supabase
      .channel('dm-conversations-list')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_inbox_conversations',
        },
        () => { loadConversations(); },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_inbox_conversations',
        },
        () => { loadConversations(); },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUserId, loadConversations]);

  // Handle new DM creation from user search
  const handleNewDM = useCallback(async (user: DMUser) => {
    const convId = await getOrCreateConversation(user.user_id);
    if (!convId) return;
    await loadConversations();
    setActiveDM(convId);
    setSection('direct');
    setSearch('');
  }, [loadConversations]);

  // Handle selecting an existing DM
  const handleSelectDM = useCallback((conversationId: string) => {
    setActiveDM(conversationId);
    setSection('direct');
  }, []);

  // Send a DM message
  const sendMessage = useCallback(() => {
    const body = draft.trim();
    if (!body || !activeDM || !currentUserId) return;
    setDraft('');
    void sendDMMessage(activeDM, currentUserId, body).then(() => {
      loadConversations();
    });
  }, [draft, activeDM, currentUserId, loadConversations]);

  const title = section === 'general' ? 'General' : section === 'network' ? 'Connections' : 'Direct Messages';
  const subtitle = section === 'general' ? 'Player Lounge' : section === 'network' ? 'Your connected poker network' : 'Private conversations';

  if (minimized) {
    return (
      <div className="pointer-events-none absolute inset-0 z-[200] flex items-end justify-end p-4">
        <button
          onClick={() => setMinimized(false)}
          className="pointer-events-auto flex items-center gap-2 rounded-full border px-4 py-2.5 transition-all hover:scale-105"
          style={{ background: 'rgba(8,7,6,0.85)', borderColor: BORDER, backdropFilter: 'blur(14px)', boxShadow: '0 8px 32px -8px rgba(0,0,0,0.6)' }}
          title="Restore chat"
          aria-label="Restore chat"
        >
          <MessageSquare className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
          <span className="text-[11px] font-semibold tracking-wide text-white/85">Chat</span>
        </button>
      </div>
    );
  }

  return (
    <FloatingWindow
      id="chat"
      title="Chat"
      subtitle={subtitle}
      icon={<MessageSquare className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} />}
      position={position}
      size={size}
      collapsed={collapsed}
      maximized={maximized}
      zIndex={zIndex}
      onChangePosition={setPosition}
      onChangeSize={setSize}
      onToggleCollapse={() => setCollapsed(!collapsed)}
      onToggleMaximize={() => setMaximized(!maximized)}
      onClose={onClose}
      onBringToFront={bringToFront}
      minWidth={500}
      collapsedHeight={40}
    >
      <ChatPanel
        section={section}
        onSelectSection={setSection}
        search={search}
        onSearchChange={setSearch}
        draft={draft}
        onDraftChange={setDraft}
        onSend={sendMessage}
        activeDM={activeDM}
        onSelectDM={handleSelectDM}
        dmConversations={dmConversations}
        dmMessages={dmMessages}
        currentUserId={currentUserId}
        onNewDM={handleNewDM}
      />

      <button
        onClick={() => setMinimized(true)}
        className="absolute right-20 top-2.5 flex h-7 w-7 items-center justify-center rounded-md text-white/40 transition-colors hover:bg-white/10 hover:text-white"
        title="Minimize to dock"
        aria-label="Minimize to dock"
        style={{ zIndex: 10 }}
      >
        <Minus className="h-3.5 w-3.5" strokeWidth={1.5} />
      </button>
    </FloatingWindow>
  );
}
