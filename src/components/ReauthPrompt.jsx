import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Card, Button } from './ui';

const ReauthPrompt = React.memo(({ onReauth }) => (
    <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in">
        <Card className="w-full max-w-sm p-6 animate-scale-in text-center" role="dialog" aria-modal="true" aria-labelledby="reauth-title">
            <div className="w-16 h-16 bg-warning/10 rounded-xl flex items-center justify-center text-warning mx-auto mb-4">
                <AlertCircle size={32} />
            </div>
            <h2 id="reauth-title" className="text-xl font-display mb-2">Sesjonen har utløpt</h2>
            <p className="text-ink-muted mb-6">Logg inn på nytt for å fortsette.</p>
            <Button variant="primary" size="lg" className="w-full" onClick={onReauth}>
                Logg inn på nytt
            </Button>
        </Card>
    </div>
));

export default ReauthPrompt;
