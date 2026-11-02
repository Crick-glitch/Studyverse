const esbuild = require('/home/claude/.npm-global/lib/node_modules/tsx/node_modules/esbuild');
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const R = '/home/claude/work/repo';
const files = process.argv.slice(2);
(async () => {
  const entry = files.map((f, i) => `import '${f}';`).join('\n') + `\nimport { tests, hooks } from '/tmp/t/vitest-shim.js'; window.__run = async () => { const out = []; for (const t of tests) { try { await t.fn(); out.push([t.name, null]); } catch (e) { out.push([t.name, String(e.message)]); } for (const h of hooks) h(); } return out; };`;
  require('fs').writeFileSync('/tmp/t/entry.ts', entry);
  await esbuild.build({ entryPoints: ['/tmp/t/entry.ts'], bundle: true, outfile: '/tmp/t/out.js', format: 'iife', jsx: 'automatic', logLevel: 'error',
    define: { 'process.env.NODE_ENV': '"test"' }, nodePaths: ['/home/claude/.npm-global/lib/node_modules'], loader: { '.module.css': 'local-css', '.css': 'css' },
    alias: { 'react-router-dom': '/tmp/t/rr-clean.tsx', '@tanstack/react-query': '/tmp/h/rq.tsx', vitest: '/tmp/t/vitest-shim.js', zod: '/tmp/h/zod.ts', '@studyverse/shared': R + '/packages/shared/src/index.ts' },
    plugins: [{ name: 'x', setup(b) { b.onResolve({ filter: /\/player\.js$/ }, () => ({ path: '/tmp/t/player-stub.ts' })); b.onResolve({ filter: /^@fontsource\// }, () => ({ path: '/tmp/h/empty.css' })); } }] });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage(); page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.setContent('<body></body>'); await page.addScriptTag({ path: '/tmp/t/out.js' });
  const res = await page.evaluate(() => window.__run());
  let bad = 0; for (const [n, e] of res) { if (e) { bad++; console.log('FAIL', n, '\n     ', e); } }
  console.log(`${res.length - bad}/${res.length} passed`); await browser.close(); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e.message); process.exit(2); });
