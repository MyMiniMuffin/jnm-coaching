import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, Pause, Eye, LogOut, ChevronLeft } from 'lucide-react';

// Lib
import { saveSession, getSession, getToken, clearSession, hasValidSession } from './lib/session';
import { api } from './lib/api';
import { INITIAL_DATA_STATE, TAB_ORDER } from './lib/config';

// Hooks
import { useSwipe, usePullToRefresh } from './hooks';

// Components
import { Skeleton, Button } from './components/ui';
import { useToast } from './components/Toast';
import LoginScreen from './components/LoginScreen';
import ReauthPrompt from './components/ReauthPrompt';
import Header from './components/Header';
import Navigation from './components/Navigation';

// Views
import CoachDashboard from './views/CoachDashboard';
import DashboardView from './views/DashboardView';
import WeightProgressView from './views/WeightProgressView';
import GalleryView from './views/GalleryView';
import PlanSection from './views/PlanSection';
import CheckInView from './views/CheckInView';

const App = () => {
    const toast = useToast();
    const [currentUser, setCurrentUser] = useState(null);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [allUsers, setAllUsers] = useState([]);
    const [viewingClient, setViewingClient] = useState(null);

    const [isClientLoading, setIsClientLoading] = useState(false);
    const [showWeightHistory, setShowWeightHistory] = useState(false);

    const [currentData, setCurrentData] = useState(INITIAL_DATA_STATE);
    const [isLoading, setIsLoading] = useState(true);
    const [showReauthPrompt, setShowReauthPrompt] = useState(false);

    // ============================================
    // FIKSET INIT - Bruker cached session først
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
                    setViewingClient(sessionUser);
                }
            }

            // 2. Hent oppdatert brukerliste (kun for coach — atleter trenger den ikke)
            if (!sessionUser || sessionUser.role === 'coach') {
                try {
                    const result = await api.getUsers();

                    if (result.networkError) {
                        console.log('[Init] Nettverksfeil - bruker cached session');
                    } else if (result.authError) {
                        console.warn('[Init] Auth-feil fra API');
                        if (sessionUser) {
                            setShowReauthPrompt(true);
                        }
                    } else {
                        setAllUsers(result.data || []);

                        if (sessionUser && result.data) {
                            const freshUser = result.data.find(u => u.id === sessionUser.id);
                            if (freshUser) {
                                console.log('[Init] Oppdaterte brukerdata fra API');
                                setCurrentUser(freshUser);
                            }
                        }
                    }
                } catch (e) {
                    console.error('[Init] Feil:', e);
                }
            }

            setIsLoading(false);
        };
        init();
    }, []);

    // Visibility change handler - sjekk session når app blir synlig
    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === 'visible' && currentUser) {
                console.log('[Visibility] App ble synlig, sjekker session');
                if (!hasValidSession()) {
                    console.warn('[Visibility] Session borte - viser re-auth prompt');
                    setShowReauthPrompt(true);
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [currentUser]);

    // Last klientdata - kun for athlete som logger inn direkte
    useEffect(() => {
        if (viewingClient && currentUser?.role === 'athlete') {
            setIsClientLoading(true);
            api.getUserData(viewingClient.id)
                .then(result => {
                    if (result.authError) {
                        console.warn('[App] Auth-feil ved henting av klientdata');
                        setShowReauthPrompt(true);
                    } else if (result.data) {
                        setCurrentData(result.data);
                    } else if (result.networkError) {
                        console.log('[App] Nettverksfeil - bruker cached data');
                    }
                })
                .catch(() => setCurrentData(INITIAL_DATA_STATE))
                .finally(() => setIsClientLoading(false));
        }
    }, [viewingClient, currentUser?.role]);

    const handleLogin = useCallback((user) => {
        setCurrentUser(user);
        saveSession(user);
        setShowReauthPrompt(false);
        if (user.role === 'athlete') setViewingClient(user);
    }, []);

    const handleLogout = useCallback(() => {
        console.log('[App] Bruker logger ut');
        clearSession();
        setCurrentUser(null);
        setViewingClient(null);
        setShowReauthPrompt(false);
        setActiveTab('dashboard');
    }, []);

    const handleReauth = useCallback(() => {
        console.log('[App] Bruker må logge inn på nytt');
        clearSession();
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
        setCurrentData(prev => ({
            ...prev,
            checkins: [...prev.checkins, { ...entry, periodId: prev.currentPeriodId, isRead: false }]
        }));
    }, [viewingClient]);

    // Ref for å spore pågående lagring og hindre dobbelt-klikk
    const savingRef = React.useRef(false);

    const handleUpdateData = useCallback(async (keyOrObj, value) => {
        if (!viewingClient) return;
        if (savingRef.current) return;
        savingRef.current = true;

        let updates = typeof keyOrObj === 'string' ? { [keyOrObj]: value } : keyOrObj;
        let previousData;

        try {
            // Håndter periode-spesifikke actions
            if (updates.action === 'create_period') {
                const result = await api.createPeriod(viewingClient.id, updates.name, updates.startingWeight, updates.goalWeight);
                if (result.authError) { setShowReauthPrompt(true); }
                return;
            } else if (updates.action === 'end_period') {
                const result = await api.endPeriod(viewingClient.id, updates.periodId);
                if (result.authError) { setShowReauthPrompt(true); }
                return;
            } else if (updates.action === 'update_period') {
                const { periodId, ...periodUpdates } = updates;
                const result = await api.updatePeriod(viewingClient.id, periodId, periodUpdates);
                if (result.authError) { setShowReauthPrompt(true); }
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
            savingRef.current = false;
        }
    }, [viewingClient]);

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
            alert('Kunne ikke slette.');
            setCurrentData(prev => ({ ...prev, checkins: previousCheckins }));
        }
    }, [viewingClient]);

    const handleClearClient = useCallback(() => {
        setViewingClient(null);
        setActiveTab('dashboard');
    }, []);

    const handleSelectClient = useCallback(async (client) => {
        setCurrentData(INITIAL_DATA_STATE);
        setIsClientLoading(true);
        setShowWeightHistory(false);
        setActiveTab('dashboard');

        try {
            const result = await api.getUserData(client.id, false);
            if (result.authError) {
                setShowReauthPrompt(true);
                setIsClientLoading(false);
                return;
            }
            if (result.data) {
                setCurrentData(result.data);
            }
        } catch (e) {
            console.error('Kunne ikke hente klientdata:', e);
        }

        setViewingClient(client);
        setIsClientLoading(false);

        if (client.unreadCheckins > 0) {
            setAllUsers(prev => prev.map(u =>
                u.id === client.id ? { ...u, unreadCheckins: 0 } : u
            ));
            api.markCheckinsRead(client.id).then(result => {
                if (result.authError) setShowReauthPrompt(true);
            }).catch(e => {
                console.error('Kunne ikke markere innsjekk som lest:', e);
            });
        }
    }, []);

    const handleAddClient = useCallback(async (u) => {
        try {
            const result = await api.createUser({...u, id: Date.now().toString(), role:'athlete'});
            if (result.authError) {
                setShowReauthPrompt(true);
                return;
            }
            if (result.data) setAllUsers(result.data);
        } catch (e) {
            toast(e.message || 'Feil ved opprettelse av utøver', 'error');
        }
    }, []);

    const handleDeleteClient = useCallback(async (id) => {
        try {
            const result = await api.deleteUser(id);
            if (result.authError) {
                setShowReauthPrompt(true);
                return;
            }
            if (result.data) setAllUsers(result.data);
        } catch (e) {
            toast(e.message || 'Feil ved sletting av utøver', 'error');
        }
    }, []);

    const handleArchiveClient = useCallback(async (id, archive) => {
        try {
            const result = await api.archiveUser(id, archive);
            if (result.authError) {
                setShowReauthPrompt(true);
                return;
            }
            if (result.data) setAllUsers(result.data);
        } catch (e) {
            toast(e.message || 'Feil ved arkivering', 'error');
        }
    }, []);

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
            alert('Kunne ikke lagre bildet');
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
            alert('Kunne ikke slette bildet');
        }
    }, [viewingClient]);

    const handleOpenWeightHistory = useCallback(() => setShowWeightHistory(true), []);
    const handleCloseWeightHistory = useCallback(() => setShowWeightHistory(false), []);

    const dashboardUserData = useMemo(() => currentData, [
        currentData.checkins, currentData.periods, currentData.startDate,
        currentData.isPaused, currentData.pausedAt, currentData.totalWeeks, currentData.stepGoal
    ]);

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
        }
    }, [currentTabIndex, showWeightHistory]);

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
                        <div className="w-20 h-20 bg-surface-100 rounded-2xl flex items-center justify-center text-ink-muted mb-6">
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
                                <CheckInView
                                    checkins={currentData.checkins}
                                    onNewCheckin={() => {}}
                                    onDelete={() => {}}
                                    isReadOnly={true}
                                    stepGoal={currentData.stepGoal}
                                    hideForm={true}
                                />
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
                    <CoachDashboard
                        user={currentUser}
                        allUsers={allUsers}
                        onSelectClient={handleSelectClient}
                        onAddClient={handleAddClient}
                        onDeleteClient={handleDeleteClient}
                        onArchiveClient={handleArchiveClient}
                    />
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
                    <>
                        {activeTab === 'dashboard' ? (
                            showWeightHistory ? (
                                <WeightProgressView checkins={currentData.checkins} onBack={handleCloseWeightHistory} />
                            ) : (
                                <DashboardView userData={dashboardUserData} isCoach={isCoach} onUpdateData={handleUpdateData} onOpenWeightHistory={handleOpenWeightHistory} onRefreshData={handleRefresh} />
                            )
                        ) :
                        activeTab === 'gallery' ? <GalleryView
                            checkins={currentData.checkins}
                            galleryImages={currentData.galleryImages || []}
                            isCoach={isCoach}
                            onAddGalleryImage={handleAddGalleryImage}
                            onDeleteGalleryImage={handleDeleteGalleryImage}
                        /> :
                        activeTab === 'diet' ? <PlanSection type="diet" content={currentData.dietPlan} onSave={handleSaveDietPlan} isReadOnly={!isCoach} /> :
                        activeTab === 'workout' ? <PlanSection type="workout" content={currentData.workoutPlan} onSave={handleSaveWorkoutPlan} isReadOnly={!isCoach} /> :
                        <CheckInView checkins={currentData.checkins} onNewCheckin={handleNewCheckin} onDelete={handleDeleteCheckin} isReadOnly={isCoach} stepGoal={currentData.stepGoal} />}
                    </>
                )}
            </main>
            <Navigation activeTab={activeTab} setActiveTab={handleTabChange} />
        </div>
    );
};

export default App;
