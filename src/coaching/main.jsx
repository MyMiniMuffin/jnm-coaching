import React from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import './coaching.css';
import IconProvider from '../components/IconProvider';
import CoachingLandingPage from './CoachingLandingPage';
import { hasValidSession } from '../lib/session';

// This page is the front page on jnmcoaching.no/. Signed-in clients and the
// coach (including home-screen apps saved before the app moved to /app/) go
// straight to the app; ?forside shows the front page anyway.
const showFrontPage = window.location.pathname !== '/'
    || new URLSearchParams(window.location.search).has('forside')
    || !hasValidSession();

if (showFrontPage) {
    createRoot(document.getElementById('root')).render(
        <IconProvider>
            <CoachingLandingPage />
        </IconProvider>
    );
} else {
    window.location.replace('/app/');
}
