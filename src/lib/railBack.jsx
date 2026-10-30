/**
 * Lightweight stack so drill-down views can register a back action for the Duo rail.
 * App-level shell backs (coach→client, weight history) are composed in App.jsx.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const RailBackContext = createContext(null);

export const RailBackProvider = ({ children }) => {
    const [entries, setEntries] = useState([]);

    const register = useCallback((id, entry) => {
        setEntries((prev) => {
            const next = prev.filter((item) => item.id !== id);
            if (entry) next.push({ id, ...entry });
            return next;
        });
        return () => {
            setEntries((prev) => prev.filter((item) => item.id !== id));
        };
    }, []);

    const top = entries.length > 0 ? entries[entries.length - 1] : null;
    const value = useMemo(() => ({ register, top }), [register, top]);

    return (
        <RailBackContext.Provider value={value}>
            {children}
        </RailBackContext.Provider>
    );
};

export const useRailBackStack = () => {
    const ctx = useContext(RailBackContext);
    if (!ctx) {
        return { register: () => () => {}, top: null };
    }
    return ctx;
};

/** Register a rail back action while `active` is true. */
export const useRegisterRailBack = (id, active, onBack) => {
    const { register } = useRailBackStack();
    useEffect(() => {
        if (!active || typeof onBack !== 'function') return undefined;
        return register(id, { onBack });
    }, [id, active, onBack, register]);
};
