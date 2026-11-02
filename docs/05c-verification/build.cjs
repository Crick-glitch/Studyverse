const esbuild = require('/home/claude/.npm-global/lib/node_modules/tsx/node_modules/esbuild');
const G = '/home/claude/.npm-global/lib/node_modules';
const R = '/home/claude/work/repo';
// entry.tsx imports ./global-nofont.css: the app's real global.css without the @import lines (fonts are not installable offline; tokens.css is imported separately).
require('fs').writeFileSync('/tmp/h/global-nofont.css', require('fs').readFileSync(R + '/apps/web/src/styles/global.css', 'utf8').split('\n').filter((l) => !l.startsWith('@import')).join('\n'));
esbuild.build({
  entryPoints: ['/tmp/h/entry.tsx'], bundle: true, outfile: '/tmp/h/out/app.js', format: 'iife', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"development"' }, logLevel: 'error', sourcemap: false,
  loader: { '.module.css': 'local-css', '.css': 'css' },
  nodePaths: [G],
  alias: { 'react-router-dom': '/tmp/h/rr.tsx', '@tanstack/react-query': '/tmp/h/rq.tsx', 'lucide-react': '/tmp/h/lucide.tsx', zod: '/tmp/h/zod.ts',
    '@studyverse/shared': R + '/packages/shared/src/index.ts' },
  plugins: [{ name: 'stubs', setup(b) {
    b.onResolve({ filter: /^@fontsource\// }, () => ({ path: '/tmp/h/empty.css' }));
    b.onResolve({ filter: /lib\/api$/ }, () => ({ path: '/tmp/h/stubs-api.ts' }));
    b.onResolve({ filter: /auth\/AuthContext$/ }, () => ({ path: '/tmp/h/stubs-auth.ts' }));
    b.onResolve({ filter: /features\/import\/LocalImportPrompt$/ }, () => ({ path: '/tmp/h/stubs-null.tsx' }));
  } }],
}).then(() => console.log('built')).catch(() => process.exit(1));
