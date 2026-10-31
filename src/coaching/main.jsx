import React from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import './coaching.css';
import IconProvider from '../components/IconProvider';
import CoachingLandingPage from './CoachingLandingPage';

createRoot(document.getElementById('root')).render(
    <IconProvider>
        <CoachingLandingPage />
    </IconProvider>
);
