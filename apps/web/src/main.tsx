import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { createRouter } from './router';
import './styles/global.css';

const queryClient = new QueryClient();
const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={createRouter()} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
