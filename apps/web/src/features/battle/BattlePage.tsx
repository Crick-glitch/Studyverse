import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MOVE_TEXT, type BattleDto, type Move } from '@studyverse/shared';
import { api, ApiError } from '../../lib/api';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { ErrorState, Skeleton } from '../../ui/StateViews';
import { PixelButton } from '../art/kit/PixelButton';
import { PixelPanel } from '../art/kit/PixelPanel';
import kit from '../art/kit/kit.module.css';
import { BattleField } from './BattleField';
import { AbilityBar, BattleLog, FeedbackPanel, HeroSheet, MovePanel, QuestionPanel } from './BattlePanels';
import { battleKeyAction } from './battleKeys';
import { AUTO_STEADY_KEY, SOUND_KEY, useStoredToggle } from './battlePrefs';
import { initialView, reduce } from './battleReducer';
import { playBattleEvent } from './battleSound';
import { RewardsScreen } from './RewardsScreen';
import styles from './battle.module.css';

const NARROW = '(max-width: 700px)';
const message = (e: unknown): string => (e instanceof ApiError || e instanceof Error ? e.message : 'Something went wrong. Please try again.');
/** The server says the screen is out of step with the battle (409): re-read the battle rather than guess. */
const outOfStep = (e: unknown): boolean => e instanceof ApiError && e.status === 409;

function BattleScreen({ id }: { id: string }) {
  const [view, dispatch] = useReducer(reduce, initialView);
  const [autoSteady, setAutoSteady] = useStoredToggle(AUTO_STEADY_KEY, false);
  const [sound, setSound] = useStoredToggle(SOUND_KEY, true);
  const [confirmRetreat, setConfirmRetreat] = useState(false);
  const [addedMessage, setAddedMessage] = useState<string | null>(null);
  const narrow = useMediaQuery(NARROW);
  const mid = useMediaQuery('(max-width: 1000px)');
  const scale = narrow ? 2 : 3;
  const finishing = useRef(false);
  const [finishTry, setFinishTry] = useState(0);

  // GET /battles/:id resumes from server state; it is read once (after that the reducer owns the view).
  const load = useQuery({ queryKey: ['battle', id], queryFn: () => api.battles.get(id), retry: false, gcTime: 0, staleTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false });
  useEffect(() => {
    if (load.data && view.stage === 'loading') dispatch({ type: 'loaded', battle: load.data });
  }, [load.data, view.stage]);

  const moveM = useMutation({ mutationFn: (v: { turn: number; move: Move }) => api.battles.move(id, v.turn, v.move) });
  const abilityM = useMutation({ mutationFn: (v: { turn: number; ability: 'cleave' | 'bulwark' | 'insight' }) => api.battles.ability(id, v.turn, v.ability) });
  const answerM = useMutation({ mutationFn: (v: { turn: number; index: number }) => api.battles.answer(id, v.turn, v.index) });
  const retreatM = useMutation({ mutationFn: () => api.battles.retreat(id) });
  const finishM = useMutation({ mutationFn: () => api.battles.finish(id) });
  const missedM = useMutation({ mutationFn: () => api.battles.missedToCards(id) });

  const battle = view.battle;
  const resync = useCallback(async (e: unknown) => {
    if (!outOfStep(e)) return dispatch({ type: 'failed', message: message(e) });
    try {
      dispatch({ type: 'resync', battle: await api.battles.get(id) });
    } catch (e2) {
      dispatch({ type: 'failed', message: message(e2) });
    }
  }, [id]);

  const chooseMove = useCallback(async (m: Move) => {
    if (!battle || view.busy || view.step !== 'awaitingMove') return;
    dispatch({ type: 'requestStarted' });
    try {
      const r = await moveM.mutateAsync({ turn: battle.turn, move: m });
      dispatch({ type: 'moveOk', battle: r.battle });
    } catch (e) {
      await resync(e);
    }
  }, [battle, view.busy, view.step, moveM, resync]);

  const answer = useCallback(async (index: number) => {
    if (!battle || view.busy || view.step !== 'awaitingAnswer') return;
    dispatch({ type: 'answerSent', index });
    try {
      const r = await answerM.mutateAsync({ turn: battle.turn, index });
      dispatch({ type: 'answerOk', result: r.result, battle: r.battle });
    } catch (e) {
      await resync(e);
    }
  }, [battle, view.busy, view.step, answerM, resync]);

  const armAbility = useCallback(async () => {
    const a = battle?.abilities[0];
    if (!battle || !a || !a.available || view.busy) return;
    dispatch({ type: 'requestStarted' });
    try {
      dispatch({ type: 'abilityOk', battle: await abilityM.mutateAsync({ turn: battle.turn, ability: a.key }) });
    } catch (e) {
      await resync(e);
    }
  }, [battle, view.busy, abilityM, resync]);

  const retreat = async () => {
    try {
      dispatch({ type: 'retreatOk', battle: await retreatM.mutateAsync() });
      setConfirmRetreat(false);
    } catch (e) {
      setConfirmRetreat(false);
      await resync(e);
    }
  };

  // Rewards: ask the server to pay (idempotent), then show its summary.
  useEffect(() => {
    if (view.stage !== 'rewards' || view.summary || finishing.current) return;
    finishing.current = true;
    finishM.mutate(undefined, {
      onSuccess: (s) => dispatch({ type: 'summaryOk', summary: s }),
      onError: (e) => {
        finishing.current = false;
        dispatch({ type: 'failed', message: message(e) });
      },
    });
  }, [view.stage, view.summary, finishM, finishTry]);

  // Auto-Steady ("skip tactics"): the client sends Steady every turn. It gives no advantage.
  useEffect(() => {
    if (autoSteady && view.stage === 'play' && view.step === 'awaitingMove' && !view.busy && !view.error && battle?.phase === 'awaitingMove') {
      void chooseMove('steady');
    }
  }, [autoSteady, view.stage, view.step, view.busy, view.error, battle?.phase, battle?.turn, chooseMove]);

  // Keyboard: Q/W/E highlight, Enter confirms or continues, 1-3 answer, A ability.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const act = battleKeyAction(e, { stage: view.stage, step: view.step, busy: view.busy || confirmRetreat, choiceCount: battle?.question?.choices.length ?? 0 });
      if (!act) return;
      e.preventDefault();
      if (act.kind === 'move') dispatch({ type: 'selectMove', move: act.move });
      else if (act.kind === 'confirmMove') void chooseMove(view.move);
      else if (act.kind === 'answer') void answer(act.index);
      else if (act.kind === 'continue') dispatch({ type: 'continue' });
      else void armAbility();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view.stage, view.step, view.busy, view.move, confirmRetreat, battle?.question, chooseMove, answer, armAbility]);

  const onFxDone = useCallback((ids: number[]) => dispatch({ type: 'clearFx', ids }), []);
  const addMissed = () => missedM.mutate(undefined, {
    onSuccess: (r) => setAddedMessage(r.added > 0 ? `Added ${r.added} ${r.added === 1 ? 'card' : 'cards'} to the deck "${r.deckName}"${r.skipped > 0 ? ` (${r.skipped} already there)` : ''}. Find it in the Library.` : 'Those questions are already in your flashcards.'),
    onError: (e) => setAddedMessage(message(e)),
  });

  if (load.isError && view.stage === 'loading') {
    const notFound = load.error instanceof ApiError && load.error.status === 404;
    return (
      <div className={styles.centerPage}>
        <ErrorState message={notFound ? 'This battle was not found. It may belong to another account, or it no longer exists.' : message(load.error)} onRetry={notFound ? undefined : () => void load.refetch()} />
        <Link to="/dungeons" className={kit.button}>Back to Adventure</Link>
      </div>
    );
  }
  if (!battle || view.stage === 'loading') {
    return <div className={styles.centerPage}><Skeleton lines={4} label="Loading the battle" /></div>;
  }

  const over = view.stage === 'rewards';
  const kind = battle.enemy.isBoss ? 'boss' : battle.mode;
  const live: BattleDto = battle;
  return (
    <div className={styles.screen} data-battle style={{ ['--s' as string]: scale }}>
      <div className={styles.column}>
        <header className={styles.topbar}>
          <div className={styles.where}>
            <h1 className={styles.dungeon}>{live.dungeon.name}</h1>
            <span className={styles.badge} data-kind={kind}>{kind === 'boss' ? 'Boss raid' : kind === 'raid' ? 'Raid' : 'Practice'}</span>
            <span className={styles.panelNote}>{live.subject} · {over ? 'Finished' : `Turn ${live.turn}`}</span>
          </div>
          {over ? null : (
            <div className={styles.controls}>
              <label className={styles.toggle}><input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} /> Sound</label>
              <label className={styles.toggle} title="Always choose Steady. Gives no advantage."><input type="checkbox" checked={autoSteady} onChange={(e) => setAutoSteady(e.target.checked)} /> Auto-Steady</label>
              <PixelButton variant="danger" className={kit.small} disabled={view.busy} onClick={() => setConfirmRetreat(true)}>Retreat</PixelButton>
            </div>
          )}
        </header>

        {over ? (
          view.summary ? (
            <RewardsScreen summary={view.summary} onAddMissed={addMissed} addedMessage={addedMessage} adding={missedM.isPending} />
          ) : view.error ? (
            <ErrorState message={view.error} onRetry={() => { dispatch({ type: 'dismissError' }); setFinishTry((n) => n + 1); }} />
          ) : (
            <Skeleton lines={5} label="Counting your rewards" />
          )
        ) : (
          <>
            <BattleField battle={live} fx={view.fx} onFxDone={onFxDone} scale={scale} narrow={narrow} mid={mid} intro={view.stage === 'intro'} onBegin={() => dispatch({ type: 'begin' })} onEvent={(e) => { if (sound) playBattleEvent(e); }} />
            <PixelPanel tone="parchment" className={styles.panel} aria-label="Your turn">
              {view.step === 'awaitingMove' ? (
                <>
                  <div className={styles.panelHead}>
                    <h2 className={styles.panelTitle}>Choose your move</h2>
                    <span className={styles.panelNote}>Pick before you see the question · {live.intent.name}: {live.intent.effect}</span>
                  </div>
                  <MovePanel selected={view.move} busy={view.busy} autoSteady={autoSteady} onChoose={(m) => void chooseMove(m)} onSelect={(m) => dispatch({ type: 'selectMove', move: m })} />
                  <div className={styles.below}>
                    <AbilityBar battle={live} busy={view.busy} onUse={() => void armAbility()} />
                    {autoSteady ? null : <span className={styles.panelNote}>Keys: Q W E highlight · Enter confirms {MOVE_TEXT[view.move].label}</span>}
                  </div>
                </>
              ) : view.step === 'feedback' && view.feedback ? (
                <FeedbackPanel result={view.feedback} question={view.answered} ended={live.phase === 'ended' || live.status !== 'active'} onContinue={() => dispatch({ type: 'continue' })} />
              ) : live.question ? (
                <>
                  <QuestionPanel question={live.question} removedIndex={live.removedIndex} picked={view.picked} resolving={view.step === 'resolving'} combo={live.combo} move={live.move} onAnswer={(i) => void answer(i)} />
                  <div className={styles.below}>
                    <AbilityBar battle={live} busy={view.busy} onUse={() => void armAbility()} />
                    <span className={styles.panelNote}>Keys: 1 2 3 answer</span>
                  </div>
                </>
              ) : (
                <Skeleton lines={3} label="Loading the question" />
              )}
              {view.error ? (
                <div className={styles.error} role="alert">
                  <span>{view.error}</span>
                  <PixelButton className={kit.small} onClick={() => dispatch({ type: 'dismissError' })}>Dismiss</PixelButton>
                </div>
              ) : null}
              <HeroSheet hero={live.hero} />
              <BattleLog log={live.log} />
            </PixelPanel>
          </>
        )}
      </div>
      {confirmRetreat ? (
        <ConfirmDialog title="Retreat from this battle?" confirmLabel="Retreat" onConfirm={() => void retreat()} onCancel={() => setConfirmRetreat(false)} busy={retreatM.isPending}>
          {live.mode === 'raid' ? 'You earn nothing from this fight and the 3 energy you spent is not refunded.' : 'Practice costs no energy, but you earn no XP for a battle you leave.'} Your flashcard reviews so far are kept.
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

/** `/battle/:battleId`: its own layout, no HUD, hotbar or camp panel (see BattleLayout). */
export function BattlePage() {
  const { battleId = '' } = useParams();
  return <BattleScreen key={battleId} id={battleId} />;
}
