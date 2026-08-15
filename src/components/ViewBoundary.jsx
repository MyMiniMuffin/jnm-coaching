import React from 'react';

export class ViewErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, info) {
        console.error('ViewErrorBoundary fanget feil:', error, info);
    }

    render() {
        if (!this.state.hasError) return this.props.children;

        return (
            <div className="flex flex-col items-center justify-center h-[50vh] text-center px-6">
                <div className="w-16 h-16 bg-error/10 rounded-xl flex items-center justify-center text-error mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                </div>
                <h2 className="text-lg font-display mb-2">Noe gikk galt</h2>
                <p className="text-ink-muted text-sm mb-4">Denne visningen kunne ikke lastes.</p>
                <button
                    type="button"
                    className="px-4 py-2 bg-ink text-white rounded-xl text-sm font-medium"
                    onClick={() => this.setState({ hasError: false })}
                >
                    Prøv igjen
                </button>
            </div>
        );
    }
}

export const ViewSkeleton = ({ tab }) => {
    if (tab === 'gallery') return (
        <div className="space-y-4 animate-pulse">
            <div className="flex gap-2">
                {[1, 2, 3].map(item => <div key={item} className="h-8 w-20 bg-surface-200 rounded-full" />)}
            </div>
            <div className="grid grid-cols-3 gap-1.5 lg:grid-cols-5">
                {[1, 2, 3, 4, 5, 6].map(item => <div key={item} className="aspect-square bg-surface-200 rounded-xl" />)}
            </div>
        </div>
    );

    if (tab === 'diet' || tab === 'workout') return (
        <div className="animate-pulse">
            <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
                <div className="p-5 border-b border-surface-100 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-surface-200 rounded-xl" />
                        <div className="h-6 w-24 bg-surface-200 rounded-lg" />
                    </div>
                    <div className="h-8 w-20 bg-surface-200 rounded-xl" />
                </div>
                <div className="p-5 space-y-3">
                    <div className="h-4 bg-surface-200 rounded w-full" />
                    <div className="h-4 bg-surface-200 rounded w-5/6" />
                    <div className="h-4 bg-surface-200 rounded w-4/6" />
                    <div className="h-4 bg-surface-200 rounded w-full" />
                    <div className="h-4 bg-surface-200 rounded w-3/6" />
                </div>
            </div>
        </div>
    );

    if (tab === 'checkin') return (
        <div className="space-y-4 animate-pulse">
            <div className="bg-white rounded-xl border border-surface-200 p-5 space-y-4">
                <div className="h-6 w-32 bg-surface-200 rounded-lg" />
                <div className="h-12 bg-surface-200 rounded-xl" />
                <div className="grid grid-cols-2 gap-4">
                    <div className="h-20 bg-surface-200 rounded-xl" />
                    <div className="h-20 bg-surface-200 rounded-xl" />
                </div>
                <div className="h-12 bg-surface-200 rounded-xl" />
            </div>
        </div>
    );

    return (
        <div className="space-y-4 animate-pulse">
            <div className="h-40 bg-surface-200 rounded-xl" />
            <div className="grid grid-cols-2 gap-4">
                <div className="h-32 bg-surface-200 rounded-xl" />
                <div className="h-32 bg-surface-200 rounded-xl" />
            </div>
            <div className="h-24 bg-surface-200 rounded-xl" />
        </div>
    );
};
