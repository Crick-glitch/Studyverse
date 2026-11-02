import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from '/home/claude/work/repo/apps/web/src/layouts/AppLayout';
import '/home/claude/work/repo/apps/web/src/styles/tokens.css';
import './global-nofont.css';
const params = new URLSearchParams(location.search);
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider><MemoryRouter initial={params.get('path') ?? '/quests'}><AppLayout /></MemoryRouter></QueryClientProvider>,
);
