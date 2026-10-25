import { useState } from 'react';
import { MessageSquare, Users, LifeBuoy, ChevronRight } from 'lucide-react';
import { UnifiedCommsList } from './UnifiedCommsList';
import { ConversationPane } from './ConversationPane';
import { GroupsTab } from './GroupsTab';
import { SupportTab } from './SupportTab';
import { useMessagingUnread, type MessagingTab } from '@/lib/messagingCenterStore';
import type { SpotVaultAccount } from '@/types';
import type { ContactListItem } from './ConversationListPane';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212, 165, 44, 0.18)';

const TABS: { id: MessagingTab; label: string; icon: typeof MessageSquare }[] = [
  { id: 'chats', label: 'Inbox', icon: MessageSquare },
  { id: 'groups', label: 'Groups', icon: Users },
  { id: 'support', label: 'Support', icon: LifeBuoy },
];

interface Props {
  account: SpotVaultAccount | null;
  isActive: boolean;
  onActivate: () => void;
  onOpenFullMessaging: () => void;
}

export function QuickMessagesPanel({ account, isActive, onActivate, onOpenFullMessaging }: Props) {
  const [activeTab, setActiveTab] = useState<MessagingTab>('chats');
  const [view, setView] = useState<'list' | 'conversation'>('list');
  const [selectedContact, setSelectedContact] = useState<ContactListItem | null>(null);
  const { chats, groups, support } = useMessagingUnread(account?.id);

  const badges: Partial<Record<MessagingTab, number>> = {
    chats: chats > 0 ? chats : undefined,
    groups: groups > 0 ? groups : undefined,
    support: support > 0 ? support : undefined,
  };

  const handleSelect = (contact: ContactListItem) => {
    onActivate();
    setSelectedContact(contact);
    setView('conversation');
  };

  const handleBack = () => {
    setView('list');
    setSelectedContact(null);
  };

  const handleSwitchTab = (tab: MessagingTab) => {
    setActiveTab(tab);
    setView('list');
    setSelectedContact(null);
  };

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden transition-all duration-500"
      style={{ background: 'rgba(8,7,6,0.4)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}
      onMouseDown={onActivate}
      onTouchStart={onActivate}
    >
      {/* Header with tab navigation */}
      <div className="shrink-0 border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-3 py-2">
          <button
            onClick={onOpenFullMessaging}
            className="flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-white/60 transition-colors hover:text-white/90"
          >
            <MessageSquare className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} />
            MESSAGING
            <ChevronRight className="h-3 w-3 text-white/30" strokeWidth={1.5} />
          </button>
        </div>
        {/* Tab bar */}
        <div className="flex items-center gap-1 px-2 pb-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            const badge = badges[tab.id];
            return (
              <button
                key={tab.id}
                onClick={() => handleSwitchTab(tab.id)}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold tracking-wider uppercase transition-all"
                style={{
                  borderColor: active ? BORDER : 'rgba(255,255,255,0.06)',
                  background: active ? 'rgba(212,165,44,0.12)' : 'transparent',
                  color: active ? GOLD_SOFT : 'rgba(255,255,255,0.45)',
                }}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: active ? GOLD : 'rgba(255,255,255,0.4)' }} />
                {tab.label}
                {badge !== undefined && badge > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[8px] font-bold" style={{ background: GOLD, color: '#080706' }}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body: tab content */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === 'chats' && (
          view === 'list' ? (
            <UnifiedCommsList
              account={account}
              selectedUserId={null}
              onSelect={handleSelect}
              compact
            />
          ) : (
            <ConversationPane
              account={account}
              contact={selectedContact}
              onBack={handleBack}
              compact
            />
          )
        )}
        {activeTab === 'groups' && <GroupsTab account={account} listOnly />}
        {activeTab === 'support' && <SupportTab account={account} />}
      </div>
    </div>
  );
}
