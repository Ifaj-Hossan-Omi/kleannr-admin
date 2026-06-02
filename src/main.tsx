import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

// Self-hosted variable fonts (CSP-safe: served from 'self', no Google Fonts).
import '@fontsource-variable/manrope';
import '@fontsource-variable/inter';

import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './styles/global.css';

import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClientProvider } from '@tanstack/react-query';

import { theme } from './theme/theme';
import { queryClient } from './lib/queryClient';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="light">
      <Notifications position="top-right" />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </MantineProvider>
  </StrictMode>,
);
