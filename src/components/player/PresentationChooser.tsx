import { AudioLines, Hammer, Library, Upload, ClipboardPaste, X } from 'lucide-react';

interface Props {
  hasCurrentHand: boolean;
  onClose: () => void;
  onUseCurrent: () => void;
  onBuild: () => void;
}

export function PresentationChooser({ hasCurrentHand, onClose, onUseCurrent, onBuild }: Props) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8">
      <div className="flex items-start justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[#d4a52c]"><AudioLines className="h-4 w-4" /> <span className="text-[10px] font-bold tracking-[0.2em] uppercase">Presentation Mode</span></div>
          <h2 className="text-xl font-bold text-white">Create Hand Presentation</h2>
          <p className="mt-1 text-[11px] text-white/45">Choose a hand to begin. Narration remains the master timeline.</p>
        </div>
        <button onClick={onClose} className="rounded-md p-2 text-white/35 hover:bg-white/5 hover:text-white" aria-label="Close presentation chooser"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {hasCurrentHand && <ChoiceButton icon={AudioLines} label="Use Current Hand" detail="Open the selected hand in Presentation Mode." onClick={onUseCurrent} />}
        <ChoiceButton icon={Library} label="Select Existing Hand" detail={hasCurrentHand ? 'Use the hand currently selected in Workspace.' : 'Select a hand from Workspace first.'} onClick={hasCurrentHand ? onUseCurrent : onClose} />
        <ChoiceButton icon={ClipboardPaste} label="Paste HH" detail="Paste a hand history using the Workspace importer above." onClick={onClose} />
        <ChoiceButton icon={Upload} label="Upload HH" detail="Upload a hand history using the Workspace importer above." onClick={onClose} />
        <ChoiceButton icon={Hammer} label="Build Hand" detail="Construct a hand, then continue directly into narration." onClick={onBuild} />
      </div>
    </div>
  );
}

function ChoiceButton({ icon: Icon, label, detail, onClick }: { icon: typeof AudioLines; label: string; detail: string; onClick: () => void }) {
  return <button onClick={onClick} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-[#d4a52c]/35 hover:bg-[#c0911e]/10"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#d4a52c]" /><span><strong className="block text-[11px] font-bold uppercase tracking-wide text-white/85">{label}</strong><span className="mt-1 block text-[10px] leading-relaxed text-white/40">{detail}</span></span></button>;
}
