/// <reference types="node" />
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** apps/web/src, found from the working directory (vitest runs from apps/web or from the repo root). */
export const WEB_SRC = ((): string => {
  const here = join(process.cwd(), 'src');
  return existsSync(join(here, 'features', 'art')) ? here : join(process.cwd(), 'apps', 'web', 'src');
})();
