/**
 * Lightweight stack so drill-down views can register a back action for the Duo rail.
 * App-level shell backs (coach→client, weight history) are composed in App.jsx.
 *
 * Registration stores `onBack` in a ref so unstable callback identities do not
 * re-register → update context → re-render → re-register (max update depth).
 */
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

const RailBackContext = createContext(null);

export const RailBackProvider = ({ children }) => {
    const [stack, setStack] = useState([]);
    const handlersRef = useRef(new Map());

    const register = useCallback((id) => {
        setStack((prev) => (prev.includes(id) ? prev : [...prev, id]));
        return () => {
            handlersRef.current.delete(id);
            setStack((prev) => prev.filter((item) => item !== id));
        };
    }, []);

    const setHandler = useCallback((id, onBack) => {
        if (typeof onBack === 'function') {
            handlersRef.current.set(id, onBack);
        } else {
            handlersRef.current.delete(id);
        }
    }, []);

    const topId = stack.length > 0 ? stack[stack.length - 1] : null;
    const top = useMemo(() => {
        if (!topId) return null;
        return {
            id: topId,
            onBack: (...args) => {
                const handler = handlersRef.current.get(topId);
                if (typeof handler === 'function') return handler(...args);
                return undefined;
            },
        };
    }, [topId]);

    const value = useMemo(() => ({ register, setHandler, top }), [register, setHandler, top]);

    return (
        <RailBackContext.Provider value={value}>
            {children}
        </RailBackContext.Provider>
    );
};

export const useRailBackStack = () => {
    const ctx = useContext(RailBackContext);
    if (!ctx) {
        return { register: () => () => {}, setHandler: () => {}, top: null };
    }
    return ctx;
};

/** Register a rail back action while `active` is true. */
export const useRegisterRailBack = (id, active, onBack) => {
    const { register, setHandler } = useRailBackStack();
    const onBackRef = useRef(onBack);
    useLayoutEffect(() => {
        onBackRef.current = onBack;
        if (active) setHandler(id, (...args) => onBackRef.current?.(...args));
    });

    useEffect(() => {
        if (!active) return undefined;
        setHandler(id, (...args) => onBackRef.current?.(...args));
        return register(id);
    }, [id, active, register, setHandler]);
};
