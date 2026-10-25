import { supabase } from '@/lib/supabase';

export interface SyncMarker {
  label: string;
  timestamp: number;
  handActionIndex?: number;
}

export interface PresentationRecording {
  id: string;
  title: string;
  media_type: 'audio' | 'video';
  duration_seconds: number;
  file_size_bytes: number;
  storage_path: string | null;
  hand_id: string | null;
  sync_data: SyncMarker[] | null;
  status: string;
  presentation_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecordingAttachment {
  id: string;
  recording_id: string;
  content_spot_id: string | null;
  multispot_id: string | null;
  multispot_member_id: string | null;
  is_intro: boolean;
  created_at: string;
}

async function uploadMediaBlob(
  userId: string,
  recordingId: string,
  blob: Blob,
  mediaType: 'audio' | 'video',
): Promise<string | null> {
  const ext = mediaType === 'audio' ? 'webm' : 'webm';
  const path = `${userId}/${recordingId}.${ext}`;
  const { error } = await supabase.storage
    .from('presentation-media')
    .upload(path, blob, { contentType: blob.type || (mediaType === 'audio' ? 'audio/webm' : 'video/webm') });
  if (error) {
    console.error('[presentationRecordingStore] upload error:', error.message);
    return null;
  }
  return path;
}

export async function createRecording(
  userId: string,
  title: string,
  mediaType: 'audio' | 'video',
  blob: Blob,
  durationSeconds: number,
  handId: string | null,
  syncMarkers: SyncMarker[] | null,
): Promise<PresentationRecording | null> {
  const { data: presId } = await supabase.rpc('sv_generate_presentation_id');

  const { data, error } = await supabase
    .from('sv_presentation_recordings')
    .insert({
      user_id: userId,
      title,
      media_type: mediaType,
      duration_seconds: durationSeconds,
      file_size_bytes: blob.size,
      hand_id: handId,
      sync_data: syncMarkers,
      status: 'processing',
      presentation_id: presId as string | null,
    })
    .select()
    .maybeSingle();

  if (error || !data) {
    console.error('[presentationRecordingStore] insert error:', error?.message);
    return null;
  }

  const recording = data as PresentationRecording;
  const storagePath = await uploadMediaBlob(userId, recording.id, blob, mediaType);

  const { data: updated, error: updateError } = await supabase
    .from('sv_presentation_recordings')
    .update({ storage_path: storagePath, status: 'active', updated_at: new Date().toISOString() })
    .eq('id', recording.id)
    .select()
    .maybeSingle();

  if (updateError || !updated) {
    console.error('[presentationRecordingStore] status update error:', updateError?.message);
    return recording;
  }

  return updated as PresentationRecording;
}

export async function fetchRecordings(handId?: string | null): Promise<PresentationRecording[]> {
  let query = supabase
    .from('sv_presentation_recordings')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (handId !== undefined) {
    query = query.eq('hand_id', handId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[presentationRecordingStore] fetch error:', error.message);
    return [];
  }
  return (data as PresentationRecording[]) ?? [];
}

export async function renameRecording(recordingId: string, newTitle: string): Promise<boolean> {
  const { error } = await supabase
    .from('sv_presentation_recordings')
    .update({ title: newTitle, updated_at: new Date().toISOString() })
    .eq('id', recordingId);
  return !error;
}

export async function deleteRecording(recordingId: string, storagePath: string | null): Promise<boolean> {
  if (storagePath) {
    await supabase.storage.from('presentation-media').remove([storagePath]);
  }
  const { error } = await supabase
    .from('sv_presentation_recordings')
    .delete()
    .eq('id', recordingId);
  return !error;
}

export async function updateSyncData(recordingId: string, syncMarkers: SyncMarker[]): Promise<boolean> {
  const { error } = await supabase
    .from('sv_presentation_recordings')
    .update({ sync_data: syncMarkers, updated_at: new Date().toISOString() })
    .eq('id', recordingId);
  return !error;
}

export async function attachRecordingToSpot(
  recordingId: string,
  spotId: string,
  isIntro = false,
): Promise<boolean> {
  const { error } = await supabase
    .from('sv_presentation_attachments')
    .insert({ recording_id: recordingId, content_spot_id: spotId, is_intro: isIntro });
  return !error;
}

export async function attachRecordingToMultispot(
  recordingId: string,
  multispotId: string,
  memberId?: string,
  isIntro = false,
): Promise<boolean> {
  const { error } = await supabase
    .from('sv_presentation_attachments')
    .insert({
      recording_id: recordingId,
      multispot_id: multispotId,
      multispot_member_id: memberId ?? null,
      is_intro: isIntro,
    });
  return !error;
}

export async function removeAttachment(attachmentId: string): Promise<boolean> {
  const { error } = await supabase
    .from('sv_presentation_attachments')
    .delete()
    .eq('id', attachmentId);
  return !error;
}

export async function fetchRecordingsBySpotId(spotId: string): Promise<Array<PresentationRecording & { attachment_id: string; is_intro: boolean }>> {
  const { data, error } = await supabase
    .from('sv_presentation_attachments')
    .select(`
      id,
      is_intro,
      recording:sv_presentation_recordings!inner(*)
    `)
    .eq('content_spot_id', spotId);
  if (error) {
    console.error('[presentationRecordingStore] fetchBySpot error:', error.message);
    return [];
  }
  return ((data ?? []) as unknown as Array<{ id: string; is_intro: boolean; recording: PresentationRecording }>).map((row) => ({
    ...row.recording,
    attachment_id: row.id,
    is_intro: row.is_intro,
  }));
}

export async function fetchRecordingsByMultispotId(multispotId: string): Promise<Array<PresentationRecording & { attachment_id: string; is_intro: boolean; multispot_member_id: string | null }>> {
  const { data, error } = await supabase
    .from('sv_presentation_attachments')
    .select(`
      id,
      is_intro,
      multispot_member_id,
      recording:sv_presentation_recordings!inner(*)
    `)
    .eq('multispot_id', multispotId);
  if (error) {
    console.error('[presentationRecordingStore] fetchByMultispot error:', error.message);
    return [];
  }
  return ((data ?? []) as unknown as Array<{ id: string; is_intro: boolean; multispot_member_id: string | null; recording: PresentationRecording }>).map((row) => ({
    ...row.recording,
    attachment_id: row.id,
    is_intro: row.is_intro,
    multispot_member_id: row.multispot_member_id,
  }));
}

export async function fetchAttachments(recordingId: string): Promise<RecordingAttachment[]> {
  const { data, error } = await supabase
    .from('sv_presentation_attachments')
    .select('*')
    .eq('recording_id', recordingId);
  if (error) return [];
  return (data as RecordingAttachment[]) ?? [];
}

export function buildPresentationLink(presentationId: string): string {
  const baseUrl = typeof window !== 'undefined' ? `${window.location.origin}` : 'https://thespotvault.com';
  return `${baseUrl}/presentation/${presentationId}`;
}

export async function fetchRecordingByPresentationId(presentationId: string): Promise<PresentationRecording | null> {
  const { data, error } = await supabase
    .from('sv_presentation_recordings')
    .select('*')
    .eq('presentation_id', presentationId)
    .maybeSingle();
  if (error || !data) return null;
  return data as PresentationRecording;
}

export function getRecordingUrl(storagePath: string): string | null {
  const { data } = supabase.storage.from('presentation-media').createSignedUrl(storagePath, 3600);
  return data?.signedUrl ?? null;
}

export async function getRecordingUrlAsync(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('presentation-media')
    .createSignedUrl(storagePath, 3600);
  if (error) {
    console.error('[presentationRecordingStore] signed URL error:', error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}
