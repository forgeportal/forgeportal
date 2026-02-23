import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// Initialize plugin registry BEFORE first render
import './plugins/index.js';
import { PluginProvider } from './plugins/PluginContext.js';
import App from './App.js';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <PluginProvider>
        <App />
      </PluginProvider>
    </QueryClientProvider>
  </StrictMode>,
);
