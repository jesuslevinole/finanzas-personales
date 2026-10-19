import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import { AuthProvider } from './context/AuthProvider';
import { DataProvider } from './context/DataProvider';
import { ConfirmProvider } from './context/ConfirmProvider';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <DataProvider>
          <ConfirmProvider>
            <App />
          </ConfirmProvider>
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
