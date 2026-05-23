import React, { useState, useCallback } from 'react';
import { Card, Button } from './ui';
import { AlertTriangle } from 'lucide-react';
import { useFocusTrap } from '../hooks';

const ConfirmContext = React.createContext();

export const ConfirmProvider = ({ children }) => {
    const [state, setState] = useState(null);

    const confirm = useCallback((message, options = {}) => {
        return new Promise((resolve) => {
            setState({ message, ...options, resolve });
        });
    }, []);

    const handleConfirm = useCallback(() => {
        state?.resolve(true);
        setState(null);
    }, [state]);

    const handleCancel = useCallback(() => {
        state?.resolve(false);
        setState(null);
    }, [state]);

    const focusTrapRef = useFocusTrap(!!state);

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            {state && (
                <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in" onClick={handleCancel}>
                    <Card
                        ref={focusTrapRef}
                        role="dialog"
                        aria-modal="true"
                        {...(state.title ? { 'aria-labelledby': 'confirm-dialog-title' } : { 'aria-label': 'Bekreftelse' })}
                        aria-describedby="confirm-dialog-message"
                        className="w-full max-w-sm p-6 animate-scale-in"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-start gap-4 mb-5">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${state.destructive ? 'bg-red-50 text-red-600' : 'bg-surface-100 text-ink-muted'}`}>
                                <AlertTriangle size={20} />
                            </div>
                            <div>
                                {state.title && <h3 id="confirm-dialog-title" className="font-display text-lg mb-1">{state.title}</h3>}
                                <p id="confirm-dialog-message" className="text-ink-muted text-sm">{state.message}</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="secondary" size="md" className="flex-1" onClick={handleCancel}>
                                {state.cancelText || 'Avbryt'}
                            </Button>
                            <Button variant={state.destructive ? 'danger' : 'primary'} size="md" className="flex-1" onClick={handleConfirm} autoFocus>
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
