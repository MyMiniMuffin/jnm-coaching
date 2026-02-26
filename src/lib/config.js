import { marked } from 'marked';
import { Home, Utensils, Dumbbell, ClipboardCheck, Camera } from 'lucide-react';

// --- APP CONFIG ---
export const APP_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Crect width='512' height='512' rx='160' fill='%23171717'/%3E%3Cpath d='M256 96c0 88.4 71.6 160 160 160-88.4 0-160 71.6-160 160 0-88.4-71.6-160-160-160 88.4 0 160-71.6 160-160z' fill='%23FAFAF9'/%3E%3C/svg%3E";

// Marked config
if (marked) {
    marked.setOptions({ breaks: true, gfm: true });
}

// Navigation items
export const NAV_ITEMS = [
    { id: 'dashboard', label: 'Hjem', icon: Home },
    { id: 'gallery', label: 'Galleri', icon: Camera },
    { id: 'diet', label: 'Mat', icon: Utensils },
    { id: 'workout', label: 'Trening', icon: Dumbbell },
    { id: 'checkin', label: 'Rapport', icon: ClipboardCheck },
];

// Motiverende sitater
export const QUOTES = [
    { text: "Små steg hver dag fører til store resultater.", author: "Ukjent" },
    { text: "Du trenger ikke være perfekt, bare konsistent.", author: "Ukjent" },
    { text: "Kroppen oppnår det sinnet tror på.", author: "Ukjent" },
    { text: "Fremgang, ikke perfeksjon.", author: "Ukjent" },
    { text: "Den eneste dårlige treningen er den som ikke ble gjort.", author: "Ukjent" },
    { text: "Disiplin er broen mellom mål og resultater.", author: "Jim Rohn" },
];

// CheckIn form constants
export const OPTIONS_1_TO_10 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const OPTIONS_0_TO_7 = [0, 1, 2, 3, 4, 5, 6, 7];
export const INITIAL_FORM_DATA = {
    weight: '', sleep: 5, energy: 5, accuracy: 10,
    strengthSessions: 0, cardioSessions: 0,
    stepsReached: false, takenSupplements: false,
    comment: '', images: []
};

// App state constants
export const INITIAL_DATA_STATE = {
    dietPlan: '', workoutPlan: '', stepGoal: 10000,
    totalWeeks: 12, startDate: null, isPaused: false, pausedAt: null,
    periods: [], currentPeriodId: null, startingWeight: null, checkins: [],
    galleryImages: []
};

export const TAB_ORDER = ['dashboard', 'gallery', 'diet', 'workout', 'checkin'];
