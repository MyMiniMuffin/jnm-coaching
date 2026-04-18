import React, { useState } from 'react';
import { ArrowRight, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from './ui';
import { api } from '../lib/api';
import { APP_ICON } from '../lib/config';

const LoginScreen = React.memo(({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isCapsLockOn, setIsCapsLockOn] = useState(false);

    const handleUsernameChange = (e) => {
        setUsername(e.target.value);
        if (error) setError('');
    };

    const handlePasswordChange = (e) => {
        setPassword(e.target.value);
        if (error) setError('');
    };

    const handlePasswordKeyState = (e) => {
        setIsCapsLockOn(e.getModifierState('CapsLock'));
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            const user = await api.login(username, password);
            if (user) onLogin(user);
            else setError('Feil brukernavn eller passord. Sjekk at Caps Lock ikke er på, og prøv igjen.');
        } catch (err) {
            setError('Kunne ikke logge inn akkurat nå. Sjekk tilkoblingen og prøv igjen.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-surface-50 relative animate-fade-in">
            <div className="text-center mb-12">
                <div className="w-20 h-20 mx-auto mb-8">
                    <img src={APP_ICON} alt="Logo" className="w-full h-full" />
                </div>
                <h1 className="text-3xl font-display text-ink mb-2">JNM Coaching</h1>
                <p className="text-ink-muted">Logg inn for å fortsette</p>
            </div>

            <div className="w-full max-w-sm">
                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-ink-muted mb-2">Brukernavn</label>
                        <input
                            type="text"
                            value={username}
                            onChange={handleUsernameChange}
                            disabled={isLoading}
                            className="w-full px-4 py-3.5 bg-white border border-surface-200 rounded-xl focus:ring-2 focus:ring-ink focus:border-ink outline-none transition-all disabled:opacity-50"
                            placeholder="Skriv inn brukernavn"
                            autoFocus
                            autoComplete="username"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-ink-muted mb-2">Passord</label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={handlePasswordChange}
                                onKeyDown={handlePasswordKeyState}
                                onKeyUp={handlePasswordKeyState}
                                onFocus={handlePasswordKeyState}
                                disabled={isLoading}
                                className="w-full px-4 py-3.5 pr-12 bg-white border border-surface-200 rounded-xl focus:ring-2 focus:ring-ink focus:border-ink outline-none transition-all disabled:opacity-50"
                                placeholder="••••••••"
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(prev => !prev)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink-faint hover:text-ink transition-colors"
                                aria-label={showPassword ? 'Skjul passord' : 'Vis passord'}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        {isCapsLockOn && (
                            <p className="text-amber-700 bg-amber-50 border border-amber-100 px-3 py-2 rounded-xl text-sm mt-2">
                                Caps Lock er på. Det kan gjøre passordet feil.
                            </p>
                        )}
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl text-sm">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <Button type="submit" disabled={isLoading || !username.trim() || !password} size="lg" className="w-full mt-6">
                        {isLoading ? (
                            <Loader2 className="animate-spin" size={20} />
                        ) : (
                            <>Logg inn <ArrowRight size={18} /></>
                        )}
                    </Button>
                </form>
            </div>

            <p className="absolute bottom-8 text-ink-faint text-xs">JNM Coaching © {new Date().getFullYear()}</p>
        </div>
    );
});

export default LoginScreen;
