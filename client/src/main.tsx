import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
import { initSentry, reactErrorHandlers } from '@/lib/sentry';
import '@/styles/globals.css';

initSentry();

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root not found');
}

createRoot(container, reactErrorHandlers).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
