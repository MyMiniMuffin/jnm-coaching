import React from 'react';
import { ChevronDown } from 'lucide-react';

export const Skeleton = React.memo(({ className }) => (
    <div className={`bg-surface-200 animate-pulse rounded-2xl ${className}`} />
));

const BADGE_VARIANTS = {
    default: 'bg-surface-200 text-ink',
    success: 'bg-[#edf3ea] text-[#4f6b52] border border-[#cfe0cf]',
    warning: 'bg-[#f6ede2] text-[#946b45] border border-[#e7d2bb]',
    muted: 'bg-[#f4ede2] text-ink-muted border border-[#e6ded0]',
};

export const Badge = React.memo(({ children, variant = 'default', className = '' }) => (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${BADGE_VARIANTS[variant]} ${className}`}>
        {children}
    </span>
));

const BUTTON_VARIANTS = {
    primary: 'bg-accent text-surface-50 hover:bg-accent-hover active:scale-[0.98]',
    secondary: 'bg-surface-100 text-ink hover:bg-[#ece4d7] active:scale-[0.98]',
    ghost: 'text-ink-muted hover:text-ink hover:bg-surface-100',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100',
};
const BUTTON_SIZES = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3.5 text-base',
};

export const Button = React.memo(({ children, variant = 'primary', size = 'md', className = '', ...props }) => (
    <button
        className={`font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}
        {...props}
    >
        {children}
    </button>
));

export const Card = React.memo(React.forwardRef(({ children, className = "", interactive = false, ...props }, ref) => (
    <div
        ref={ref}
        className={`bg-white rounded-2xl border border-surface-200 ${interactive ? 'hover:border-surface-300 hover:shadow-sm hover:shadow-[#d9cfbf33] cursor-pointer transition-all' : ''} ${className}`}
        {...props}
    >
        {children}
    </div>
)));

export const InputLabel = React.memo(({ children }) => (
    <label className="block text-sm font-medium text-ink-muted mb-2">{children}</label>
));

let selectFieldCounter = 0;
export const SelectField = React.memo(({ label, value, onChange, options, id: providedId }) => {
    const [autoId] = React.useState(() => providedId || `select-field-${++selectFieldCounter}`);
    return (
        <div>
            <label htmlFor={autoId} className="block text-sm font-medium text-ink-muted mb-2">{label}</label>
            <div className="relative">
                <select
                    id={autoId}
                    value={value}
                    onChange={onChange}
                    className="w-full p-3.5 bg-surface-50 border border-surface-200 rounded-xl appearance-none focus:ring-2 focus:ring-ink focus:border-ink outline-none font-medium cursor-pointer"
                >
                    {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" size={18} />
            </div>
        </div>
    );
});
