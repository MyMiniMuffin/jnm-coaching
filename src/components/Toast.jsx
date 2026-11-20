import React, { useState, useCallback, useEffect, useRef } from 'react';

// --- Toast Notification System ---
const ToastContext = React.createContext();
const TOAST_MS = 3000;
const EXIT_MS = 160; // --dur-fast

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const timersRef = useRef([]);

    useEffect(() => () => {
        timersRef.current.forEach(clearTimeout);
        timersRef.current = [];
    }, []);

    const show = useCallback((message, type = 'success') => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setToasts(prev => [...prev.slice(-2), { id, message, type, exiting: false }]);
        const fadeTimer = setTimeout(() => setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t)), TOAST_MS - EXIT_MS);
        const removeTimer = setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), TOAST_MS);
        timersRef.current.push(fadeTimer, removeTimer);
    }, []);
    return (
        <ToastContext.Provider value={show}>
            {children}
            {toasts.length > 0 && (
                <div className="toast-stack fixed bottom-20 left-1/2 z-[300] flex w-[min(calc(100vw-2rem),24rem)] -translate-x-1/2 flex-col gap-2" role="status" aria-live="polite" aria-atomic="true">
                    {toasts.map(t => (
                        <div
                            key={t.id}
                            role={t.type === 'error' ? 'alert' : undefined}
                            className={`px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-center ${t.exiting ? 'animate-toast-out' : 'animate-toast-in'} ${
                                t.type === 'success' ? 'bg-success text-white' :
                                t.type === 'error' ? 'bg-error text-white' : 'bg-ink text-white'
                            }`}
                        >
                            {t.type === 'success' && '✓ '}{t.message}
                        </div>
                    ))}
                </div>
            )}
        </ToastContext.Provider>
    );
};

export const useToast = () => React.useContext(ToastContext);
