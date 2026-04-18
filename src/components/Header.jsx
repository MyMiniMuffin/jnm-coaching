import React from 'react';
import { Briefcase, User, ChevronRight, LogOut } from 'lucide-react';
import { Badge, Button } from './ui';

const Header = React.memo(({ title, user, viewingClient, onLogout, onClearClient }) => (
    <header className="bg-surface-50/95 backdrop-blur-md sticky top-0 z-40 border-b border-surface-200">
        {/* Safe area spacer for iPhone Dynamic Island/notch */}
        <div className="safe-area-pt" />
        <div className="flex justify-between items-center max-w-md mx-auto px-5 py-4">
            <div>
                <h1 className="text-[1.7rem] font-display text-ink">{title}</h1>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-sm text-ink-muted flex items-center gap-1">
                        {user.role === 'coach' ? <Briefcase size={12} /> : <User size={12} />}
                        {user.name}
                    </span>
                    {viewingClient && (
                        <Badge variant="muted" className="text-[11px]">
                            <ChevronRight size={10} /> {viewingClient.name} <span className="text-ink-faint">@{viewingClient.username}</span>
                        </Badge>
                    )}
                </div>
            </div>
            {viewingClient ? (
                <Button variant="secondary" size="sm" onClick={onClearClient}>Lukk</Button>
            ) : (
                <button onClick={onLogout} aria-label="Logg ut" className="text-ink-faint hover:text-ink p-2 rounded-xl hover:bg-surface-100 transition-colors">
                    <LogOut size={20} />
                </button>
            )}
        </div>
    </header>
));

export default Header;
