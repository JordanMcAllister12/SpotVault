// Re-export contact functions from authEngine.
// openConversation is handled at the UI level via profileEvents dispatchMessageUser,
// which routes to the persisted inbox system in profileStore.

export {
  requestContact, acceptContact, declineContact, removeContact,
  getMyContacts, getPendingContactRequests,
  type Contact,
} from '@/lib/authEngine';
