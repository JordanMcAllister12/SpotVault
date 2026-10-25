import { useState } from 'react';
import { MessageSquare, Users, LifeBuoy, ArrowLeft } from 'lucide-react';
import { UnifiedCommsList } from './UnifiedCommsList';
import { ConversationPane } from './ConversationPane';
import { GroupsTab } from './GroupsTab';
import { SupportTab } from './SupportTab';
import { ConversationDetailsPane } from './ConversationDetailsPane';
import { useMessagingUnread, type MessagingTab } from '@/lib/messagingCenterStore';
import { hubGlassPanel, hubMessageSurface } from '@/components/shared/hubGlass';
import type { SpotVaultAccount } from '@/types';
import type { ContactListItem } from './ConversationListPane';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212, 165, 44, 0.18)';

interface Props {
  account: SpotVaultAccount | null;
  initialTab?: MessagingTab;
  initialConversationUserId?: string | null;
  onBack: () => void;
  isMobile?: boolean;
}

export function MessagingCenter({ account, initialTab = 'chats', initialConversationUserId, onBack, isMobile }: Props) {
  const [activeTab, setActiveTab] = useState<MessagingTab>(initialTab);
  const [selectedContact, setSelectedContact] = useState<ContactListItem | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [convUserId, setConvUserId] = useState<string | null>(initialConversationUserId ?? null);
  const { chats, groups, support } = useMessagingUnread(account?.id);

  const tabs: { id: MessagingTab; label: string; icon: typeof MessageSquare; badge?: number }[] = [
    { id: 'chats', label: 'Inbox', icon: MessageSquare, badge: chats > 0 ? chats : undefined },
    { id: 'groups', label: 'Groups', icon: Users, badge: groups > 0 ? groups : undefined },
    { id: 'support', label: 'Support', icon: LifeBuoy, badge: support > 0 ? support : undefined },
  ];

  const handleSelectContact = (contact: ContactListItem) => {
    setSelectedContact(contact);
    setConvUserId(contact.userId);
  };

  const handleSwitchTab = (tab: MessagingTab) => {
    setActiveTab(tab);
    setSelectedContact(null);
    setShowDetails(false);
  };

  // Mobile layout: single column with back navigation
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-[90] flex flex-col" style={hubMessageSurface}>
        {/* Top bar with tab bar */}
        <div className="shrink-0 border-b border-white/[0.06]">
          <div className="flex items-center justify-between px-3 py-2">
            <button onClick={onBack} className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-black/30 text-white/50 hover:text-white/80">
              <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
            </button>
            <h1 className="text-[12px] font-bold tracking-wide text-white">MESSAGING CENTER</h1>
            <div className="w-8" />
          </div>
          {/* Tab bar */}
          <div className="flex items-center gap-1 px-2 pb-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
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
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                  {tab.label}
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[8px] font-bold" style={{ background: GOLD, color: '#080706' }}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content — single column */}
        <div className="min-h-0 flex-1 overflow-hidden">
          {activeTab === 'chats' && (
            selectedContact ? (
              <ConversationPane
                account={account}
                contact={selectedContact}
                onBack={() => setSelectedContact(null)}
                compact
              />
            ) : (
              <UnifiedCommsList
                account={account}
                selectedUserId={null}
                onSelect={handleSelectContact}
              />
            )
          )}
          {activeTab === 'groups' && <GroupsTab account={account} />}
          {activeTab === 'support' && <SupportTab account={account} />}
        </div>
      </div>
    );
  }

  // Desktop layout: 3-column
  return (
    <div className="flex h-full flex-col" style={hubGlassPanel}>
      {/* Top bar */}
      <div className="shrink-0 border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-black/30 text-white/50 hover:text-white/80">
              <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
            </button>
            <h1 className="text-[14px] font-bold tracking-wide text-white">MESSAGING CENTER</h1>
          </div>
        </div>
        {/* Tab bar */}
        <div className="mt-3 flex items-center gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleSwitchTab(tab.id)}
                className="flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-bold tracking-wider uppercase transition-all"
                style={{
                  borderColor: active ? BORDER : 'rgba(255,255,255,0.06)',
                  background: active ? 'rgba(212,165,44,0.12)' : 'transparent',
                  color: active ? GOLD_SOFT : 'rgba(255,255,255,0.45)',
                }}
              >
                <Icon className="h-4 w-4" strokeWidth={1.5} style={{ color: active ? GOLD : 'rgba(255,255,255,0.4)' }} />
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[9px] font-bold" style={{ background: GOLD, color: '#080706' }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3-column layout */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="grid h-full" style={{ gridTemplateColumns: '320px 1fr 240px' }}>
          {/* Left: list */}
          <div className="border-r border-white/[0.06] overflow-hidden">
            {activeTab === 'chats' && (
              <UnifiedCommsList
                account={account}
                selectedUserId={selectedContact?.userId ?? null}
                onSelect={handleSelectContact}
              />
            )}
            {activeTab === 'groups' && <GroupsTab account={account} listOnly />}
            {activeTab === 'support' && <SupportTab account={account} listOnly />}
          </div>

          {/* Center: conversation */}
          <div className="overflow-hidden">
            {activeTab === 'chats' && (
              <ConversationPane
                account={account}
                contact={selectedContact}
                initialConversationUserId={convUserId}
                onBack={() => setSelectedContact(null)}
                onShowDetails={() => setShowDetails(s => !s)}
              />
            )}
            {activeTab === 'groups' && <GroupsTab account={account} />}
            {activeTab === 'support' && <SupportTab account={account} />}
          </div>

          {/* Right: details */}
          <div className="border-l border-white/[0.06] overflow-hidden">
            {activeTab === 'chats' && selectedContact ? (
              <ConversationDetailsPane userId={selectedContact.userId} />
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="px-4 text-center text-[10px] text-white/25">Select a conversation to view details.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
