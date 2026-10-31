import React from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import '../coaching/coaching.css';
import './onboarding.css';
import IconProvider from '../components/IconProvider';
import OnboardingPage from './OnboardingPage';

createRoot(document.getElementById('root')).render(
    <IconProvider>
        <OnboardingPage />
    </IconProvider>
);
