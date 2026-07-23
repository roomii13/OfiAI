/**
 * @archivo main.tsx
 * @descripcion Punto de entrada de la aplicación web OfiAI.
 * Monta la aplicación React en el DOM.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
