import React from 'react';
import { IconContext } from '@phosphor-icons/react';

/** App-wide Phosphor defaults: regular weight, currentColor. Per-icon size/weight still override. */
const DEFAULTS = Object.freeze({
    weight: 'regular',
    color: 'currentColor',
    mirrored: false,
});

export default function IconProvider({ children }) {
    return (
        <IconContext.Provider value={DEFAULTS}>
            {children}
        </IconContext.Provider>
    );
}
