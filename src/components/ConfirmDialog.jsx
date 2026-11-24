import React, { useState, useCallback } from 'react';
import { Card, Button } from './ui';
import { Warning } from '@phosphor-icons/react';
import { useFocusTrap, usePresence } from '../hooks';
import { haptic } from '../lib/haptic';

const ConfirmContext = React.createContext();
const EXIT_MS = 160; // --dur-fast

export const ConfirmProvider = ({ children }) => {
    const [state, setState] = useState(null);

    const confirm = useCallback((message, options = {}) => {
        return new Promise((resolve) => {
            setState({ message, ...options, resolve, open: true });
        });
    }, []);

    const handleConfirm = useCallback(() => {
        if (state?.destructive) haptic('confirm');
        state?.resolve(true);
        setState(prev => prev && { ...prev, open: false });
    }, [state]);

    const handleCancel = useCallback(() => {
        state?.resolve(false);
        setState(prev => prev && { ...prev, open: false });
    }, [state]);

    const open = Boolean(state?.open);
    const { mounted, closing } = usePresence(open, EXIT_MS);
    const focusTrapRef = useFocusTrap(open);

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            {mounted && state && (
                <div className={`modal-backdrop fixed inset-0 bg-ink/60 backdrop-blur-sm z-[200] flex items-center justify-center ${closing ? 'pointer-events-none animate-fade-out' : 'animate-fade-in'}`} inert={closing} onClick={handleCancel}>
                    <Card
                        ref={focusTrapRef}
                        role="dialog"
                        aria-modal="true"
                        {...(state.title ? { 'aria-labelledby': 'confirm-dialog-title' } : { 'aria-label': 'Bekreftelse' })}
                        aria-describedby="confirm-dialog-message"
                        className={`w-full max-w-sm p-6 ${closing ? 'animate-scale-out' : 'animate-scale-in'}`}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-start gap-4 mb-5">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${state.destructive ? 'bg-error/10 text-error' : 'bg-surface-100 text-ink-muted'}`}>
                                <Warning size={20} />
                            </div>
                            <div>
                                {state.title && <h2 id="confirm-dialog-title" className="font-display text-xl mb-1">{state.title}</h2>}
                                <p id="confirm-dialog-message" className="text-ink-muted text-sm">{state.message}</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="secondary" size="md" className="flex-1" onClick={handleCancel}>
                                {state.cancelText || 'Avbryt'}
                            </Button>
                            <Button variant={state.destructive ? 'danger' : 'primary'} size="md" className="flex-1" onClick={handleConfirm} data-autofocus>
                                {state.confirmText || 'Bekreft'}
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </ConfirmContext.Provider>
    );
};

export const useConfirm = () => React.useContext(ConfirmContext);
