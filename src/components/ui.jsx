import React from 'react';
import { ChevronDown } from 'lucide-react';

const SEGMENT_COLORS = (n) => {
    if (n >= 8) return 'bg-success text-white';
    if (n >= 5) return 'bg-warning text-white';
    return 'bg-error text-white';
};

export const SegmentedControl = React.memo(({ label, value, onChange, options, colorize = false }) => (
    <div>
        <label className="block text-sm font-medium text-ink-muted mb-2">{label}</label>
        <div className="flex gap-1 rounded-xl bg-surface-100 p-1">
            {options.map(opt => {
                const isSelected = Number(value) === Number(opt);
                const selectedCls = colorize ? SEGMENT_COLORS(Number(opt)) : 'bg-ink text-white';
                return (
                    <button
                        key={opt}
                        type="button"
                        onClick={() => onChange(opt)}
                        className={`flex-1 min-h-[42px] py-2 rounded-lg text-sm font-semibold transition-all duration-150 active:scale-95 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 ${
                            isSelected
                                ? `${selectedCls} shadow-sm`
                                : 'text-ink-muted hover:bg-white/70'
                        }`}
                    >
                        {opt}
                    </button>
                );
            })}
        </div>
    </div>
));

export const Skeleton = React.memo(({ className }) => (
    <div className={`bg-surface-200 animate-pulse rounded-xl ${className}`} />
));

const BADGE_VARIANTS = {
    default: 'bg-surface-200 text-ink',
    success: 'bg-success/10 text-success border border-success/20',
    warning: 'bg-warning/10 text-warning border border-warning/20',
    muted: 'bg-surface-100 text-ink-muted border border-surface-200',
};

export const Badge = React.memo(({ children, variant = 'default', className = '' }) => (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg ${BADGE_VARIANTS[variant]} ${className}`}>
        {children}
    </span>
));

const BUTTON_VARIANTS = {
    primary: 'bg-ink text-white shadow-sm hover:bg-ink/85 active:scale-[0.98]',
    secondary: 'bg-surface-100 text-ink hover:bg-surface-200 active:scale-[0.98]',
    ghost: 'text-ink-muted hover:text-ink hover:bg-surface-100',
    danger: 'bg-error/10 text-error hover:bg-error/15',
};
const BUTTON_SIZES = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3.5 text-base',
};

export const Button = React.memo(({ children, variant = 'primary', size = 'md', className = '', ...props }) => (
    <button
        type="button"
        className={`font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}
        {...props}
    >
        {children}
    </button>
));

export const IconButton = React.memo(({ children, className = '', tone = 'neutral', ...props }) => {
    const toneClass = tone === 'danger'
        ? 'text-ink-faint hover:text-error'
        : tone === 'accent'
            ? 'text-ink-faint hover:text-accent'
            : 'text-ink-muted hover:text-ink';
    return (
        <button
            type="button"
            className={`inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg p-2 transition-colors hover:bg-surface-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${toneClass} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
});

export const Card = React.memo(React.forwardRef(({ children, className = "", interactive = false, ...props }, ref) => (
    <div
        ref={ref}
        className={`surface-card rounded-xl border border-surface-200 ${interactive ? 'surface-card-interactive hover:border-surface-300 cursor-pointer' : ''} ${className}`}
        {...props}
    >
        {children}
    </div>
)));

export const InputLabel = React.memo(({ children }) => (
    <label className="block text-sm font-medium text-ink-muted mb-2">{children}</label>
));

export const TextField = React.memo(React.forwardRef(({
    label,
    icon: Icon,
    className = '',
    inputClassName = '',
    error,
    hint,
    id,
    ...props
}, ref) => (
    <div className={className}>
        {label && <label htmlFor={id} className="block text-sm font-medium text-ink-muted mb-2">{label}</label>}
        <div className="relative">
            {Icon && <Icon className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" size={18} />}
            <input
                id={id}
                ref={ref}
                className={`w-full ${Icon ? 'pl-12' : 'px-4'} pr-4 py-3.5 bg-surface-50 border rounded-xl outline-none transition-all focus:ring-2 focus:ring-accent focus:border-accent font-medium placeholder-ink-faint disabled:opacity-50 ${error ? 'border-error/40' : 'border-surface-200'} ${inputClassName}`}
                aria-invalid={error ? true : undefined}
                {...props}
            />
        </div>
        {error ? (
            <p className="text-error text-xs mt-1.5">{error}</p>
        ) : hint ? (
            <p className="text-xs text-ink-muted mt-1.5">{hint}</p>
        ) : null}
    </div>
)));

export const EmptyState = React.memo(({ icon: Icon, title, description, action }) => (
    <div className="text-center py-12 px-6">
        {Icon && (
            <div className="w-14 h-14 bg-surface-100 rounded-xl flex items-center justify-center text-ink-muted mx-auto mb-4">
                <Icon size={24} />
            </div>
        )}
        <p className="text-base font-semibold text-ink mb-1">{title}</p>
        {description && <p className="text-ink-faint text-sm">{description}</p>}
        {action && <div className="mt-6">{action}</div>}
    </div>
));

export const ToggleGroup = React.memo(({ options, value, onChange, className = '' }) => (
    <div className={`flex gap-1.5 items-center rounded-xl bg-surface-100 p-1 ${className}`} role="group">
        {options.map((option) => {
            const isSelected = value === option.value;
            return (
                <button
                    key={option.value}
                    type="button"
                    onClick={() => onChange(option.value)}
                    aria-pressed={isSelected}
                    className={`flex-1 min-h-[40px] px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 ${isSelected ? 'bg-ink text-white shadow-sm' : 'text-ink-muted hover:bg-white/70 hover:text-ink'}`}
                >
                    {option.label}
                </button>
            );
        })}
    </div>
));

let selectFieldCounter = 0;
export const SelectField = React.memo(({
    label,
    value,
    onChange,
    options,
    id: providedId,
    displayLabels = {},
    className = '',
    selectClassName = '',
    ...props
}) => {
    const [autoId] = React.useState(() => providedId || `select-field-${++selectFieldCounter}`);
    return (
        <div className={className}>
            {label && <label htmlFor={autoId} className="block text-sm font-medium text-ink-muted mb-2">{label}</label>}
            <div className="relative">
                <select
                    id={autoId}
                    value={value}
                    onChange={onChange}
                    className={`w-full p-3.5 bg-surface-50 border border-surface-200 rounded-xl appearance-none focus:ring-2 focus:ring-accent focus:border-accent outline-none font-medium cursor-pointer ${selectClassName}`}
                    {...props}
                >
                    {options.map(opt => <option key={opt} value={opt}>{displayLabels[opt] || opt}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" size={18} />
            </div>
        </div>
    );
});
