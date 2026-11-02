import type {
  BattleAbilityInput,
  BattleAnswerResponseDto,
  BattleCreate,
  BattleCreateResultDto,
  BattleDto,
  BattleQuestionResultDto,
  BattleSummaryDto,
  DungeonsDto,
  MissedToCardsResultDto,
  Move,
  CardDto,
  CardInput,
  CardPatch,
  ClaimQuestionDto,
  ClaimResultDto,
  CsvImportResultDto,
  CsvPreviewDto,
  DeckDto,
  ImportPreflightDto,
  ImportReportDto,
  ImportRequest,
  MeDto,
  ProfileDto,
  ProfilePatch,
  ProgressDto,
  QuestClaimResultDto,
  QuestDto,
  ReviewItemDto,
  ReviewResultDto,
  ReviewSubmit,
  SessionCreate,
  SessionDto,
  SessionFinishResultDto,
  SummaryDto,
  TaskCompleteResultDto,
  TaskCreate,
  TaskDto,
  TaskPatch,
} from '@studyverse/shared';
import { supabase } from './supabase';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

/** A readable message for any thrown value (shown to the player, never a stack trace). */
export const errorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : 'Something went wrong. Please try again.';

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const token = (await supabase?.auth.getSession())?.data.session?.access_token;
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Is the API running?');
  }
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    const e = (body as { error?: { code?: string; message?: string; details?: unknown } } | null)
      ?.error;
    throw new ApiError(
      res.status,
      e?.code ?? 'UNKNOWN',
      e?.message ?? `Request failed (${res.status})`,
      e?.details,
    );
  }
  return res;
}

/** Calls the API with the current Supabase access token. Errors use the API's single error shape. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await request(path, init);
  return (await res.json().catch(() => null)) as T;
}

/** Downloads a file response (CSV export) with the auth header. */
export async function apiDownload(path: string): Promise<{ blob: Blob; filename: string }> {
  const res = await request(path);
  const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1];
  return { blob: await res.blob(), filename: name ?? 'studyverse-export.csv' };
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

/** Query string from defined, non-empty values only. */
function qs(params: Record<string, string | number | boolean | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}

export interface TaskFilters {
  status?: 'open' | 'completed' | undefined;
  difficulty?: string | undefined;
  subject?: string | undefined;
}

export const api = {
  me: () => apiFetch<MeDto>('/me'),
  progress: () => apiFetch<{ progress: ProgressDto }>('/progress'),
  /** Counts for the hotbar badges and the HUD session chip (no content, only numbers). */
  summary: () => apiFetch<SummaryDto>('/summary'),
  patchProfile: (patch: ProfilePatch) =>
    apiFetch<{ profile: ProfileDto }>('/profile', json('PATCH', patch)),

  tasks: {
    list: (f: TaskFilters = {}) =>
      apiFetch<{ tasks: TaskDto[] }>(`/tasks${qs({ ...f })}`).then((r) => r.tasks),
    create: (body: TaskCreate) => apiFetch<{ task: TaskDto }>('/tasks', json('POST', body)),
    update: (id: string, patch: TaskPatch) =>
      apiFetch<{ task: TaskDto }>(`/tasks/${id}`, json('PATCH', patch)),
    remove: (id: string) => apiFetch<null>(`/tasks/${id}`, json('DELETE')),
    complete: (id: string) =>
      apiFetch<TaskCompleteResultDto>(`/tasks/${id}/complete`, json('POST')),
    reopen: (id: string) => apiFetch<{ task: TaskDto }>(`/tasks/${id}/reopen`, json('POST')),
  },

  quests: {
    list: () => apiFetch<{ quests: QuestDto[] }>('/quests').then((r) => r.quests),
    claim: (id: string) => apiFetch<QuestClaimResultDto>(`/quests/${id}/claim`, json('POST')),
  },

  reportQuestion: (id: string, reason?: string) =>
    apiFetch<unknown>(`/questions/${id}/report`, json('POST', reason ? { reason } : {})),

  sessions: {
    active: () => apiFetch<{ session: SessionDto | null; serverNow: string }>('/sessions/active'),
    list: (limit = 20) =>
      apiFetch<{ sessions: SessionDto[] }>(`/sessions${qs({ limit })}`).then((r) => r.sessions),
    create: (body: SessionCreate) =>
      apiFetch<{ session: SessionDto }>('/sessions', json('POST', body)).then((r) => r.session),
    createReview: (deckId?: string) =>
      apiFetch<{ session: SessionDto }>(
        '/sessions/review',
        json('POST', { startNow: true, ...(deckId ? { deckId } : {}) }),
      ).then((r) => r.session),
    action: (id: string, action: 'start' | 'pause' | 'resume' | 'abandon') =>
      apiFetch<{ session: SessionDto }>(`/sessions/${id}/${action}`, json('POST')).then(
        (r) => r.session,
      ),
    finish: (id: string, focusRatio?: number) =>
      apiFetch<SessionFinishResultDto>(
        `/sessions/${id}/finish`,
        json('POST', focusRatio === undefined ? {} : { focusRatio }),
      ),
    remove: (id: string) => apiFetch<null>(`/sessions/${id}`, json('DELETE')),
    claimQuiz: (id: string) =>
      apiFetch<{ session: SessionDto; questions: ClaimQuestionDto[] }>(`/sessions/${id}/claim`),
    claim: (id: string, answers: { position: number; selectedIndex: number }[]) =>
      apiFetch<ClaimResultDto>(`/sessions/${id}/claim`, json('POST', { answers })),
  },

  decks: {
    list: () => apiFetch<{ decks: DeckDto[] }>('/decks').then((r) => r.decks),
    create: (body: { name: string; subject: string }) =>
      apiFetch<{ deck: DeckDto }>('/decks', json('POST', body)).then((r) => r.deck),
    update: (id: string, patch: { name?: string; subject?: string }) =>
      apiFetch<{ deck: DeckDto }>(`/decks/${id}`, json('PATCH', patch)).then((r) => r.deck),
    remove: (id: string) => apiFetch<null>(`/decks/${id}`, json('DELETE')),
    cards: (id: string) =>
      apiFetch<{ cards: CardDto[] }>(`/decks/${id}/cards`).then((r) => r.cards),
    addCards: (id: string, cards: CardInput[]) =>
      apiFetch<{ cards: CardDto[] }>(`/decks/${id}/cards`, json('POST', { cards })).then(
        (r) => r.cards,
      ),
    csvPreview: (id: string, csv: string) =>
      apiFetch<CsvPreviewDto>(`/decks/${id}/csv/preview`, json('POST', { csv })),
    csvImport: (id: string, csv: string) =>
      apiFetch<CsvImportResultDto>(`/decks/${id}/csv/import`, json('POST', { csv })),
    csvExport: (id: string | null, includeReview: boolean) =>
      apiDownload(
        `${id ? `/decks/${id}/csv` : '/flashcards/csv'}${qs({ includeReview: includeReview || undefined })}`,
      ),
  },

  cards: {
    update: (id: string, patch: CardPatch) =>
      apiFetch<{ card: CardDto }>(`/cards/${id}`, json('PATCH', patch)).then((r) => r.card),
    remove: (id: string) => apiFetch<null>(`/cards/${id}`, json('DELETE')),
    due: (deckId?: string, limit = 20) =>
      apiFetch<{ items: ReviewItemDto[]; dueTotal: number; serverNow: string }>(
        `/flashcards/due${qs({ deckId, limit })}`,
      ),
    review: (id: string, body: ReviewSubmit) =>
      apiFetch<ReviewResultDto>(`/cards/${id}/review`, json('POST', body)),
  },

  battles: {
    /** `key` is the Idempotency-Key: reuse one key per click so a double click starts one battle. */
    start: (body: BattleCreate, key: string) =>
      apiFetch<BattleCreateResultDto>('/battles', { ...json('POST', body), headers: { 'Idempotency-Key': key } }),
    get: (id: string) => apiFetch<{ battle: BattleDto }>(`/battles/${id}`).then((r) => r.battle),
    active: () => apiFetch<{ battle: BattleDto | null }>('/battles/active').then((r) => r.battle),
    move: (id: string, turnNumber: number, move: Move) =>
      apiFetch<BattleQuestionResultDto>(`/battles/${id}/move`, json('POST', { turnNumber, move })),
    ability: (id: string, turnNumber: number, ability: BattleAbilityInput['ability']) =>
      apiFetch<{ battle: BattleDto }>(`/battles/${id}/ability`, json('POST', { turnNumber, ability })).then((r) => r.battle),
    answer: (id: string, turnNumber: number, selectedIndex: number) =>
      apiFetch<BattleAnswerResponseDto>(`/battles/${id}/answer`, json('POST', { turnNumber, selectedIndex })),
    retreat: (id: string) => apiFetch<{ battle: BattleDto }>(`/battles/${id}/retreat`, json('POST')).then((r) => r.battle),
    finish: (id: string) => apiFetch<{ summary: BattleSummaryDto }>(`/battles/${id}/finish`, json('POST')).then((r) => r.summary),
    missedToCards: (id: string) => apiFetch<MissedToCardsResultDto>(`/battles/${id}/missed-to-flashcards`, json('POST')),
    dungeons: () => apiFetch<DungeonsDto>('/dungeons'),
  },

  import: {
    preflight: () => apiFetch<ImportPreflightDto>('/import/local/preflight'),
    run: (body: ImportRequest) =>
      apiFetch<{ report: ImportReportDto }>('/import/local', json('POST', body)).then(
        (r) => r.report,
      ),
  },
};
