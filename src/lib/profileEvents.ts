// Global event system for opening profiles from anywhere in the app.
//
// Two-phase dispatch: the primary event fires synchronously to all listeners.
// If a FeedFlipCard (or any inline profile host) is mounted, it calls
// markProfileHandled() during dispatch. After dispatch returns, if nobody
// claimed the event, a fallback event fires so the App-level ProfileViewer
// overlay opens instead.
//
// This is order-independent: it does not rely on capture/bubble phase or
// listener registration order, which the DOM interleaves at the target.

const OPEN_PROFILE_EVENT = 'spotvault-open-profile';
const OPEN_PROFILE_FALLBACK_EVENT = 'spotvault-open-profile-fallback';
const MESSAGE_USER_EVENT = 'spotvault-message-user';
const OPEN_MESSAGING_EVENT = 'spotvault-open-messaging';
const OPEN_PROFILE_SETTINGS_EVENT = 'spotvault-open-profile-settings';

export type ProfileSettingsTab = 'profile' | 'account-security' | 'rewards';

let _profileHandled = false;

/** Called by inline profile hosts (FeedFlipCard) to claim the event. */
export function markProfileHandled() {
  _profileHandled = true;
}

export function dispatchOpenProfile(accountId: string, isOwn: boolean = false) {
  _profileHandled = false;
  window.dispatchEvent(new CustomEvent(OPEN_PROFILE_EVENT, { detail: { accountId, isOwn }, cancelable: true }));
  if (!_profileHandled) {
    window.dispatchEvent(new CustomEvent(OPEN_PROFILE_FALLBACK_EVENT, { detail: { accountId, isOwn } }));
  }
}

export function dispatchMessageUser(accountId: string) {
  window.dispatchEvent(new CustomEvent(MESSAGE_USER_EVENT, { detail: { accountId } }));
}

export function dispatchOpenMessaging(tab?: 'chats' | 'inbox' | 'groups' | 'activity') {
  window.dispatchEvent(new CustomEvent(OPEN_MESSAGING_EVENT, { detail: { tab } }));
}

export function dispatchOpenProfileSettings(tab: ProfileSettingsTab = 'profile') {
  _pendingProfileSettingsTab = tab;
  window.dispatchEvent(new CustomEvent(OPEN_PROFILE_SETTINGS_EVENT, { detail: { tab } }));
}

let _pendingProfileSettingsTab: ProfileSettingsTab | null = null;

export function consumePendingProfileSettingsTab(): ProfileSettingsTab | null {
  const tab = _pendingProfileSettingsTab;
  _pendingProfileSettingsTab = null;
  return tab;
}

export function onOpenProfileSettings(handler: (tab: ProfileSettingsTab) => void) {
  const listener = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    handler(detail.tab);
  };
  window.addEventListener(OPEN_PROFILE_SETTINGS_EVENT, listener);
  return () => window.removeEventListener(OPEN_PROFILE_SETTINGS_EVENT, listener);
}

/** Subscribe to the fallback — fires only when no inline host claimed the event. */
export function onOpenProfileFallback(handler: (accountId: string, isOwn: boolean) => void) {
  const listener = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    handler(detail.accountId, detail.isOwn);
  };
  window.addEventListener(OPEN_PROFILE_FALLBACK_EVENT, listener);
  return () => window.removeEventListener(OPEN_PROFILE_FALLBACK_EVENT, listener);
}

export function onMessageUser(handler: (accountId: string) => void) {
  const listener = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    handler(detail.accountId);
  };
  window.addEventListener(MESSAGE_USER_EVENT, listener);
  return () => window.removeEventListener(MESSAGE_USER_EVENT, listener);
}

export function onOpenMessaging(handler: (tab?: 'chats' | 'inbox' | 'groups' | 'activity') => void) {
  const listener = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    handler(detail.tab);
  };
  window.addEventListener(OPEN_MESSAGING_EVENT, listener);
  return () => window.removeEventListener(OPEN_MESSAGING_EVENT, listener);
}
