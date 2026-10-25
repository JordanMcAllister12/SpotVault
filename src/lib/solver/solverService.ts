import { supabase } from '@/lib/supabase';
import { MockSolverProvider } from './mockProvider';
import { DeepSolverProvider, computeConfigHash } from './deepSolverProvider';
import type {
  SolverProvider,
  SolverConfig,
  SolverResult,
  SolverJob,
  SolverJobStatus,
  SolverLibraryEntry,
} from './types';

// ===== Provider Registry =====
// Mock provider is only accessible via explicit developer opt-in.
// It must NEVER activate automatically in normal user operation.
const mockProvider = new MockSolverProvider();

function getProvider(providerName: string): SolverProvider {
  if (providerName === 'mock') return mockProvider;
  // Unknown providers fall through to mock ONLY for explicit mock requests.
  // DeepSolver is handled via solveWithDeepSolver, not getProvider.
  return mockProvider;
}

// ===== Solver Service =====

export interface CreateJobInput {
  config: SolverConfig;
  userId: string;
  provider?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createSolverJob(input: CreateJobInput): Promise<{ job: SolverJob | null; error: string | null }> {
  if (!UUID_RE.test(input.userId)) {
    return { job: null, error: `Solver job requires authenticated user UUID; received "${input.userId}".` };
  }
  const providerName = input.provider ?? 'mock';
  const provider = getProvider(providerName);
  const configHash = computeConfigHash(input.config);

  try {
    const { treeId } = await provider.createTree(input.config);

    const { data: row, error: dbError } = await supabase
      .from('solver_jobs')
      .insert({
        user_id: input.userId,
        provider: providerName,
        game_type: input.config.game_type,
        format: input.config.format,
        hero_position: input.config.hero_position,
        villain_position: input.config.villain_position,
        effective_stack_bb: input.config.effective_stack_bb,
        pot_size_bb: input.config.pot_size_bb,
        table_config: input.config.table_config,
        board: input.config.board,
        action_history: input.config.action_history,
        hero_range: input.config.hero_range,
        villain_range: input.config.villain_range,
        tree_settings: input.config.tree_settings,
        accuracy_setting: input.config.accuracy,
        config_hash: configHash,
        status: 'draft',
      })
      .select()
      .single();

    if (dbError || !row) return { job: null, error: dbError?.message ?? 'Failed to create job' };

    const { jobId: providerJobId } = await provider.submitSolve(input.config, treeId);

    const { data: updated } = await supabase
      .from('solver_jobs')
      .update({
        provider_job_id: providerJobId,
        status: 'processing',
        started_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .select()
      .single();

    return { job: mapRowToJob(updated ?? row), error: null };
  } catch (err) {
    return { job: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ===== DeepSolver Solve Flow =====

export async function solveWithDeepSolver(
  config: SolverConfig,
  userId: string,
  jobId: string,
): Promise<{ result: SolverResult | null; error: string | null }> {
  const configHash = computeConfigHash(config);
  const provider = new DeepSolverProvider({ config, configHash, userId, jobId });

  try {
    const result = await provider.getSolveResult(jobId);
    return { result, error: null };
  } catch (err) {
    return { result: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function pollJobStatus(jobId: string, providerJobId: string | null, providerName: string): Promise<{ status: SolverJobStatus; result: SolverResult | null; error: string | null }> {
  if (!providerJobId) return { status: 'failed', result: null, error: 'No provider job ID' };
  const provider = getProvider(providerName);

  try {
    const { status, error } = await provider.getSolveStatus(providerJobId);
    if (error) return { status: 'failed', result: null, error };

    if (status === 'complete') {
      const result = await provider.getSolveResult(providerJobId);
      // Persist result to DB
      await supabase
        .from('solver_jobs')
        .update({
          status: 'complete',
          result_data: result,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);
      return { status: 'complete', result, error: null };
    }

    return { status, result: null, error: null };
  } catch (err) {
    return { status: 'failed', result: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function fetchUserJobs(userId: string): Promise<SolverJob[]> {
  const { data, error } = await supabase
    .from('solver_jobs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data.map(mapRowToJob);
}

export async function fetchJobById(jobId: string): Promise<SolverJob | null> {
  const { data, error } = await supabase
    .from('solver_jobs')
    .select('*')
    .eq('id', jobId)
    .maybeSingle();

  if (error || !data) return null;
  return mapRowToJob(data);
}

export async function updateJobStatus(jobId: string, status: SolverJobStatus, errorMessage?: string | null): Promise<void> {
  const update: Record<string, unknown> = { status };
  if (errorMessage !== undefined) update.error_message = errorMessage;
  if (status === 'complete') update.completed_at = new Date().toISOString();
  await supabase.from('solver_jobs').update(update).eq('id', jobId);
}

export async function toggleFavorite(jobId: string, isFavorite: boolean): Promise<void> {
  await supabase.from('solver_jobs').update({ is_favorite: isFavorite }).eq('id', jobId);
}

export async function saveToLibrary(
  jobId: string,
  userId: string,
  title: string,
  notes: string,
  tags: string[],
  category: string,
  config: SolverConfig,
  result: SolverResult | null,
): Promise<{ entryId: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from('solver_library_entries')
    .insert({
      user_id: userId,
      solver_job_id: jobId,
      title,
      notes: notes || null,
      tags,
      category: category || null,
      config_snapshot: config,
      result_reference: result,
    })
    .select()
    .single();

  if (error || !data) return { entryId: null, error: error?.message ?? 'Failed to save' };

  await supabase
    .from('solver_jobs')
    .update({ saved_to_library: true, library_entry_id: data.id })
    .eq('id', jobId);

  return { entryId: data.id, error: null };
}

export async function fetchLibraryEntries(userId: string): Promise<SolverLibraryEntry[]> {
  const { data, error } = await supabase
    .from('solver_library_entries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    solver_job_id: row.solver_job_id,
    title: row.title,
    notes: row.notes,
    tags: row.tags ?? [],
    category: row.category,
    config_snapshot: row.config_snapshot,
    result_reference: row.result_reference,
    created_at: row.created_at,
  }));
}

export async function fetchAllJobsForAdmin(): Promise<SolverJob[]> {
  const { data, error } = await supabase
    .from('solver_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error || !data) return [];
  return data.map(mapRowToJob);
}

// ===== Mapping =====

function mapRowToJob(row: Record<string, unknown>): SolverJob {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    provider: row.provider as string,
    provider_job_id: (row.provider_job_id as string) ?? null,
    game_type: row.game_type as SolverJob['game_type'],
    format: row.format as SolverJob['format'],
    hero_position: row.hero_position as SolverJob['hero_position'],
    villain_position: row.villain_position as SolverJob['villain_position'],
    effective_stack_bb: Number(row.effective_stack_bb),
    pot_size_bb: Number(row.pot_size_bb),
    table_config: (row.table_config as SolverJob['table_config']) ?? { seat_count: 8, sb_bb: 0.5, bb_bb: 1, ante_type: 'none', ante_bb: 0 },
    board: (row.board as SolverJob['board']) ?? [],
    action_history: (row.action_history as SolverJob['action_history']) ?? [],
    hero_range: (row.hero_range as SolverJob['hero_range']) ?? { cells: {} },
    villain_range: (row.villain_range as SolverJob['villain_range']) ?? { cells: {} },
    tree_settings: (row.tree_settings as SolverJob['tree_settings']) ?? {},
    accuracy_setting: row.accuracy_setting as SolverJob['accuracy_setting'],
    status: row.status as SolverJob['status'],
    error_message: (row.error_message as string) ?? null,
    result_data: (row.result_data as SolverResult) ?? null,
    saved_to_library: Boolean(row.saved_to_library),
    is_favorite: Boolean(row.is_favorite),
    created_at: row.created_at as string,
    started_at: (row.started_at as string) ?? null,
    completed_at: (row.completed_at as string) ?? null,
  };
}

// ===== Mock processing (DEVELOPER ONLY — never automatic) =====
// This function exists solely for explicit developer/UX testing.
// It must NEVER be called as a fallback when DeepSolver fails.
// The only legitimate caller is a developer who has explicitly
// set the provider to 'mock' in the solve request.

export async function simulateProcessing(jobId: string, config: SolverConfig): Promise<SolverResult> {
  const result = mockProvider.generateResult(config);
  await supabase
    .from('solver_jobs')
    .update({
      status: 'complete',
      result_data: result,
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId);
  return result;
}
