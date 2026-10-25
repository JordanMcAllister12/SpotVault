const OPEN_GIFT_EVENT = 'spotvault-open-gift-modal';

export interface GiftModalRequest {
  recipientId: string;
  recipientName: string;
  recipientAvatar?: string;
}

export function dispatchOpenGiftModal(req: GiftModalRequest) {
  window.dispatchEvent(new CustomEvent(OPEN_GIFT_EVENT, { detail: req }));
}

export function onOpenGiftModal(handler: (req: GiftModalRequest) => void): () => void {
  const listener = (e: Event) => {
    const ce = e as CustomEvent<GiftModalRequest>;
    handler(ce.detail);
  };
  window.addEventListener(OPEN_GIFT_EVENT, listener);
  return () => window.removeEventListener(OPEN_GIFT_EVENT, listener);
}
