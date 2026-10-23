import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './preview.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);

// PWA: offline + install. Production builds only (the dev server would cache stale modules).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => { /* optional feature */ });
  });
}
