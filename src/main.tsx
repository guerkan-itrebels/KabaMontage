import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import App from './App';
import { dauerhaftenSpeicherAnfragen } from './db/db';
import { ladeFirma } from './db/firma';

registerSW({ immediate: true });
dauerhaftenSpeicherAnfragen();
ladeFirma(); // legt beim ersten Start das Firmenprofil mit Standardwerten an

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
