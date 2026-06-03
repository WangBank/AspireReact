import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import App from './App.tsx';
import { StoreProvider } from './stores/StoreProvider';

registerSW({
  immediate: true,
  onRegisterError(error) {
    console.error('PWA 注册失败', error);
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <StoreProvider>
        <App />
      </StoreProvider>
    </BrowserRouter>
  </StrictMode>,
);
