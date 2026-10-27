export const tests = []; const stack = []; const after = [];
export const describe = (name, fn) => { stack.push(name); fn(); stack.pop(); };
const mk = (name, fn) => tests.push({ name: [...stack, name].join(' > '), fn });
export const it = mk; export const test = mk;
const fmt = (name, args) => { let i = 0; return name.replace(/%s/g, () => String(args[i++])); };
it.each = (rows) => (name, fn) => rows.forEach((r) => { const args = Array.isArray(r) ? r : [r]; mk(fmt(name, args), () => fn(...args)); });
export const afterEach = (f) => after.push(f); export const beforeEach = () => {}; export const vi = {};
export const hooks = after;
const eq = (a, b) => { if (Object.is(a, b)) return true; if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false; if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a).filter((k) => a[k] !== undefined), kb = Object.keys(b).filter((k) => b[k] !== undefined); return ka.length === kb.length && ka.every((k) => eq(a[k], b[k])); };
const sub = (a, b) => { if (typeof b !== 'object' || !b) return Object.is(a, b); if (typeof a !== 'object' || !a) return false; return Object.keys(b).every((k) => sub(a[k], b[k])); };
export const expect = (actual, msg = '') => { const f = (ok, what) => { if (!ok) throw new Error(`${msg ? msg + ': ' : ''}expected ${JSON.stringify(actual)} ${what}`); };
  return { toBe: (e) => f(Object.is(actual, e), `toBe ${JSON.stringify(e)}`), toEqual: (e) => f(eq(actual, e), `toEqual ${JSON.stringify(e)}`),
    toBeNull: () => f(actual === null, 'toBeNull'), toBeTruthy: () => f(!!actual, 'toBeTruthy'), toMatchObject: (e) => f(sub(actual, e), `toMatchObject ${JSON.stringify(e)}`),
    toBeUndefined: () => f(actual === undefined, 'toBeUndefined'), toBeDefined: () => f(actual !== undefined, 'toBeDefined'), toMatch: (e) => f(e.test(actual), `toMatch ${e}`), toBeGreaterThan: (e) => f(actual > e, `> ${e}`), toHaveLength: (e) => f(actual.length === e, `toHaveLength ${e}`), toBeFalsy: () => f(!actual, 'toBeFalsy'), toBeLessThan: (e) => f(actual < e, `< ${e}`),
    toContain: (e) => f(actual.includes(e), `toContain ${JSON.stringify(e)}`), toBeGreaterThanOrEqual: (e) => f(actual >= e, `>= ${e}`), toBeLessThanOrEqual: (e) => f(actual <= e, `<= ${e}`) }; };
