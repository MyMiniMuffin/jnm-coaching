import React from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import '../coaching/coaching.css';
import './onboarding.css';
import OnboardingPage from './OnboardingPage';

createRoot(document.getElementById('root')).render(<OnboardingPage />);
