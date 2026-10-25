import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { useState, useCallback } from 'react';
import { Grid3x3, PenLine, ChevronDown, ChevronUp, Trash2, Pencil, Swords } from 'lucide-react';
import {
  RangeLabCoachConfig, RangeLabStudent,
} from './RangeLab';
import {
  WrittenResponseCoachConfig, WrittenResponseStudent,
  type WrittenResponseConfig, DEFAULT_WRITTEN_RESPONSE,
} from './WrittenResponse';
import {
  AiAnswerChallengeCoachConfig, AiAnswerChallengeStudent,
  type AiAnswerChallengeConfig, DEFAULT_AI_CHALLENGE,
} from './AiAnswerChallenge';
import {
  type RangeLabConfig, DEFAULT_CONFIG,
} from './rangeLab';
import { supabase } from '@/lib/supabase';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';

// ============================================================
// Range Lab Node
// ============================================================

export interface RangeLabNodeAttrs {
  config: RangeLabConfig;
}

const RangeLabComponent = ({ node, updateAttributes, selected, deleteNode }: any) => {
  const [editing, setEditing] = useState(!node.attrs.config || !node.attrs.config.heroPosition);
  const [showCoach, setShowCoach] = useState(false);

  const config: RangeLabConfig = node.attrs.config || DEFAULT_CONFIG;

  const handleConfigChange = useCallback((newConfig: RangeLabConfig) => {
    updateAttributes({ config: newConfig });
  }, [updateAttributes]);

  return (
    <NodeViewWrapper className="my-4">
      <div
        className="overflow-hidden rounded-xl border transition-all"
        style={{
          borderColor: selected ? 'rgba(212,165,44,0.4)' : 'rgba(212,165,44,0.15)',
          background: 'rgba(8,10,12,0.7)',
        }}
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
          <div className="flex items-center gap-2">
            <Grid3x3 className="h-3.5 w-3.5" style={{ color: GOLD }} />
            <span className="text-[10px] font-bold tracking-widest text-[#f5e6b0] uppercase">Range Lab</span>
            {config.mode && (
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[8px] text-white/35">
                {config.mode.replace(/_/g, ' ')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setEditing(!editing)}
              className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[8px] font-bold uppercase text-white/40 hover:text-white/70"
            >
              <Pencil className="h-2.5 w-2.5" /> {editing ? 'Preview' : 'Edit'}
            </button>
            <button
              onClick={deleteNode}
              className="flex items-center justify-center rounded-md p-1 text-white/30 hover:text-red-400"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        <div className="p-3">
          {editing ? (
            <>
              <button
                onClick={() => setShowCoach(!showCoach)}
                className="mb-2 flex items-center gap-1 text-[9px] font-bold uppercase text-white/40 hover:text-white/70"
              >
                {showCoach ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                Coach Configuration
              </button>
              {showCoach ? (
                <RangeLabCoachConfig config={config} onConfigChange={handleConfigChange} />
              ) : (
                <RangeLabStudent config={config} />
              )}
            </>
          ) : (
            <RangeLabStudent config={config} />
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
};

export const RangeLabExtension = Node.create({
  name: 'rangeLab',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      config: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="range-lab"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'range-lab' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(RangeLabComponent);
  },

  addCommands() {
    return {
      insertRangeLab: () => ({ commands }: any) => {
        return commands.insertContent({
          type: 'rangeLab',
          attrs: { config: { ...DEFAULT_CONFIG } },
        });
      },
    };
  },
});

// ============================================================
// Written Response Node
// ============================================================

export interface WrittenResponseNodeAttrs {
  config: WrittenResponseConfig;
}

const WrittenResponseComponent = ({ node, updateAttributes, selected, deleteNode }: any) => {
  const [editing, setEditing] = useState(!node.attrs.config || !node.attrs.config.question);
  const [showCoach, setShowCoach] = useState(false);

  const config: WrittenResponseConfig = node.attrs.config || DEFAULT_WRITTEN_RESPONSE;

  const handleConfigChange = useCallback((newConfig: WrittenResponseConfig) => {
    updateAttributes({ config: newConfig });
  }, [updateAttributes]);

  return (
    <NodeViewWrapper className="my-4">
      <div
        className="overflow-hidden rounded-xl border transition-all"
        style={{
          borderColor: selected ? 'rgba(212,165,44,0.4)' : 'rgba(212,165,44,0.15)',
          background: 'rgba(8,10,12,0.7)',
        }}
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
          <div className="flex items-center gap-2">
            <PenLine className="h-3.5 w-3.5" style={{ color: GOLD }} />
            <span className="text-[10px] font-bold tracking-widest text-[#f5e6b0] uppercase">Written Response</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setEditing(!editing)}
              className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[8px] font-bold uppercase text-white/40 hover:text-white/70"
            >
              <Pencil className="h-2.5 w-2.5" /> {editing ? 'Preview' : 'Edit'}
            </button>
            <button
              onClick={deleteNode}
              className="flex items-center justify-center rounded-md p-1 text-white/30 hover:text-red-400"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        <div className="p-3">
          {editing ? (
            <>
              <button
                onClick={() => setShowCoach(!showCoach)}
                className="mb-2 flex items-center gap-1 text-[9px] font-bold uppercase text-white/40 hover:text-white/70"
              >
                {showCoach ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                Coach Configuration
              </button>
              {showCoach ? (
                <WrittenResponseCoachConfig config={config} onConfigChange={handleConfigChange} />
              ) : (
                <WrittenResponseStudent config={config} />
              )}
            </>
          ) : (
            <WrittenResponseStudent config={config} />
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
};

export const WrittenResponseExtension = Node.create({
  name: 'writtenResponse',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      config: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="written-response"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'written-response' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(WrittenResponseComponent);
  },

  addCommands() {
    return {
      insertWrittenResponse: () => ({ commands }: any) => {
        return commands.insertContent({
          type: 'writtenResponse',
          attrs: { config: { ...DEFAULT_WRITTEN_RESPONSE } },
        });
      },
    };
  },
});

// ============================================================
// AI Answer Challenge Node
// ============================================================

export interface AiAnswerChallengeNodeAttrs {
  config: AiAnswerChallengeConfig;
}

const AiAnswerChallengeComponent = ({ node, updateAttributes, selected, deleteNode, editor }: any) => {
  const [editing, setEditing] = useState(!node.attrs.config || !node.attrs.config.question);
  const [showCoach, setShowCoach] = useState(false);

  const config: AiAnswerChallengeConfig = node.attrs.config || { ...DEFAULT_AI_CHALLENGE };
  const isEditable = editor?.isEditable ?? false;

  const handleConfigChange = useCallback((newConfig: AiAnswerChallengeConfig) => {
    updateAttributes({ config: newConfig });
  }, [updateAttributes]);

  // In read-only/published mode, always show student view
  if (!isEditable) {
    return (
      <NodeViewWrapper className="my-4">
        <AiAnswerChallengeStudent config={config} />
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className="my-4">
      <div
        className="overflow-hidden rounded-xl border transition-all"
        style={{
          borderColor: selected ? 'rgba(212,165,44,0.4)' : 'rgba(212,165,44,0.15)',
          background: 'rgba(8,10,12,0.7)',
        }}
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
          <div className="flex items-center gap-2">
            <Swords className="h-3.5 w-3.5" style={{ color: GOLD }} />
            <span className="text-[10px] font-bold tracking-widest text-[#f5e6b0] uppercase">AI Answer Challenge</span>
            {config.gradingMode && (
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[8px] text-white/35">
                {config.gradingMode.replace(/_/g, ' ')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setEditing(!editing)}
              className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[8px] font-bold uppercase text-white/40 hover:text-white/70"
            >
              <Pencil className="h-2.5 w-2.5" /> {editing ? 'Preview' : 'Edit'}
            </button>
            <button
              onClick={deleteNode}
              className="flex items-center justify-center rounded-md p-1 text-white/30 hover:text-red-400"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        <div className="p-3">
          {editing ? (
            <>
              <button
                onClick={() => setShowCoach(!showCoach)}
                className="mb-2 flex items-center gap-1 text-[9px] font-bold uppercase text-white/40 hover:text-white/70"
              >
                {showCoach ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                Coach Configuration
              </button>
              {showCoach ? (
                <AiAnswerChallengeCoachConfig
                  config={config}
                  onConfigChange={handleConfigChange}
                />
              ) : (
                <AiAnswerChallengeStudent config={config} />
              )}
            </>
          ) : (
            <AiAnswerChallengeStudent config={config} />
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
};

export const AiAnswerChallengeExtension = Node.create({
  name: 'aiAnswerChallenge',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      config: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="ai-answer-challenge"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'ai-answer-challenge' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AiAnswerChallengeComponent);
  },

  addCommands() {
    return {
      insertAiAnswerChallenge: () => ({ commands }: any) => {
        const challengeId = crypto.randomUUID();
        return commands.insertContent({
          type: 'aiAnswerChallenge',
          attrs: {
            config: {
              ...DEFAULT_AI_CHALLENGE,
              challengeId,
            },
          },
        });
      },
    };
  },
});

// Type augmentation for commands
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    insertRangeLab: () => ReturnType;
    insertWrittenResponse: () => ReturnType;
    insertAiAnswerChallenge: () => ReturnType;
  }
}
