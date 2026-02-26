import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Card, Button } from './ui';

// ReauthPrompt - vises når token har utløpt
const ReauthPrompt = React.memo(({ onReauth, onLogout }) => (
    <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in">
        <Card className="w-full max-w-sm p-6 animate-scale-in text-center">
            <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 mx-auto mb-4">
                <AlertCircle size={32} />
            </div>
            <h2 className="text-xl font-display mb-2">Sesjonen har utløpt</h2>
            <p className="text-ink-muted mb-6">Vennligst logg inn på nytt for å fortsette.</p>
            <div className="flex gap-3">
                <Button variant="secondary" size="lg" className="flex-1" onClick={onLogout}>
                    Avbryt
                </Button>
                <Button variant="primary" size="lg" className="flex-1" onClick={onReauth}>
                    Logg inn
                </Button>
            </div>
        </Card>
    </div>
));

export default ReauthPrompt;
