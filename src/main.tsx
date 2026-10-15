import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { PRIVACY_PATH, PrivacyPolicy } from './PublicPages';
import './styles.css';

const isPrivacyPage = window.location.pathname.replace(/\/$/, '') === PRIVACY_PATH;

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isPrivacyPage ? <PrivacyPolicy /> : <App />}</StrictMode>,
);
