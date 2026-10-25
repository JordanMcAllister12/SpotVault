import { useState, useRef, useEffect } from 'react';
import { Send, Users, MessageSquare } from 'lucide-react';
import type { ManitobaChatMessage, ManitobaDirectContact } from '@/data/manitobaDemoData';
import { MANITOBA_GROUP_CHAT, MANITOBA_DIRECT_CHAT, MANITOBA_DIRECT_CONTACTS } from '@/data/manitobaDemoData';
import { Avatar } from '@/components/shared/Avatar';

const GOLD = '#d4a52c';
const BORDER = 'rgba(212,165,44,0.18)';

type ChatTab = 'group' | 'direct';

interface Props {
  accountName: string | null;
}

export function ManitobaChat({ accountName }: Props) {
  const [tab, setTab] = useState<ChatTab>('group');
  const [groupMessages, setGroupMessages] = useState<ManitobaChatMessage[]>(MANITOBA_GROUP_CHAT);
  const [directMessages, setDirectMessages] = useState<ManitobaChatMessage[]>(MANITOBA_DIRECT_CHAT);
  const [activeContactId, setActiveContactId] = useState<string>(MANITOBA_DIRECT_CONTACTS[0]?.id ?? '');
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeContact = MANITOBA_DIRECT_CONTACTS.find((c) => c.id === activeContactId);
  const messages = tab === 'group' ? groupMessages : (activeContact?.messages ?? directMessages);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, tab, activeContactId]);

  const handleSend = () => {
    if (!input.trim() || !accountName) return;
    const newMsg: ManitobaChatMessage = {
      id: `msg-${Date.now()}`,
      authorName: accountName,
      authorAvatar: null,
      text: input.trim(),
      timestamp: 'now',
      isSelf: true,
    };
    if (tab === 'group') {
      setGroupMessages((prev) => [...prev, newMsg]);
    } else {
      setDirectMessages((prev) => [...prev, newMsg]);
    }
    setInput('');
  };

  return (
    <div className="flex h-full flex-col">
      {/* Tabs */}
      <div className="flex shrink-0 items-center gap-1 border-b border-white/[0.06] p-2">
        <TabButton active={tab === 'group'} onClick={() => setTab('group')} icon={Users} label="Group" />
        <TabButton active={tab === 'direct'} onClick={() => setTab('direct')} icon={MessageSquare} label="Direct" />
      </div>

      {tab === 'direct' ? (
        <div className="flex min-h-0 flex-1">
          {/* Contact rail — ~28% */}
          <div className="flex shrink-0 flex-col overflow-y-auto border-r border-white/[0.06]" style={{ width: '28%', minWidth: '72px' }}>
            {MANITOBA_DIRECT_CONTACTS.map((contact) => (
              <ContactButton
                key={contact.id}
                contact={contact}
                active={contact.id === activeContactId}
                onClick={() => setActiveContactId(contact.id)}
              />
            ))}
          </div>

          {/* Conversation — ~72% */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2">
              {messages.map((msg) => (
                <ChatMessageRow key={msg.id} message={msg} />
              ))}
            </div>
            <div className="shrink-0 border-t border-white/[0.06] p-2">
              <div className="flex items-center gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSend(); } }}
                  placeholder={`Message ${activeContact?.name ?? ''}...`}
                  className="flex-1 rounded-full border border-white/[0.08] bg-black/30 px-3 py-2 text-[11px] text-white placeholder:text-white/25 focus:border-[#c0911e]/30 focus:outline-none"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="flex h-8 w-8 items-center justify-center rounded-full transition disabled:opacity-30"
                  style={{ background: GOLD }}
                >
                  <Send className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: '#080706' }} />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2">
            {messages.map((msg) => (
              <ChatMessageRow key={msg.id} message={msg} />
            ))}
          </div>
          <div className="shrink-0 border-t border-white/[0.06] p-2">
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSend(); } }}
                placeholder="Message the group..."
                className="flex-1 rounded-full border border-white/[0.08] bg-black/30 px-3 py-2 text-[11px] text-white placeholder:text-white/25 focus:border-[#c0911e]/30 focus:outline-none"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="flex h-8 w-8 items-center justify-center rounded-full transition disabled:opacity-30"
                style={{ background: GOLD }}
              >
                <Send className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: '#080706' }} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ContactButton({ contact, active, onClick }: { contact: ManitobaDirectContact; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-2 py-2 text-left transition-colors ${active ? 'bg-[#c0911e]/10' : 'hover:bg-white/[0.03]'}`}
    >
      <div className="relative shrink-0">
        <Avatar name={contact.name} size={28} />
        {contact.online && (
          <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-400 ring-1 ring-[#080706]" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[10px] font-semibold text-white/80">{contact.name}</div>
        <div className="truncate text-[8px] text-white/30">{contact.previewMessage}</div>
      </div>
    </button>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Users; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${
        active ? 'text-[#080706]' : 'text-white/40 hover:text-white/60'
      }`}
      style={{ background: active ? GOLD : 'transparent' }}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.5} /> {label}
    </button>
  );
}

function ChatMessageRow({ message }: { message: ManitobaChatMessage }) {
  if (message.isSelf) {
    return (
      <div className="mb-2 flex items-end justify-end gap-2">
        <div className="max-w-[80%]">
          <div className="rounded-2xl rounded-br-md px-3 py-2" style={{ background: GOLD }}>
            <p className="text-[11px] text-[#080706]">{message.text}</p>
          </div>
          <span className="mr-1 block text-right text-[8px] text-white/25">{message.timestamp}</span>
        </div>
        <Avatar name={message.authorName} size={28} />
      </div>
    );
  }
  return (
    <div className="mb-2 flex items-end gap-2">
      <Avatar name={message.authorName} size={28} />
      <div className="max-w-[80%]">
        <span className="mb-0.5 block text-[9px] font-semibold text-white/50">{message.authorName}</span>
        <div className="rounded-2xl rounded-bl-md px-3 py-2" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <p className="text-[11px] text-white/80">{message.text}</p>
        </div>
        <span className="ml-1 block text-[8px] text-white/25">{message.timestamp}</span>
      </div>
    </div>
  );
}
