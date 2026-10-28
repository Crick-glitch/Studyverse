import { respond, runningSession, finishedSession } from '/home/claude/work/repo/apps/web/scripts/mock-api.mjs';
// Shape the app's SummaryDto requires (packages/shared/src/schemas/summary.ts)
const KEYS = ['activeSession','claimableQuests','dueCards','energy','serverNow','unspentSkillPoints'];
const check = (name, s, expect) => {
  const keys = Object.keys(s).sort().join();
  const ok = keys === KEYS.join() && expect(s);
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  ' + JSON.stringify(s)));
};
const get = (sc) => respond('GET', '/api/v1/summary', sc);
check('default: due 12, 1 quest, energy 4, 2 skill points, no session', get({}), s => s.dueCards===12 && s.claimableQuests===1 && s.energy===4 && s.unspentSkillPoints===2 && s.activeSession===null);
const run = get({ session: runningSession() });
check('hud-session: running session appears as activeSession (780 s left, 1500 planned)', run, s => s.activeSession?.status==='running' && s.activeSession.remainingSec===780 && s.activeSession.plannedSeconds===1500);
check('hotbar-quiet: scenario.summary zeroes every count (no session)', get({ summary: { dueCards:0, claimableQuests:0, energy:0, unspentSkillPoints:0 } }), s => s.dueCards===0 && s.claimableQuests===0 && s.energy===0 && s.unspentSkillPoints===0 && s.activeSession===null);
check('a finished session is NOT reported as active', get({ session: finishedSession() }), s => s.activeSession===null);
// the /me mock must have what the HUD reads
const me = respond('GET','/api/v1/me',{});
console.log((me?.profile?.displayName && me?.progress?.xpForNextLevel>0 ? 'PASS ' : 'FAIL ') + '/me has displayName and xpForNextLevel for the HUD');
console.log((respond('GET','/api/v1/nope',{})===undefined ? 'PASS ' : 'FAIL ') + 'unknown routes return undefined (-> 404 in route-shots)');
