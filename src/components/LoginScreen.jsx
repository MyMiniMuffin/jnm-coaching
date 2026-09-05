import React, { useState } from 'react';
import { ArrowRight, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button, TextField } from './ui';
import { api } from '../lib/api';
import { APP_ICON } from '../lib/config';
import { haptic } from '../lib/haptic';

const LoginScreen = React.memo(({ onLogin }) => {
    const [mustChangePassword, setMustChangePassword] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
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
        if (typeof e.getModifierState === 'function') {
            setIsCapsLockOn(Boolean(e.getModifierState('CapsLock')));
        } else if (typeof e.nativeEvent?.getModifierState === 'function') {
            setIsCapsLockOn(Boolean(e.nativeEvent.getModifierState('CapsLock')));
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        if (mustChangePassword && newPassword !== confirmPassword) {
            setError('Passordene er ikke like.');
            return;
        }
        haptic('save');
        setError('');
        setIsLoading(true);
        try {
            const user = await api.login(username, password, mustChangePassword ? newPassword : undefined);
            if (user?.mustChangePassword) {
                setMustChangePassword(true);
            } else if (user) onLogin(user);
            else setError('Feil brukernavn eller passord. Sjekk at Caps Lock ikke er på, og prøv igjen.');
        } catch (err) {
            setError(err.message || 'Kunne ikke logge inn akkurat nå. Sjekk tilkoblingen og prøv igjen.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 relative animate-fade-in lg:bg-transparent">
            <div className="text-center mb-8">
                <div className="w-20 h-20 mx-auto mb-7 rounded-xl bg-white p-2 shadow-sm ring-1 ring-surface-200">
                    <img src={APP_ICON} alt="Logo" className="w-full h-full" />
                </div>
                <h1 className="text-3xl font-display text-ink mb-2">JNM Coaching</h1>
                <p className="text-ink-muted">{mustChangePassword ? 'Velg ditt eget passord' : 'Logg inn for å fortsette'}</p>
            </div>

            <div className="w-full max-w-sm rounded-xl border border-surface-200 bg-white p-5 shadow-sm lg:p-7">
                <form onSubmit={handleLogin} className="space-y-4">
                    {!mustChangePassword && <>
                    <TextField
                        label="Brukernavn"
                        type="text"
                        value={username}
                        onChange={handleUsernameChange}
                        disabled={isLoading}
                        placeholder="Skriv inn brukernavn"
                        autoFocus
                        autoComplete="username"
                    />
                    <div>
                        <label className="block text-sm font-medium text-ink-muted mb-2">Passord</label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={handlePasswordChange}
                                onKeyDown={handlePasswordKeyState}
                                onKeyUp={handlePasswordKeyState}
                                onBlur={() => setIsCapsLockOn(false)}
                                disabled={isLoading}
                                className="w-full px-4 py-3.5 pr-12 bg-surface-50 border border-surface-200 rounded-xl focus:ring-2 focus:ring-accent focus:border-accent outline-none transition-all disabled:opacity-50 font-medium placeholder-ink-faint"
                                placeholder="Skriv inn passord"
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(prev => !prev)}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-ink-faint hover:bg-surface-100 hover:text-ink transition-colors"
                                aria-label={showPassword ? 'Skjul passord' : 'Vis passord'}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        {isCapsLockOn && (
                            <p className="text-warning bg-warning/10 border border-warning/20 px-3 py-2 rounded-xl text-sm mt-2">
                                Caps Lock er på. Det kan gjøre passordet feil.
                            </p>
                        )}
                    </div>

                    </>}
                    {mustChangePassword && <>
                        <p className="text-sm text-ink-muted">Du har logget inn med et midlertidig passord. Velg et eget passord før du fortsetter.</p>
                        <TextField label="Nytt passord" type="password" autoComplete="new-password" autoFocus required minLength={8} value={newPassword} onChange={e => setNewPassword(e.target.value)} disabled={isLoading} placeholder="Minst 8 tegn" />
                        <TextField label="Bekreft nytt passord" type="password" autoComplete="new-password" required minLength={8} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} disabled={isLoading} />
                    </>}
                    {error && (
                        <div className="flex items-center gap-2 text-error bg-error/10 border border-error/20 px-4 py-3 rounded-xl text-sm">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <Button type="submit" disabled={isLoading || !username.trim() || !password} size="lg" className="w-full mt-6">
                        {isLoading ? (
                            <Loader2 className="animate-spin" size={20} />
                        ) : (
                            <>{mustChangePassword ? 'Lagre passord og fortsett' : 'Logg inn'} <ArrowRight size={18} /></>
                        )}
                    </Button>
                    {mustChangePassword && <button type="button" disabled={isLoading} className="w-full text-sm text-ink-muted" onClick={() => { setMustChangePassword(false); setPassword(''); setNewPassword(''); setConfirmPassword(''); setError(''); }}>Tilbake til innlogging</button>}
                </form>
            </div>

            <p className="absolute bottom-8 text-ink-faint text-xs">JNM Coaching © {new Date().getFullYear()}</p>
        </div>
    );
});

export default LoginScreen;
