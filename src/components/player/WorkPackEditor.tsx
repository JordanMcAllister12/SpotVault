import { useRef, useCallback } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, GripVertical, X, Lightbulb, Upload, Layers } from 'lucide-react';
import type { WorkPackStage, ContentBlock } from '@/lib/contentLab';
import { FreeformBlockEditor } from './FreeformBlockEditor';
import { EmbeddedHandReplayer } from './EmbeddedHandReplayer';
import { renderInlineCardText } from './InlinePlayingCard';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';

let stageIdCounter = 0;
function newStageId(): string {
  stageIdCounter += 1;
  return `stage-${Date.now()}-${stageIdCounter}`;
}

interface Props {
  stages: WorkPackStage[];
  onChange: (stages: WorkPackStage[]) => void;
  onFieldFocus?: (el: HTMLDivElement) => void;
  onFieldSelect?: () => void;
}

export function WorkPackEditor({ stages, onChange, onFieldFocus, onFieldSelect }: Props) {
  const addStage = useCallback(() => {
    onChange([...stages, { id: newStageId(), title: '', blocks: [] }]);
  }, [stages, onChange]);

  const updateStage = useCallback((id: string, patch: Partial<WorkPackStage>) => {
    onChange(stages.map((s) => s.id === id ? { ...s, ...patch } : s));
  }, [stages, onChange]);

  const removeStage = useCallback((id: string) => {
    onChange(stages.filter((s) => s.id !== id));
  }, [stages, onChange]);

  const moveStage = useCallback((id: string, dir: -1 | 1) => {
    const idx = stages.findIndex((s) => s.id === id);
    const target = idx + dir;
    if (target < 0 || target >= stages.length) return;
    const next = [...stages];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  }, [stages, onChange]);

  return (
    <div className="space-y-3">
      {stages.map((stage, i) => (
        <StageEditor
          key={stage.id}
          stage={stage}
          index={i}
          total={stages.length}
          onChange={(patch) => updateStage(stage.id, patch)}
          onRemove={() => removeStage(stage.id)}
          onMoveUp={() => moveStage(stage.id, -1)}
          onMoveDown={() => moveStage(stage.id, 1)}
          onFieldFocus={onFieldFocus}
          onFieldSelect={onFieldSelect}
        />
      ))}

      <button
        onClick={addStage}
        className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-white/10 py-3 text-[11px] font-bold tracking-widest uppercase text-white/40 transition-all hover:border-[#c0911e]/30 hover:text-[#f5e6b0]"
      >
        <Plus className="h-4 w-4" strokeWidth={1.5} />
        Add Stage
      </button>
    </div>
  );
}

function StageEditor({ stage, index, total, onChange, onRemove, onMoveUp, onMoveDown, onFieldFocus, onFieldSelect }: {
  stage: WorkPackStage;
  index: number;
  total: number;
  onChange: (patch: Partial<WorkPackStage>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onFieldFocus?: (el: HTMLDivElement) => void;
  onFieldSelect?: () => void;
}) {
  const inputBase = "w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-[12px] text-white outline-none focus:border-[#c0911e]/40 placeholder:text-white/20";

  return (
    <div className="group rounded-lg border border-white/[0.08] bg-[rgba(8,10,12,0.6)] p-3">
      {/* Stage header */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex flex-col gap-0.5">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="flex h-5 w-5 items-center justify-center rounded text-white/30 transition hover:text-white/70 disabled:opacity-20"
          >
            <ArrowUp className="h-3 w-3" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="flex h-5 w-5 items-center justify-center rounded text-white/30 transition hover:text-white/70 disabled:opacity-20"
          >
            <ArrowDown className="h-3 w-3" />
          </button>
        </div>

        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[9px] font-bold"
          style={{ borderColor: 'rgba(212,165,44,0.3)', background: 'rgba(212,165,44,0.08)', color: GOLD_SOFT }}>
          {index + 1}
        </span>

        <input
          value={stage.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder={`Stage ${index + 1} title...`}
          className={`${inputBase} flex-1 text-[13px] font-bold`}
        />

        <button
          onClick={onRemove}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-white/30 transition hover:text-red-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Stage content blocks */}
      <div className="pl-8">
        <FreeformBlockEditor
          blocks={stage.blocks}
          onChange={(blocks) => onChange({ blocks })}
          onFieldFocus={onFieldFocus}
          onFieldSelect={onFieldSelect}
        />
      </div>
    </div>
  );
}

export function renderWorkPackStages(stages: WorkPackStage[]): React.ReactNode {
  return stages.map((stage, i) => {
    const legacyImages = stage._legacy_v1?.insight_images ?? [];
    const sortedLegacyImages = [...legacyImages].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    const hasContent = stage.blocks.length > 0 || sortedLegacyImages.length > 0;

    return (
      <div key={stage.id} className="mb-6">
        <div className="mb-3 flex items-center gap-2 border-b border-white/[0.06] pb-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-bold"
            style={{ borderColor: 'rgba(212,165,44,0.3)', background: 'rgba(212,165,44,0.08)', color: GOLD_SOFT }}>
            {i + 1}
          </span>
          <h3 className="text-[15px] font-bold text-white">{stage.title || `Stage ${i + 1}`}</h3>
        </div>
        <div className="pl-8">
          {stage.blocks.length > 0 && <StageBlocks blocks={stage.blocks} />}
          {sortedLegacyImages.length > 0 && (
            <div className={stage.blocks.length > 0 ? 'mt-4' : ''}>
              {sortedLegacyImages.map((img) => (
                <figure key={img.id} className="mb-3">
                  <img src={img.url} alt={img.name || 'Solver visual'} className="rounded-lg border border-white/[0.06]" />
                  {img.name && img.name !== 'visual.png' && img.name !== 'visual2.png' && (
                    <figcaption className="mt-1 text-center text-[10px] text-white/35">{img.name.replace(/\.png$|\.jpg$/, '').replace(/([A-Z])/g, ' $1').trim()}</figcaption>
                  )}
                </figure>
              ))}
            </div>
          )}
          {!hasContent && (
            <p className="text-[11px] text-white/25 italic">No content in this stage yet.</p>
          )}
        </div>
      </div>
    );
  });
}

function StageBlocks({ blocks }: { blocks: ContentBlock[] }) {
  return blocks.map((block) => {
    switch (block.type) {
      case 'heading':
        return block.text ? (
          <h4 key={block.id} className="mt-3 mb-1.5 text-[13px] font-bold text-white/90">{renderInlineCardText(block.text)}</h4>
        ) : null;
      case 'paragraph':
        return block.text ? (
          <p key={block.id} className="mb-2 text-[12px] leading-relaxed text-white/70">{renderInlineCardText(block.text)}</p>
        ) : null;
      case 'bullet_list':
        return block.items?.length ? (
          <ul key={block.id} className="mb-2 space-y-0.5 pl-4">
            {block.items.filter(Boolean).map((item, i) => (
              <li key={i} className="text-[12px] leading-relaxed text-white/70 list-disc">{renderInlineCardText(item)}</li>
            ))}
          </ul>
        ) : null;
      case 'numbered_list':
        return block.items?.length ? (
          <ol key={block.id} className="mb-2 space-y-0.5 pl-4">
            {block.items.filter(Boolean).map((item, i) => (
              <li key={i} className="text-[12px] leading-relaxed text-white/70 list-decimal">{renderInlineCardText(item)}</li>
            ))}
          </ol>
        ) : null;
      case 'image':
        return block.url ? (
          <figure key={block.id} className="mb-3">
            <img src={block.url} alt={block.caption || ''} className="rounded-lg border border-white/[0.06]" />
            {block.caption && (
              <figcaption className="mt-1 text-center text-[10px] text-white/35">{block.caption}</figcaption>
            )}
          </figure>
        ) : null;
      case 'callout':
        return block.text ? (
          <div key={block.id} className="mb-3 rounded-lg border border-[#c0911e]/20 bg-[#c0911e]/8 p-3">
            <div className="mb-1 flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} />
              <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: GOLD_SOFT }}>Key Takeaway</span>
            </div>
            <p className="text-[12px] leading-relaxed text-white/80">{renderInlineCardText(block.text)}</p>
          </div>
        ) : null;
      case 'hand_replay':
        return block.hand_id ? (
          <div key={block.id} className="mb-4">
            <EmbeddedHandReplayer handId={block.hand_id} />
          </div>
        ) : null;
      default:
        return null;
    }
  });
}
