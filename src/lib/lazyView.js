import React from 'react';

// React.lazy that renders without suspending once its chunk is preloaded.
// React.lazy calls the loader on first render and resolves synchronously when the
// returned thenable calls back synchronously. A plain import() promise never does,
// so the view suspends, shows the skeleton, and React 19 then holds the content
// back for its ~300 ms fallback throttle even when the chunk is already in memory.
export const lazyView = (load) => {
    let module = null;
    let pending = null;
    const preload = () => {
        pending ??= load().then(
            (loaded) => { module = loaded; return loaded; },
            (error) => { pending = null; throw error; },
        );
        return pending;
    };
    const View = React.lazy(() => (module ? { then: (resolve) => resolve(module) } : preload()));
    View.preload = preload;
    return View;
};
