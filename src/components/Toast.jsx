import React, { useState, useCallback } from 'react';

// --- Toast Notification System ---
const ToastContext = React.createContext();

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const show = useCallback((message, type = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type, exiting: false }]);
        // Start fade-out 2.5s in, remove at 3s
        setTimeout(() => setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t)), 2500);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
    }, []);
    return (
        <ToastContext.Provider value={show}>
            {children}
            {toasts.length > 0 && (
                <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[300] flex flex-col gap-2">
                    {toasts.map(t => (
                        <div key={t.id} className={`px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-slide-up whitespace-nowrap transition-opacity duration-500 ${
                            t.exiting ? 'opacity-0' : 'opacity-100'
                        } ${
                            t.type === 'success' ? 'bg-emerald-600 text-white' :
                            t.type === 'error' ? 'bg-red-600 text-white' : 'bg-ink text-white'
                        }`}>
                            {t.type === 'success' && '✓ '}{t.message}
                        </div>
                    ))}
                </div>
            )}
        </ToastContext.Provider>
    );
};

export const useToast = () => React.useContext(ToastContext);
