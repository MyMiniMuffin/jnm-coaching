import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { Loader2, Pause, Eye, LogOut, ChevronLeft, WifiOff } from 'lucide-react';

// Lib
import { saveSession, getSession, getToken, clearSession, hasValidSession } from './lib/session';
import { api, cache } from './lib/api';
import { APP_ICON, INITIAL_DATA_STATE, TAB_ORDER } from './lib/config';

// Hooks
import { useSwipe, usePullToRefresh, useOnlineStatus } from './hooks';

// Components (eagerly loaded — small and used everywhere)
import { Skeleton, Button } from './components/ui';
import { useToast } from './components/Toast';
import LoginScreen from './components/LoginScreen';
import ReauthPrompt from './components/ReauthPrompt';
import Header from './components/Header';
import Navigation from './components/Navigation';

// Views (lazy loaded — each gets its own chunk)
const CoachDashboard = React.lazy(() => import('./views/CoachDashboard'));
const DashboardView = React.lazy(() => import('./views/DashboardView'));
const WeightProgressView = React.lazy(() => import('./views/WeightProgressView'));
const GalleryView = React.lazy(() => import('./views/GalleryView'));
const PlanSection = React.lazy(() => import('./views/PlanSection'));
const CheckInView = React.lazy(() => import('./views/CheckInView'));

// Error Boundary for lazy-loadede views
class ViewErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    componentDidCatch(error, info) {
        console.error('ViewErrorBoundary fanget feil:', error, info);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center h-[50vh] text-center px-6">
                    <div className="w-16 h-16 bg-red-50 rounded-xl flex items-center justify-center text-red-500 mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    </div>
                    <h2 className="text-lg font-display mb-2">Noe gikk galt</h2>
                    <p className="text-ink-muted text-sm mb-4">Denne visningen kunne ikke lastes.</p>
                    <button
                        className="px-4 py-2 bg-ink text-white rounded-xl text-sm font-medium"
                        onClick={() => this.setState({ hasError: false })}
                    >
                        Prøv igjen
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

// View-spesifikke skeleton loading states
const ViewSkeleton = ({ tab }) => {
    if (tab === 'gallery') return (
        <div className="space-y-4 animate-pulse">
            <div className="flex gap-2">
                {[1,2,3].map(i => <div key={i} className="h-8 w-20 bg-surface-200 rounded-full" />)}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
                {[1,2,3,4,5,6].map(i => <div key={i} className="aspect-square bg-surface-200 rounded-xl" />)}
            </div>
        </div>
    );
    if (tab === 'diet' || tab === 'workout') return (
        <div className="animate-pulse">
            <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
                <div className="p-5 border-b border-surface-100 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-surface-200 rounded-xl" />
                        <div className="h-6 w-24 bg-surface-200 rounded-lg" />
                    </div>
                    <div className="h-8 w-20 bg-surface-200 rounded-xl" />
                </div>
                <div className="p-5 space-y-3">
                    <div className="h-4 bg-surface-200 rounded w-full" />
                    <div className="h-4 bg-surface-200 rounded w-5/6" />
                    <div className="h-4 bg-surface-200 rounded w-4/6" />
                    <div className="h-4 bg-surface-200 rounded w-full" />
                    <div className="h-4 bg-surface-200 rounded w-3/6" />
                </div>
            </div>
        </div>
    );
    if (tab === 'checkin') return (
        <div className="space-y-4 animate-pulse">
            <div className="bg-white rounded-xl border border-surface-200 p-5 space-y-4">
                <div className="h-6 w-32 bg-surface-200 rounded-lg" />
                <div className="h-12 bg-surface-200 rounded-xl" />
                <div className="grid grid-cols-2 gap-4">
                    <div className="h-20 bg-surface-200 rounded-xl" />
                    <div className="h-20 bg-surface-200 rounded-xl" />
                </div>
                <div className="h-12 bg-surface-200 rounded-xl" />
            </div>
        </div>
    );
    // Dashboard default
    return (
        <div className="space-y-4 animate-pulse">
            <div className="h-40 bg-surface-200 rounded-xl" />
            <div className="grid grid-cols-2 gap-4">
                <div className="h-32 bg-surface-200 rounded-xl" />
                <div className="h-32 bg-surface-200 rounded-xl" />
            </div>
            <div className="h-24 bg-surface-200 rounded-xl" />
        </div>
    );
};

// Prefetch alle views i bakgrunnen når browser er idle
const prefetchViews = () => {
    import('./views/DashboardView');
    import('./views/GalleryView');
    import('./views/CheckInView');
    import('./views/PlanSection');
    import('./views/WeightProgressView');
    import('./views/CoachDashboard');
};

const supportsPushNotifications = () => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        return false;
    }
    return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
};

const getNotificationPermission = () => {
    if (!supportsPushNotifications()) {
        return 'unsupported';
    }
    return Notification.permission;
};

const UI_STATE_KEY = 'jnm_ui_state';

const readUiState = () => {
    if (typeof window === 'undefined') return null;
    try {
        const state = localStorage.getItem(UI_STATE_KEY);
        return state ? JSON.parse(state) : null;
    } catch (error) {
        console.error('[UI State] Kunne ikke lese lagret posisjon:', error);
        return null;
    }
};

const saveUiState = (state) => {
    if (typeof window === 'undefined' || !state?.userId) return;
    try {
        localStorage.setItem(UI_STATE_KEY, JSON.stringify({
            ...state,
            scrollY: Math.max(0, Math.round(window.scrollY || document.documentElement.scrollTop || 0)),
            savedAt: Date.now()
        }));
    } catch (error) {
        console.error('[UI State] Kunne ikke lagre posisjon:', error);
    }
};

const clearUiState = () => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.removeItem(UI_STATE_KEY);
    } catch (error) {
        console.error('[UI State] Kunne ikke slette lagret posisjon:', error);
    }
};

const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
};

const App = () => {
    const toast = useToast();
    const isOnline = useOnlineStatus();
    const [currentUser, setCurrentUser] = useState(null);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [allUsers, setAllUsers] = useState([]);
    const [viewingClient, setViewingClient] = useState(null);

    const [isClientLoading, setIsClientLoading] = useState(false);
    const [showWeightHistory, setShowWeightHistory] = useState(false);
    const selectClientRef = useRef(0);

    const [currentData, setCurrentData] = useState(INITIAL_DATA_STATE);
    const [isLoading, setIsLoading] = useState(true);
    const [isUsersLoading, setIsUsersLoading] = useState(false);
    const [showReauthPrompt, setShowReauthPrompt] = useState(false);
    const [notificationPermission, setNotificationPermission] = useState(getNotificationPermission);
    const coachUnreadSnapshotRef = useRef(new Map());
    const hasPrimedCoachNotificationsRef = useRef(false);
    const serviceWorkerRegistrationRef = useRef(null);
    const latestUiStateRef = useRef(null);
    const hasRestoredUiStateRef = useRef(false);
    const restoreScrollYRef = useRef(null);
    const skipNextAthleteFetchRef = useRef(false);

    const deliverCoachCheckinAlert = useCallback((clientsWithNewCheckins) => {
        if (!clientsWithNewCheckins.length) return;

        const totalNewCheckins = clientsWithNewCheckins.reduce((sum, client) => sum + client.delta, 0);
        const firstClient = clientsWithNewCheckins[0]?.name;
        const multipleClients = clientsWithNewCheckins.length > 1;
        const message = multipleClients
            ? `${totalNewCheckins} nye rapporter fra ${clientsWithNewCheckins.length} utøvere`
            : `${firstClient} har sendt inn ${totalNewCheckins > 1 ? `${totalNewCheckins} nye rapporter` : 'en ny rapport'}`;

        toast(message, 'info');

        if (
            typeof window === 'undefined' ||
            !('Notification' in window) ||
            Notification.permission !== 'granted' ||
            document.visibilityState === 'visible'
        ) {
            return;
        }

        const body = multipleClients
            ? clientsWithNewCheckins.map(client => `${client.name}: +${client.delta}`).join(', ')
            : 'Trykk deg inn i appen for å lese rapporten.';

        const notification = new Notification('Ny check-in mottatt', {
            body,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: 'coach-checkin-alert'
        });

        notification.onclick = () => {
            window.focus();
            notification.close();
        };
    }, [toast]);

    const applyUsersList = useCallback((nextUsers, { notify = false } = {}) => {
        setAllUsers(nextUsers);

        setCurrentUser(prevUser => {
            if (!prevUser) return prevUser;
            const refreshedUser = nextUsers.find(user => user.id === prevUser.id);
            return refreshedUser ? { ...prevUser, ...refreshedUser } : prevUser;
        });

        const nextUnreadSnapshot = new Map(
            nextUsers
                .filter(user => user.role === 'athlete')
                .map(user => [user.id, Number(user.unreadCheckins) || 0])
        );

        if (!hasPrimedCoachNotificationsRef.current) {
            coachUnreadSnapshotRef.current = nextUnreadSnapshot;
            hasPrimedCoachNotificationsRef.current = true;
            return;
        }

        if (notify) {
            const clientsWithNewCheckins = nextUsers
                .filter(user => user.role === 'athlete')
                .map(user => {
                    const previousUnread = coachUnreadSnapshotRef.current.get(user.id) || 0;
                    const currentUnread = Number(user.unreadCheckins) || 0;
                    return currentUnread > previousUnread
                        ? { id: user.id, name: user.name, delta: currentUnread - previousUnread }
                        : null;
                })
                .filter(Boolean);

            deliverCoachCheckinAlert(clientsWithNewCheckins);
        }

        coachUnreadSnapshotRef.current = nextUnreadSnapshot;
    }, [deliverCoachCheckinAlert]);

    const requestCoachNotificationPermission = useCallback(async () => {
        if (typeof window === 'undefined' || !('Notification' in window)) {
            toast('Denne enheten støtter ikke systemvarsler', 'error');
            setNotificationPermission('unsupported');
            return;
        }

        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);

        if (permission === 'granted') {
            toast('Systemvarsler er slått på');
        } else if (permission === 'denied') {
            toast('Systemvarsler er blokkert i nettleseren', 'error');
        }
    }, [toast]);

    const ensureCoachPushSubscription = useCallback(async () => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
            throw new Error('Push støttes ikke på denne enheten');
        }

        const vapidPublicKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY;
        if (!vapidPublicKey) {
            throw new Error('Mangler VITE_WEB_PUSH_PUBLIC_KEY');
        }

        // Bruk eksisterende registrering (registreres én gang i useEffect ved oppstart)
        let registration = serviceWorkerRegistrationRef.current;
        if (!registration) {
            registration = await navigator.serviceWorker.ready;
            serviceWorkerRegistrationRef.current = registration;
        }

        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
            });
        }

        const result = await api.savePushSubscription(subscription.toJSON());
        if (result.authError) {
            setShowReauthPrompt(true);
            return;
        }
    }, []);

    const requestCoachPushNotifications = useCallback(async () => {
        if (!supportsPushNotifications()) {
            toast('Denne enheten støtter ikke pushvarsler', 'error');
            setNotificationPermission('unsupported');
            return;
        }

        if (notificationPermission === 'denied') {
            toast('Systemvarsler er blokkert i nettleseren', 'error');
            return;
        }

        let permission = notificationPermission;
        if (permission !== 'granted') {
            permission = await Notification.requestPermission();
            setNotificationPermission(permission);
        }

        if (permission !== 'granted') {
            if (permission === 'denied') {
                toast('Systemvarsler er blokkert i nettleseren', 'error');
            }
            return;
        }

        try {
            await ensureCoachPushSubscription();
            toast('Pushvarsler er aktivert');
        } catch (error) {
            console.error('[Push] Kunne ikke aktivere pushvarsler:', error);
            toast(error.message || 'Kunne ikke aktivere pushvarsler', 'error');
        }
    }, [notificationPermission, ensureCoachPushSubscription, toast]);

    // ============================================
    // FIKSET INIT - Vis UI umiddelbart, oppdater i bakgrunn
    // ============================================
    useEffect(() => {
        const init = async () => {
            console.log('[Init] Starter app...');

            // 1. Sjekk lokal session FØRST - bruk den umiddelbart
            const sessionUser = getSession();
            const token = getToken();

            if (sessionUser && token) {
                console.log('[Init] Bruker cached session:', sessionUser.username);
                setCurrentUser(sessionUser);

                if (sessionUser.role === 'athlete') {
                    skipNextAthleteFetchRef.current = true;
                    setViewingClient(sessionUser);
                    // Start datahenting parallelt (unngå ekstra renderingssyklus)
                    api.getUserData(sessionUser.id).then(result => {
                        if (result.authError) {
                            setShowReauthPrompt(true);
                        } else if (result.data) {
                            setCurrentData(result.data);
                        }
                    }).catch(e => console.error('[Init] Feil ved henting av athlete-data:', e));
                }

                if (sessionUser.role === 'coach') {
                    // Vis evt. cached brukerliste umiddelbart, men ikke vent på nettverket
                    const cachedUsers = cache.get('users-list');
                    if (cachedUsers?.length) {
                        setAllUsers(cachedUsers);
                    }
                    setIsUsersLoading(true);
                    setIsLoading(false);

                    // Hent alltid fersk brukerliste i bakgrunnen
                    api.getUsers(false).then(result => {
                        if (result.authError) {
                            setShowReauthPrompt(true);
                        } else if (result.data) {
                            applyUsersList(result.data);
                        }
                    }).catch(e => console.error('[Init] Feil ved henting av brukerliste:', e))
                      .finally(() => setIsUsersLoading(false));
                    return; // isLoading allerede satt til false
                }
            }

            // Ikke-innlogget eller athlete — hent brukerliste for login
            if (!sessionUser) {
                try {
                    const result = await api.getUsers();
                    if (!result.networkError && !result.authError) {
                        setAllUsers(result.data || []);
                    }
                } catch (e) {
                    // Ikke kritisk for login
                }
            }

            setIsLoading(false);
        };
        init();
    }, [applyUsersList]);

    useEffect(() => {
        setNotificationPermission(getNotificationPermission());
    }, [currentUser?.role]);

    useEffect(() => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
            return;
        }

        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                serviceWorkerRegistrationRef.current = registration;
            })
            .catch(error => {
                console.error('[Push] Kunne ikke registrere service worker:', error);
            });
    }, []);

    // Prefetch view-chunks når appen er lastet (gjør tab-bytte instant)
    useEffect(() => {
        if ('requestIdleCallback' in window) {
            requestIdleCallback(prefetchViews);
        } else {
            setTimeout(prefetchViews, 2000);
        }
    }, []);

    // Visibility change handler - sjekk session når app blir synlig
    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === 'visible' && currentUser) {
                console.log('[Visibility] App ble synlig, sjekker session');
                setNotificationPermission(getNotificationPermission());
                if (!hasValidSession()) {
                    console.warn('[Visibility] Session borte - viser re-auth prompt');
                    setShowReauthPrompt(true);
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [currentUser]);

    useEffect(() => {
        if (currentUser?.role !== 'coach') {
            coachUnreadSnapshotRef.current = new Map();
            hasPrimedCoachNotificationsRef.current = false;
            return;
        }

        let isCancelled = false;

        const refreshUsers = async (notify = true) => {
            try {
                const result = await api.getUsers(false);
                if (isCancelled) return;
                if (result.authError) {
                    setShowReauthPrompt(true);
                    return;
                }
                if (result.data) {
                    applyUsersList(result.data, { notify });
                }
            } catch (error) {
                if (!isCancelled) {
                    console.error('[Coach Poll] Kunne ikke oppdatere brukerliste:', error);
                }
            }
        };

        const intervalId = window.setInterval(() => {
            refreshUsers(true);
        }, 60000);

        refreshUsers(false);

        const handleVisibilityRefresh = () => {
            if (document.visibilityState === 'visible') {
                refreshUsers(true);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityRefresh);

        return () => {
            isCancelled = true;
            window.clearInterval(intervalId);
            document.removeEventListener('visibilitychange', handleVisibilityRefresh);
        };
    }, [currentUser?.role, applyUsersList]);

    useEffect(() => {
        if (currentUser?.role !== 'coach' || notificationPermission !== 'granted') {
            return;
        }

        ensureCoachPushSubscription().catch(error => {
            console.error('[Push] Kunne ikke sikre coach-abonnement:', error);
        });
    }, [currentUser?.role, notificationPermission, ensureCoachPushSubscription]);

    useEffect(() => {
        if (viewingClient && currentUser?.role === 'athlete') {
            if (skipNextAthleteFetchRef.current) {
                skipNextAthleteFetchRef.current = false;
                return;
            }
            setIsClientLoading(true);
            api.getUserData(viewingClient.id, false)
                .then(result => {
                    if (result.authError) {
                        console.warn('[App] Auth-feil ved henting av klientdata');
                        setShowReauthPrompt(true);
                    } else if (result.data) {
                        setCurrentData(result.data);
                    } else if (result.networkError) {
                        console.log('[App] Nettverksfeil - bruker eksisterende data');
                    }
                })
                .catch(() => {
                    console.error('[App] Kunne ikke hente athlete-data');
                })
                .finally(() => setIsClientLoading(false));
        }
    }, [viewingClient, currentUser?.role]);

    const handleLogin = useCallback((user) => {
        hasRestoredUiStateRef.current = false;
        setCurrentUser(user);
        saveSession(user);
        setShowReauthPrompt(false);
        if (user.role === 'athlete') {
            setCurrentData(INITIAL_DATA_STATE);
            setViewingClient(user);
        }
    }, []);

    const handleLogout = useCallback(() => {
        console.log('[App] Bruker logger ut');
        clearSession();
        clearUiState();
        hasRestoredUiStateRef.current = false;
        restoreScrollYRef.current = null;
        setCurrentUser(null);
        setViewingClient(null);
        setShowReauthPrompt(false);
        setActiveTab('dashboard');
    }, []);

    const handleReauth = useCallback(() => {
        console.log('[App] Bruker må logge inn på nytt');
        clearSession();
        clearUiState();
        hasRestoredUiStateRef.current = false;
        restoreScrollYRef.current = null;
        setCurrentUser(null);
        setViewingClient(null);
        setShowReauthPrompt(false);
    }, []);

    const handleNewCheckin = useCallback(async (entry) => {
        if (!viewingClient) return;
        const result = await api.submitCheckin(viewingClient.id, entry);
        if (result.authError) {
            setShowReauthPrompt(true);
            return;
        }
        const savedCheckin = result.data?.checkin;
        if (!savedCheckin) {
            throw new Error('Mangler lagret check-in fra serveren');
        }
        setCurrentData(prev => ({
            ...prev,
            checkins: [savedCheckin, ...prev.checkins]
        }));
    }, [viewingClient]);

    // Ref for å spore pågående lagring og hindre dobbelt-klikk
    const savingRef = React.useRef(false);
    const periodActionSavingRef = React.useRef(false);

    const handleUpdateData = useCallback(async (keyOrObj, value) => {
        if (!viewingClient) return;

        const updates = typeof keyOrObj === 'string' ? { [keyOrObj]: value } : keyOrObj;
        const isPeriodAction = updates?.action === 'create_period' || updates?.action === 'end_period' || updates?.action === 'update_period';

        if (isPeriodAction) {
            if (periodActionSavingRef.current) return;
            periodActionSavingRef.current = true;
        } else {
            if (savingRef.current) return;
            savingRef.current = true;
        }

        let previousData;

        try {
            // Håndter periode-spesifikke actions
            if (updates.action === 'create_period') {
                const result = await api.createPeriod(viewingClient.id, updates.name, updates.startingWeight, updates.goalWeight);
                if (result.authError) { setShowReauthPrompt(true); }
                if (result.data?.period) {
                    const newPeriod = result.data.period;
                    setCurrentData(prev => ({
                        ...prev,
                        periods: [
                            newPeriod,
                            ...(prev.periods || []).map(period => ({ ...period, isActive: false }))
                        ],
                        currentPeriodId: newPeriod.id,
                        startingWeight: newPeriod.startingWeight
                    }));
                }
                return;
            } else if (updates.action === 'end_period') {
                const result = await api.endPeriod(viewingClient.id, updates.periodId);
                if (result.authError) { setShowReauthPrompt(true); }
                else {
                    const endDate = new Date().toISOString();
                    setCurrentData(prev => ({
                        ...prev,
                        periods: (prev.periods || []).map(period =>
                            period.id === updates.periodId
                                ? { ...period, isActive: false, endDate }
                                : period
                        ),
                        currentPeriodId: prev.currentPeriodId === updates.periodId ? null : prev.currentPeriodId
                    }));
                }
                return;
            } else if (updates.action === 'update_period') {
                const { periodId, ...periodUpdates } = updates;
                const result = await api.updatePeriod(viewingClient.id, periodId, periodUpdates);
                if (result.authError) { setShowReauthPrompt(true); }
                else {
                    setCurrentData(prev => {
                        const updatedPeriods = (prev.periods || []).map(period =>
                            period.id === periodId
                                ? {
                                    ...period,
                                    ...(periodUpdates.name !== undefined ? { name: periodUpdates.name.trim() } : {}),
                                    ...(periodUpdates.startDate !== undefined ? { startDate: periodUpdates.startDate || null } : {}),
                                    ...(periodUpdates.endDate !== undefined ? { endDate: periodUpdates.endDate || null } : {}),
                                    ...(periodUpdates.startingWeight !== undefined ? { startingWeight: parseFloat(periodUpdates.startingWeight) } : {}),
                                    ...(periodUpdates.goalWeight !== undefined ? { goalWeight: periodUpdates.goalWeight ? parseFloat(periodUpdates.goalWeight) : null } : {}),
                                    ...(periodUpdates.notes !== undefined ? { notes: periodUpdates.notes } : {})
                                }
                                : period
                        );
                        return {
                            ...prev,
                            periods: updatedPeriods,
                            startingWeight: prev.currentPeriodId === periodId && periodUpdates.startingWeight !== undefined
                                ? parseFloat(periodUpdates.startingWeight)
                                : prev.startingWeight
                        };
                    });
                }
                return;
            } else if (updates.action === 'pause') {
                setCurrentData(prev => {
                    previousData = prev;
                    return { ...prev, isPaused: true, pausedAt: new Date().toISOString() };
                });
                const result = await api.saveUserData(viewingClient.id, updates);
                if (result.authError) {
                    setShowReauthPrompt(true);
                    setCurrentData(previousData);
                }
                return;
            } else if (updates.action === 'resume') {
                setCurrentData(prev => {
                    previousData = prev;
                    return { ...prev, isPaused: false, pausedAt: null };
                });
                const result = await api.saveUserData(viewingClient.id, updates);
                if (result.authError) {
                    setShowReauthPrompt(true);
                    setCurrentData(previousData);
                }
                return;
            }

            // Standard oppdateringer - optimistisk UI med rollback
            setCurrentData(prev => {
                previousData = prev;
                return { ...prev, ...updates };
            });
            const result = await api.saveUserData(viewingClient.id, updates);
            if (result.authError) {
                setShowReauthPrompt(true);
                setCurrentData(previousData);
                return;
            }
            toast('Lagret');
        } catch (e) {
            if (previousData) setCurrentData(previousData);
            toast('Lagring feilet', 'error');
        } finally {
            if (isPeriodAction) {
                periodActionSavingRef.current = false;
            } else {
                savingRef.current = false;
            }
        }
    }, [viewingClient, toast]);

    const handleSaveDietPlan = useCallback((val) => handleUpdateData('dietPlan', val), [handleUpdateData]);
    const handleSaveWorkoutPlan = useCallback((val) => handleUpdateData('workoutPlan', val), [handleUpdateData]);

    const handleDeleteCheckin = useCallback(async (checkinId) => {
        if (!viewingClient) return;
        let previousCheckins;
        setCurrentData(prev => {
            previousCheckins = prev.checkins;
            return { ...prev, checkins: prev.checkins.filter(c => c.id !== checkinId) };
        });
        try {
            const result = await api.deleteCheckin(viewingClient.id, checkinId);
            if (result.authError) {
                setShowReauthPrompt(true);
                setCurrentData(prev => ({ ...prev, checkins: previousCheckins }));
            }
        } catch (e) {
            toast(e.message || 'Kunne ikke slette rapporten', 'error');
            setCurrentData(prev => ({ ...prev, checkins: previousCheckins }));
        }
    }, [viewingClient, toast]);

    const handleClearClient = useCallback(() => {
        setViewingClient(null);
        setActiveTab('dashboard');
    }, []);

    const handleSelectClient = useCallback(async (client, options = {}) => {
        const { preserveView = false } = options;
        const requestId = ++selectClientRef.current;
        const previousData = currentData;
        setViewingClient(client);
        setIsClientLoading(true);
        if (!preserveView) {
            setShowWeightHistory(false);
            setActiveTab('dashboard');
        }

        try {
            const result = await api.getUserData(client.id, false);
            if (requestId !== selectClientRef.current) return; // Avbrutt av nyere klikk
            if (result.authError) {
                setShowReauthPrompt(true);
                setCurrentData(previousData);
                setIsClientLoading(false);
                return;
            }
            if (result.data) {
                setCurrentData(result.data);
            } else if (result.networkError) {
                setCurrentData(previousData);
            }
        } catch (e) {
            if (requestId !== selectClientRef.current) return;
            console.error('Kunne ikke hente klientdata:', e);
            setCurrentData(previousData);
        }

        setIsClientLoading(false);

        if (client.unreadCheckins > 0) {
            const previousUnread = client.unreadCheckins;
            setAllUsers(prev => prev.map(u =>
                u.id === client.id ? { ...u, unreadCheckins: 0 } : u
            ));
            api.markCheckinsRead(client.id).then(result => {
                if (result.authError) {
                    setShowReauthPrompt(true);
                    setAllUsers(prev => prev.map(u =>
                        u.id === client.id ? { ...u, unreadCheckins: previousUnread } : u
                    ));
                }
            }).catch(e => {
                console.error('Kunne ikke markere innsjekk som lest:', e);
                setAllUsers(prev => prev.map(u =>
                    u.id === client.id ? { ...u, unreadCheckins: previousUnread } : u
                ));
            });
        }
    }, [currentData]);

    useEffect(() => {
        if (!currentUser || hasRestoredUiStateRef.current) return;

        const savedState = readUiState();
        if (!savedState || savedState.userId !== currentUser.id) {
            hasRestoredUiStateRef.current = true;
            return;
        }

        const savedTab = TAB_ORDER.includes(savedState.activeTab) ? savedState.activeTab : 'dashboard';
        setActiveTab(savedTab);
        setShowWeightHistory(Boolean(savedState.showWeightHistory));
        restoreScrollYRef.current = Number.isFinite(savedState.scrollY) ? savedState.scrollY : 0;

        if (currentUser.role !== 'coach') {
            hasRestoredUiStateRef.current = true;
            return;
        }

        if (!savedState.viewingClientId) {
            hasRestoredUiStateRef.current = true;
            return;
        }

        const savedClient = allUsers.find(user => user.id === savedState.viewingClientId);
        if (savedClient) {
            hasRestoredUiStateRef.current = true;
            handleSelectClient(savedClient, { preserveView: true });
            return;
        }

        if (!isUsersLoading) {
            hasRestoredUiStateRef.current = true;
        }
    }, [currentUser, allUsers, isUsersLoading, handleSelectClient]);

    useEffect(() => {
        if (!currentUser) {
            latestUiStateRef.current = null;
            return;
        }
        if (!hasRestoredUiStateRef.current || restoreScrollYRef.current !== null) return;

        latestUiStateRef.current = {
            userId: currentUser.id,
            activeTab,
            showWeightHistory,
            viewingClientId: currentUser.role === 'coach' ? viewingClient?.id || null : null
        };

        saveUiState(latestUiStateRef.current);
    }, [currentUser, activeTab, showWeightHistory, viewingClient?.id]);

    useEffect(() => {
        if (!currentUser || !hasRestoredUiStateRef.current || typeof window === 'undefined') return;

        let frameId = null;
        const persistCurrentPosition = () => {
            if (!latestUiStateRef.current) return;
            saveUiState(latestUiStateRef.current);
        };

        const handleScroll = () => {
            if (frameId) return;
            frameId = window.requestAnimationFrame(() => {
                frameId = null;
                persistCurrentPosition();
            });
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('pagehide', persistCurrentPosition);

        return () => {
            if (frameId) window.cancelAnimationFrame(frameId);
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('pagehide', persistCurrentPosition);
        };
    }, [currentUser]);

    useEffect(() => {
        if (restoreScrollYRef.current === null || isLoading || isClientLoading) return;

        const scrollY = restoreScrollYRef.current;
        restoreScrollYRef.current = null;

        let timeoutId = null;
        const restore = () => window.scrollTo({ top: scrollY, behavior: 'instant' });
        const firstFrame = window.requestAnimationFrame(() => {
            restore();
            timeoutId = window.setTimeout(restore, 250);
        });

        return () => {
            window.cancelAnimationFrame(firstFrame);
            if (timeoutId) window.clearTimeout(timeoutId);
        };
    }, [currentUser, activeTab, viewingClient?.id, showWeightHistory, isLoading, isClientLoading, currentData]);

    const handleAddClient = useCallback(async (u) => {
        try {
            const result = await api.createUser({...u, role:'athlete'});
            if (result.authError) {
                setShowReauthPrompt(true);
                return;
            }
            if (result.data) applyUsersList(result.data);
        } catch (e) {
            toast(e.message || 'Feil ved opprettelse av utøver', 'error');
        }
    }, [toast, applyUsersList]);

    const handleDeleteClient = useCallback(async (id) => {
        try {
            const result = await api.deleteUser(id);
            if (result.authError) {
                setShowReauthPrompt(true);
                return;
            }
            if (result.data) applyUsersList(result.data);
            toast('Utøver slettet');
        } catch (e) {
            toast(e.message || 'Feil ved sletting av utøver', 'error');
        }
    }, [toast, applyUsersList]);

    const handleResetPassword = useCallback(async (id, newPassword) => {
        try {
            const result = await api.resetPassword(id, newPassword);
            if (result.authError) {
                setShowReauthPrompt(true);
                return;
            }
            toast('Passord tilbakestilt', 'success');
        } catch (e) {
            toast(e.message || 'Feil ved tilbakestilling av passord', 'error');
        }
    }, [toast]);

    const handleArchiveClient = useCallback(async (id, archive) => {
        try {
            const result = await api.archiveUser(id, archive);
            if (result.authError) {
                setShowReauthPrompt(true);
                return;
            }
            if (result.data) applyUsersList(result.data);
            toast(archive ? 'Utøver arkivert' : 'Utøver gjenopprettet');
        } catch (e) {
            toast(e.message || 'Feil ved arkivering', 'error');
        }
    }, [toast, applyUsersList]);

    const handleAddGalleryImage = useCallback(async (imageUrl, label, date, weight) => {
        if (!viewingClient) return;
        const tempId = 'temp_' + Date.now();
        const optimisticImage = {
            id: tempId,
            url: imageUrl,
            label: label || 'Startbilde',
            date: date || new Date().toISOString().split('T')[0],
            weight: weight ? parseFloat(weight) : null,
            timestamp: Date.now()
        };
        setCurrentData(prev => ({
            ...prev,
            galleryImages: [...(prev.galleryImages || []), optimisticImage]
        }));
        try {
            const result = await api.addGalleryImage(viewingClient.id, imageUrl, label, date, weight);
            if (result.authError) {
                setShowReauthPrompt(true);
                setCurrentData(prev => ({
                    ...prev,
                    galleryImages: (prev.galleryImages || []).filter(img => img.id !== tempId)
                }));
            }
        } catch (e) {
            setCurrentData(prev => ({
                ...prev,
                galleryImages: (prev.galleryImages || []).filter(img => img.id !== tempId)
            }));
            toast('Kunne ikke lagre bildet', 'error');
        }
    }, [viewingClient]);

    const handleDeleteGalleryImage = useCallback(async (imageId) => {
        if (!viewingClient) return;
        let removedImage;
        setCurrentData(prev => {
            removedImage = (prev.galleryImages || []).find(img => img.id === imageId);
            return {
                ...prev,
                galleryImages: (prev.galleryImages || []).filter(img => img.id !== imageId)
            };
        });
        try {
            const result = await api.deleteGalleryImage(viewingClient.id, imageId);
            if (result.authError) {
                setShowReauthPrompt(true);
                if (removedImage) {
                    setCurrentData(prev => ({
                        ...prev,
                        galleryImages: [...(prev.galleryImages || []), removedImage]
                    }));
                }
            }
        } catch (e) {
            if (removedImage) {
                setCurrentData(prev => ({
                    ...prev,
                    galleryImages: [...(prev.galleryImages || []), removedImage]
                }));
            }
            toast('Kunne ikke slette bildet', 'error');
        }
    }, [viewingClient]);

    const handleOpenWeightHistory = useCallback(() => setShowWeightHistory(true), []);
    const handleCloseWeightHistory = useCallback(() => setShowWeightHistory(false), []);

    const handleTabChange = useCallback((tab) => {
        setActiveTab(tab);
        setShowWeightHistory(false);
    }, []);

    // Swipe og pull-to-refresh hooks MÅ være før alle returns
    const currentTabIndex = TAB_ORDER.indexOf(activeTab);

    const handleSwipeLeft = useCallback(() => {
        if (currentTabIndex < TAB_ORDER.length - 1 && !showWeightHistory) {
            setActiveTab(TAB_ORDER[currentTabIndex + 1]);
            window.scrollTo({ top: 0, behavior: 'instant' });
        }
    }, [currentTabIndex, showWeightHistory]);

    const handleSwipeRight = useCallback(() => {
        if (currentTabIndex > 0 && !showWeightHistory) {
            setActiveTab(TAB_ORDER[currentTabIndex - 1]);
            window.scrollTo({ top: 0, behavior: 'instant' });
        } else if (currentTabIndex === 0 && currentUser?.role === 'coach' && viewingClient) {
            handleClearClient();
        }
    }, [currentTabIndex, showWeightHistory, currentUser?.role, viewingClient, handleClearClient]);

    const swipeHandlers = useSwipe(handleSwipeLeft, handleSwipeRight, {
        threshold: 60,
        enabled: !isClientLoading && !showWeightHistory && !!viewingClient
    });

    const handleRefresh = useCallback(async () => {
        if (viewingClient) {
            const result = await api.getUserData(viewingClient.id, false);
            if (result.authError) {
                setShowReauthPrompt(true);
            } else if (result.data) {
                setCurrentData(result.data);
            }
        }
    }, [viewingClient]);

    const { handlers: pullHandlers, pullIndicator } = usePullToRefresh(handleRefresh, {
        enabled: !isClientLoading && !!viewingClient
    });

    if (isLoading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-surface-50">
                <div className="w-20 h-20 mb-5 animate-pulse">
                    <img src={APP_ICON} alt="JNM Coaching logo" className="w-full h-full" />
                </div>
                <Loader2 className="animate-spin text-ink-muted mb-4" size={32} />
                <p className="text-ink-muted font-medium">Laster...</p>
            </div>
        );
    }

    if (!currentUser) return <LoginScreen onLogin={handleLogin} />;

    const isCoach = currentUser.role === 'coach';
    const isArchived = currentUser.is_archived && !isCoach;

    // Arkivert bruker - begrenset tilgang
    if (isArchived) {
        return (
            <div className="max-w-md mx-auto min-h-screen bg-surface-50">
                {showReauthPrompt && <ReauthPrompt onReauth={handleReauth} onLogout={handleLogout} />}
                <Header title="Konto pauset" user={currentUser} onLogout={handleLogout} />
                <main className="p-4">
                    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-6 animate-fade-in">
                        <div className="w-20 h-20 bg-surface-100 rounded-xl flex items-center justify-center text-ink-muted mb-6">
                            <Pause size={40} />
                        </div>
                        <h2 className="text-2xl font-display text-ink mb-3">Kontoen er pauset</h2>
                        <p className="text-ink-muted leading-relaxed mb-8">
                            Din konto er for øyeblikket satt på pause av coachen din.
                            Du kan fortsatt se historikken din, men kan ikke sende inn nye rapporter.
                        </p>

                        <div className="w-full space-y-3">
                            <Button
                                variant="secondary"
                                size="lg"
                                className="w-full"
                                onClick={() => setActiveTab('history')}
                            >
                                <Eye size={18} /> Se historikk
                            </Button>
                            <Button
                                variant="ghost"
                                size="lg"
                                className="w-full"
                                onClick={handleLogout}
                            >
                                <LogOut size={18} /> Logg ut
                            </Button>
                        </div>
                    </div>

                    {activeTab === 'history' && (
                        <div className="fixed inset-0 bg-surface-50 z-50 overflow-auto">
                            <div className="sticky top-0 bg-surface-50/95 backdrop-blur-md border-b border-surface-200 px-4 py-4 flex items-center gap-3">
                                <button onClick={() => setActiveTab('dashboard')} className="p-2 hover:bg-surface-100 rounded-xl">
                                    <ChevronLeft size={24} />
                                </button>
                                <h2 className="text-xl font-display">Din historikk</h2>
                            </div>
                            <div className="p-4 pb-8">
                                <ViewErrorBoundary><Suspense fallback={<ViewSkeleton />}>
                                    <CheckInView
                                        checkins={currentData.checkins}
                                        onNewCheckin={() => {}}
                                        onDelete={() => {}}
                                        isReadOnly={true}
                                        stepGoal={currentData.stepGoal}
                                        hideForm={true}
                                    />
                                </Suspense></ViewErrorBoundary>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        );
    }

    if (isCoach && !viewingClient) {
        return (
            <div className="max-w-md mx-auto min-h-screen bg-surface-50">
                {showReauthPrompt && <ReauthPrompt onReauth={handleReauth} onLogout={handleLogout} />}
                <Header title="Oversikt" user={currentUser} onLogout={handleLogout} />
                <main className="p-4">
                    <ViewErrorBoundary><Suspense fallback={<ViewSkeleton />}>
                        <CoachDashboard
                            user={currentUser}
                            allUsers={allUsers}
                            isLoading={isUsersLoading}
                            notificationPermission={notificationPermission}
                            onEnableNotifications={requestCoachPushNotifications}
                            onSelectClient={handleSelectClient}
                            onAddClient={handleAddClient}
                            onDeleteClient={handleDeleteClient}
                            onArchiveClient={handleArchiveClient}
                            onResetPassword={handleResetPassword}
                        />
                    </Suspense></ViewErrorBoundary>
                </main>
            </div>
        );
    }

    const tabTitles = { dashboard: 'Hjem', gallery: 'Galleri', diet: 'Matplan', workout: 'Trening', checkin: 'Rapport' };

    return (
        <div
            className="max-w-md mx-auto min-h-screen bg-surface-50"
            {...swipeHandlers}
            {...pullHandlers}
        >
            {showReauthPrompt && <ReauthPrompt onReauth={handleReauth} onLogout={handleLogout} />}
            {pullIndicator}
            {!isOnline && (
                <div className="sticky top-0 z-40 bg-amber-500 text-white text-center text-sm py-2 px-4 flex items-center justify-center gap-2">
                    <WifiOff size={14} /> Ingen nettilkobling — viser lagrede data
                </div>
            )}
            <Header
                title={tabTitles[activeTab]}
                user={currentUser}
                viewingClient={isCoach ? viewingClient : null}
                onLogout={handleLogout}
                onClearClient={handleClearClient}
            />
            <main className="p-4">
                {isClientLoading ? (
                    <div className="space-y-4 pt-4">
                        <Skeleton className="h-40 w-full" />
                        <div className="grid grid-cols-2 gap-4">
                            <Skeleton className="h-32 w-full" />
                            <Skeleton className="h-32 w-full" />
                        </div>
                    </div>
                ) : (
                    <ViewErrorBoundary><Suspense fallback={<ViewSkeleton tab={activeTab} />}>
                        <div key={activeTab} className="view-enter">
                            {activeTab === 'dashboard' ? (
                                showWeightHistory ? (
                                    <WeightProgressView
                                        checkins={currentData.checkins}
                                        periods={currentData.periods}
                                        onBack={handleCloseWeightHistory}
                                    />
                                ) : (
                                    <DashboardView userData={currentData} isCoach={isCoach} onUpdateData={handleUpdateData} onOpenWeightHistory={handleOpenWeightHistory} />
                                )
                            ) :
                            activeTab === 'gallery' ? <GalleryView
                                checkins={currentData.checkins}
                                galleryImages={currentData.galleryImages || []}
                                isCoach={isCoach}
                                uploadUserId={viewingClient?.id}
                                onAddGalleryImage={handleAddGalleryImage}
                                onDeleteGalleryImage={handleDeleteGalleryImage}
                            /> :
                            activeTab === 'diet' ? <PlanSection type="diet" content={currentData.dietPlan} onSave={handleSaveDietPlan} isReadOnly={!isCoach} /> :
                            activeTab === 'workout' ? <PlanSection type="workout" content={currentData.workoutPlan} onSave={handleSaveWorkoutPlan} isReadOnly={!isCoach} /> :
                            <CheckInView checkins={currentData.checkins} onNewCheckin={handleNewCheckin} onDelete={handleDeleteCheckin} isReadOnly={isCoach} canDelete={Boolean(viewingClient)} stepGoal={currentData.stepGoal} draftKey={viewingClient?.id || currentUser?.id || 'default'} uploadUserId={viewingClient?.id} />}
                        </div>
                    </Suspense></ViewErrorBoundary>
                )}
            </main>
            <Navigation activeTab={activeTab} setActiveTab={handleTabChange} />
        </div>
    );
};

export default App;
