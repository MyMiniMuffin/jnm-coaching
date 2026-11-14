import React, { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { DeviceMobile, DownloadSimple, ListChecks, ArrowsOut, X } from '@phosphor-icons/react';
import { Button, Card, IconButton } from './ui';
import { useEscapeKey, useFocusTrap } from '../hooks';
import { APP_ICON } from '../lib/config';
import { isNativeApp } from '../lib/platform';
import {
    detectStandalone,
    getInstallPromptVersion,
    hasDeferredInstallPrompt,
    markInstallDismissed,
    markInstallInstalled,
    markInstallShown,
    readInstallState,
    shouldShowInstallPrompt,
    subscribeInstallPrompt,
    takeDeferredInstallPrompt,
} from '../lib/installPrompt';

const SHOW_DELAY_MS = 6000;
const RETRY_MS = 4000;

const BENEFITS = [
    { Icon: DeviceMobile, text: 'Åpne direkte fra startskjermen' },
    { Icon: ArrowsOut, text: 'Fullskjerm uten adressefelt og nettleserlinjer' },
    { Icon: ListChecks, text: 'Planer og rapporter ett trykk unna' },
];

const otherDialogOpen = () => Boolean(document.querySelector('[aria-modal="true"]'));

const InstallPrompt = ({ engaged }) => {
    const [visible, setVisible] = useState(false);
    // Abonnerer slik at en hendelse som kommer sent (eller en appinstalled) vurderes på nytt.
    const storeVersion = useSyncExternalStore(subscribeInstallPrompt, getInstallPromptVersion, () => 0);

    const evaluate = useCallback((modalOpen) => shouldShowInstallPrompt({
        userAgent: navigator.userAgent,
        maxTouchPoints: navigator.maxTouchPoints || 0,
        isNative: isNativeApp(),
        isStandalone: detectStandalone(),
        hasDeferredPrompt: hasDeferredInstallPrompt(),
        now: Date.now(),
        engaged,
        modalOpen,
        ...readInstallState(),
    }), [engaged]);

    useEffect(() => {
        if (visible) return undefined;
        // Ingen timer hvis popupen aldri kan vises (plattform, standalone, native, cooldown osv.).
        if (!evaluate(false)) return undefined;
        let timeoutId;
        const attempt = () => {
            if (evaluate(otherDialogOpen())) {
                markInstallShown();
                setVisible(true);
                return;
            }
            // Prøv igjen kun når en åpen modal er eneste hinder.
            if (evaluate(false)) timeoutId = setTimeout(attempt, RETRY_MS);
        };
        timeoutId = setTimeout(attempt, SHOW_DELAY_MS);
        return () => clearTimeout(timeoutId);
    }, [engaged, evaluate, visible, storeVersion]);

    // appinstalled tømmer hendelsen: skjul uten å vente på noe mer.
    // install() tar hendelsen uten å emitte og skjuler dialogen selv.
    useEffect(() => {
        if (visible && !hasDeferredInstallPrompt()) setVisible(false);
    }, [visible, storeVersion]);

    const dismiss = useCallback(() => {
        markInstallDismissed();
        setVisible(false);
    }, []);

    const install = useCallback(async () => {
        const event = takeDeferredInstallPrompt();
        // Skjul dialogen eksplisitt når den native dialogen åpnes.
        setVisible(false);
        if (!event) return;
        let choice;
        try {
            await event.prompt();
            choice = await event.userChoice;
        } catch {
            // Feil er ikke et brukervalg: ingen 14-dagers utsettelse (sesjonsflagget hindrer ny visning).
            return;
        }
        if (choice?.outcome === 'accepted') {
            markInstallInstalled();
            return;
        }
        dismiss();
    }, [dismiss]);

    const trapRef = useFocusTrap(visible);
    useEscapeKey(dismiss, visible);

    useEffect(() => {
        if (!visible) return undefined;
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = previous; };
    }, [visible]);

    if (!visible) return null;

    return (
        <div
            className="install-prompt-overlay fixed inset-0 z-[190] flex items-center justify-center bg-ink/60 backdrop-blur-sm animate-fade-in"
            data-testid="install-prompt"
            onClick={dismiss}
        >
            <Card
                ref={trapRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="install-prompt-title"
                aria-describedby="install-prompt-subtitle"
                className="relative w-full max-w-sm overflow-y-auto p-6"
                style={{ maxHeight: '100%' }}
                onClick={e => e.stopPropagation()}
            >
                <IconButton className="absolute right-2 top-2" aria-label="Lukk" onClick={dismiss}>
                    <X size={20} />
                </IconButton>
                <div className="flex flex-col items-center text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-100">
                        <img src={APP_ICON} alt="" className="h-10 w-10" />
                    </div>
                    <h2 id="install-prompt-title" className="font-display text-xl">Få JNM Coaching som app</h2>
                    <p id="install-prompt-subtitle" className="mt-1 text-sm text-ink-muted">
                        Legg den til på startskjermen, så åpner den som en vanlig app
                    </p>
                </div>
                <ul className="my-5 space-y-3">
                    {BENEFITS.map(({ Icon, text }) => (
                        <li key={text} className="flex items-center gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                                <Icon size={20} aria-hidden="true" />
                            </span>
                            <span className="text-sm leading-5 text-ink">{text}</span>
                        </li>
                    ))}
                </ul>
                <Button variant="primary" size="md" className="w-full" onClick={install}>
                    <DownloadSimple size={20} aria-hidden="true" />
                    Installer appen
                </Button>
                <Button variant="ghost" size="md" className="mt-2 w-full" onClick={dismiss}>
                    Ikke nå
                </Button>
            </Card>
        </div>
    );
};

export default InstallPrompt;
