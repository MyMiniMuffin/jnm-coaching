import './index.css';
// Sync html[data-shell] before React mounts (Tailwind duo: + shell CSS).
import './lib/shellMode';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/ConfirmDialog';
import IconProvider from './components/IconProvider';
import { RailBackProvider } from './lib/railBack';
import App from './App';

// iOS can report display-mode: browser for an installed Home Screen app.
// Detect it before mounting so the first navigation render uses the full height.
document.documentElement.classList.toggle('ios-standalone', navigator.standalone === true);

const root = createRoot(document.getElementById('root'));
root.render(
    <IconProvider>
        <ToastProvider>
            <ConfirmProvider>
                <RailBackProvider>
                    <App />
                </RailBackProvider>
            </ConfirmProvider>
        </ToastProvider>
    </IconProvider>
);
