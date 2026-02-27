import './index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/ConfirmDialog';
import App from './App';

const root = createRoot(document.getElementById('root'));
root.render(<ToastProvider><ConfirmProvider><App /></ConfirmProvider></ToastProvider>);
