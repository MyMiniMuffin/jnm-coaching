import './index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from './components/Toast';
import App from './App';

const root = createRoot(document.getElementById('root'));
root.render(<ToastProvider><App /></ToastProvider>);
