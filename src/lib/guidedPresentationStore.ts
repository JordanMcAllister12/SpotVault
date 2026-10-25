import { supabase } from '@/lib/supabase';

export type PresentationStatus = 'draft' | 'published';
export type PresentationCueType =
  | 'action_reaches_hero'
  | 'next_action'
  | 'deal_flop'
  | 'deal_turn'
  | 'deal_river'
  | 'pause_hand'
  | 'resume_hand'
  | 'hand_event'
  | 'visual';

export interface GuidedPresentation {
  id: string;
  hand_id: string;
  creator_id: string;
  title: string;
  status: PresentationStatus;
  audio_storage_path: string | null;
  audio_duration: number | null;
  video_storage_path: string | null;
  video_duration: number | null;
  multi_spot_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PresentationCue {
  id: string;
  presentation_id: string;
  creator_id: string;
  timestamp_seconds: number;
  end_timestamp_seconds: number | null;
  cue_type: PresentationCueType;
  hand_event_index: number | null;
  media_id: string | null;
  label: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface PresentationMedia {
  id: string;
  presentation_id: string;
  creator_id: string;
  file_path: string;
  title: string;
  caption: string | null;
  media_type: 'image';
  created_at: string;
  signed_url?: string;
}

export interface PresentationComment {
  id: string;
  presentation_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

const PRESENTATION_BUCKET = 'presentation-media';
const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const AUDIO_TYPES = new Set(['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav']);
const VIDEO_TYPES = new Set(['video/webm', 'video/mp4', 'video/ogg', 'video/quicktime']);
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

function extensionFor(file: File, fallback: string): string {
  return file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || fallback;
}

export async function createGuidedPresentation(handId: string, title = 'Guided Presentation'): Promise<GuidedPresentation> {
  const { data, error } = await supabase
    .from('guided_presentations')
    .insert({ hand_id: handId, title: title.trim() || 'Guided Presentation' })
    .select('*')
    .maybeSingle();
  if (error || !data) throw new Error('Could not create the presentation.');
  return data as GuidedPresentation;
}

export async function fetchGuidedPresentation(id: string): Promise<GuidedPresentation | null> {
  const { data, error } = await supabase.from('guided_presentations').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error('Could not load the presentation.');
  return data as GuidedPresentation | null;
}

export async function fetchPresentationForHand(handId: string): Promise<GuidedPresentation | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Please sign in before opening Presentation Mode.');
  const { data, error } = await supabase
    .from('guided_presentations')
    .select('*')
    .eq('hand_id', handId)
    .eq('creator_id', userData.user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error('Could not load the presentation.');
  return data as GuidedPresentation | null;
}

export async function updateGuidedPresentation(id: string, patch: Partial<Pick<GuidedPresentation, 'title' | 'status' | 'audio_storage_path' | 'audio_duration' | 'video_storage_path' | 'video_duration' | 'multi_spot_id'>>): Promise<void> {
  const { error } = await supabase.from('guided_presentations').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error('Could not save the presentation.');
}

export async function fetchPresentationCues(presentationId: string): Promise<PresentationCue[]> {
  const { data, error } = await supabase.from('guided_presentation_cues').select('*').eq('presentation_id', presentationId).order('timestamp_seconds', { ascending: true });
  if (error) throw new Error('Could not load presentation cues.');
  return (data ?? []) as PresentationCue[];
}

export async function createPresentationCue(input: Omit<PresentationCue, 'id' | 'creator_id' | 'created_at'>): Promise<PresentationCue> {
  const { data, error } = await supabase.from('guided_presentation_cues').insert(input).select('*').maybeSingle();
  if (error || !data) throw new Error('Could not add that cue.');
  return data as PresentationCue;
}

export async function updatePresentationCue(id: string, patch: Partial<Pick<PresentationCue, 'timestamp_seconds' | 'end_timestamp_seconds' | 'cue_type' | 'hand_event_index' | 'media_id' | 'label' | 'metadata'>>): Promise<void> {
  const { error } = await supabase.from('guided_presentation_cues').update(patch).eq('id', id);
  if (error) throw new Error('Could not update that cue.');
}

export async function deletePresentationCue(id: string): Promise<void> {
  const { error } = await supabase.from('guided_presentation_cues').delete().eq('id', id);
  if (error) throw new Error('Could not delete that cue.');
}

export async function fetchPresentationMedia(presentationId: string): Promise<PresentationMedia[]> {
  const { data, error } = await supabase.from('guided_presentation_media').select('*').eq('presentation_id', presentationId).order('created_at', { ascending: true });
  if (error) throw new Error('Could not load presentation media.');
  return Promise.all(((data ?? []) as PresentationMedia[]).map(async (media) => ({
    ...media,
    signed_url: await signedPresentationUrl(media.file_path),
  })));
}

export async function uploadPresentationAudio(presentationId: string, file: File, duration: number): Promise<string> {
  if (!AUDIO_TYPES.has(file.type) || file.size > MAX_AUDIO_BYTES) throw new Error('Use an audio file under 50 MB.');
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Please sign in before saving a presentation.');
  const path = `${userData.user.id}/${presentationId}/audio-${Date.now()}.${extensionFor(file, 'webm')}`;
  const { error: uploadError } = await supabase.storage.from(PRESENTATION_BUCKET).upload(path, file, { upsert: false, contentType: file.type });
  if (uploadError) throw new Error('Could not upload the recording.');
  await updateGuidedPresentation(presentationId, { audio_storage_path: path, audio_duration: duration });
  return path;
}

export async function uploadPresentationImage(presentationId: string, file: File, title: string): Promise<PresentationMedia> {
  if (!IMAGE_TYPES.has(file.type) || file.size > MAX_IMAGE_BYTES) throw new Error('Use a PNG, JPG, WEBP, or GIF image under 10 MB.');
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Please sign in before uploading media.');
  const path = `${userData.user.id}/${presentationId}/image-${Date.now()}.${extensionFor(file, 'png')}`;
  const { error: uploadError } = await supabase.storage.from(PRESENTATION_BUCKET).upload(path, file, { upsert: false, contentType: file.type });
  if (uploadError) throw new Error('Could not upload that image.');
  const { data, error } = await supabase.from('guided_presentation_media').insert({ presentation_id: presentationId, file_path: path, title: title.trim() || file.name }).select('*').maybeSingle();
  if (error || !data) throw new Error('Could not save that presentation image.');
  return { ...(data as PresentationMedia), signed_url: await signedPresentationUrl(path) };
}

export async function signedPresentationUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(PRESENTATION_BUCKET).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) throw new Error('Could not load presentation media.');
  return data.signedUrl;
}

export async function uploadPresentationVideo(presentationId: string, file: File, duration: number): Promise<string> {
  if (!VIDEO_TYPES.has(file.type) || file.size > MAX_VIDEO_BYTES) throw new Error('Use a video file (WebM, MP4) under 200 MB.');
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Please sign in before saving a presentation.');
  const path = `${userData.user.id}/${presentationId}/video-${Date.now()}.${extensionFor(file, 'webm')}`;
  const { error: uploadError } = await supabase.storage.from(PRESENTATION_BUCKET).upload(path, file, { upsert: false, contentType: file.type });
  if (uploadError) throw new Error('Could not upload the video.');
  await updateGuidedPresentation(presentationId, { video_storage_path: path, video_duration: duration });
  return path;
}

export async function signedPresentationVideoUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(PRESENTATION_BUCKET).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) throw new Error('Could not load presentation video.');
  return data.signedUrl;
}

export function isVideoFileSupported(file: File): boolean {
  return VIDEO_TYPES.has(file.type) && file.size <= MAX_VIDEO_BYTES;
}

export async function deletePresentationMedia(media: PresentationMedia): Promise<void> {
  const { error: rowError } = await supabase.from('guided_presentation_media').delete().eq('id', media.id);
  if (rowError) throw new Error('Could not remove that image.');
  await supabase.storage.from(PRESENTATION_BUCKET).remove([media.file_path]);
}

export async function fetchPresentationComments(presentationId: string): Promise<PresentationComment[]> {
  const { data, error } = await supabase.from('guided_presentation_comments').select('*').eq('presentation_id', presentationId).order('created_at', { ascending: true });
  if (error) throw new Error('Could not load comments.');
  return (data ?? []) as PresentationComment[];
}

export async function addPresentationComment(presentationId: string, body: string): Promise<PresentationComment> {
  const trimmed = body.trim();
  if (!trimmed || trimmed.length > 2000) throw new Error('Enter a comment under 2,000 characters.');
  const { data, error } = await supabase.from('guided_presentation_comments').insert({ presentation_id: presentationId, body: trimmed }).select('*').maybeSingle();
  if (error || !data) throw new Error('Could not add your comment.');
  return data as PresentationComment;
}

export async function deleteGuidedPresentation(id: string): Promise<void> {
  const { error } = await supabase.from('guided_presentations').delete().eq('id', id);
  if (error) throw new Error('Could not delete the presentation.');
}

export async function createGuidedPresentationForMultiSpot(handId: string, multiSpotId: string, title = 'Guided Presentation'): Promise<GuidedPresentation> {
  const { data, error } = await supabase
    .from('guided_presentations')
    .insert({ hand_id: handId, multi_spot_id: multiSpotId, title: title.trim() || 'Guided Presentation' })
    .select('*')
    .maybeSingle();
  if (error || !data) throw new Error('Could not create the presentation.');
  return data as GuidedPresentation;
}

export async function fetchPresentationForMultiSpot(multiSpotId: string): Promise<GuidedPresentation | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Please sign in before opening Presentation Mode.');
  const { data, error } = await supabase
    .from('guided_presentations')
    .select('*')
    .eq('multi_spot_id', multiSpotId)
    .eq('creator_id', userData.user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error('Could not load the presentation.');
  return data as GuidedPresentation | null;
}

export function isAudioFileSupported(file: File): boolean {
  return AUDIO_TYPES.has(file.type) && file.size <= MAX_AUDIO_BYTES;
}

export function isImageFileSupported(file: File): boolean {
  return IMAGE_TYPES.has(file.type) && file.size <= MAX_IMAGE_BYTES;
}
