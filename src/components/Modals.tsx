import { X, ShieldCheck, FileText, Lock, DollarSign, ArrowRight } from 'lucide-react';

interface PublishModalProps {
  open: boolean;
  onClose: () => void;
  onPublish: () => void;
}

export function PublishModal({ open, onClose, onPublish }: PublishModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#050608]/80 backdrop-blur-sm">
      <div className="metal-frame-raised brushed-metal clip-bevel relative w-[460px] max-w-[94vw] rounded-2xl p-8">
        <button onClick={onClose} className="absolute right-4 top-4 rounded-lg border border-[#232a32] bg-[#161b21] p-2 text-[#84929f] transition-all hover:border-[#38424e] hover:text-[#c7cfd8]">
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>

        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-[#d4a52c]" strokeWidth={1.5} />
          <h2 className="text-base font-bold tracking-tight text-white">Publish to Inner Circle?</h2>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-[#5f6e7c]">
          This will distribute this content to the shared poker industry feed. All members will see it in the Inner Circle.
        </p>

        <div className="mt-5 space-y-2.5 rounded-lg border border-[#1a1f25] bg-[#11151a]/50 p-4">
          <Row label="Title" value="Kevin Martin: The Future of Poker Content" />
          <Row label="Source" value={<span className="rounded border border-[#2a323b] bg-[#11151a] px-1.5 py-0.5 text-[8px] font-mono font-medium tracking-widest text-[#aab6c2] uppercase">MEDIA</span>} />
          <Row label="Author" value="Jeff Platt" />
          <Row label="Status" value={<span className="flex items-center gap-1.5 text-emerald-300"><ShieldCheck className="h-3.5 w-3.5" /> Verified Publisher</span>} />
        </div>

        <div className="mt-6 flex gap-2">
          <button
            onClick={onPublish}
            className="flex-1 rounded-lg border border-[#c0911e]/50 bg-gradient-to-b from-[#c0911e]/20 to-[#835e17]/20 py-3 text-[10px] font-semibold tracking-[0.2em] text-[#f5e6b0] uppercase transition-all hover:gold-glow"
          >
            Publish
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-[#232a32] bg-[#161b21] py-3 text-[10px] font-semibold tracking-[0.2em] text-[#84929f] uppercase transition-all hover:border-[#38424e] hover:text-[#c7cfd8]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

interface RestrictedPublishModalProps {
  open: boolean;
  onClose: () => void;
}

export function RestrictedPublishModal({ open, onClose }: RestrictedPublishModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#050608]/80 backdrop-blur-sm">
      <div className="metal-frame-raised brushed-metal clip-bevel relative w-[500px] max-w-[94vw] rounded-2xl p-8">
        <button onClick={onClose} className="absolute right-4 top-4 rounded-lg border border-[#232a32] bg-[#161b21] p-2 text-[#84929f] transition-all hover:border-[#38424e] hover:text-[#c7cfd8]">
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>

        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-[#d4a52c]" strokeWidth={1.5} />
          <h2 className="text-base font-bold tracking-tight text-white">Publish to Inner Circle</h2>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-[#5f6e7c]">
          Publishing to the primary industry feed requires publishing access.
        </p>

        <div className="mt-5 space-y-3">
          <div className="rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/8 p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-[#d4a52c]" strokeWidth={1.5} />
              <span className="text-xs font-semibold text-[#f5e6b0]">Use Credits to Submit</span>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-[#5f6e7c]">
              Paid submissions are subject to moderation and approval.
            </p>
            <button className="mt-3 flex items-center gap-1.5 rounded-lg border border-[#c0911e]/40 bg-[#c0911e]/15 px-3 py-1.5 text-[10px] font-semibold tracking-widest text-[#f5e6b0] uppercase transition-all hover:bg-[#c0911e]/25">
              Use Credits <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
            </button>
          </div>

          <div className="rounded-lg border border-[#1a1f25] bg-[#11151a]/50 p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#aab6c2]" strokeWidth={1.5} />
              <span className="text-xs font-semibold text-white">Request Publishing Access</span>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-[#5f6e7c]">
              Apply for verified publisher status. Reviewed by SpotVault industry moderators.
            </p>
            <button className="mt-3 flex items-center gap-1.5 rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-1.5 text-[10px] font-semibold tracking-widest text-[#aab6c2] uppercase transition-all hover:border-[#38424e]">
              Request Access <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-lg border border-[#232a32] bg-[#161b21] py-3 text-[10px] font-semibold tracking-[0.2em] text-[#84929f] uppercase transition-all hover:border-[#38424e] hover:text-[#c7cfd8]"
        >
          Cancel
        </button>

        <div className="mt-4 text-center text-[10px] font-mono tracking-[0.3em] text-[#364049] uppercase">
          Demo Only · No Payment Processed
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase">{label}</span>
      <span className="text-xs font-semibold text-white">{value}</span>
    </div>
  );
}
