import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import './index.css';
import App from './App.tsx';
import { StoreProvider } from './stores/StoreProvider';
import { appTheme } from './theme';
import { installApiFetchInterceptors } from './utils/installApiFetchInterceptors';

installApiFetchInterceptors();

registerSW({
  immediate: true,
  onRegisterError(error) {
    console.error('PWA 注册失败', error);
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <BrowserRouter>
        <StoreProvider>
          <App />
        </StoreProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
