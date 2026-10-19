import React from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import { PrivacyContent, SupportContent } from './LegalContent';

const isSupport = location.pathname.startsWith('/support');
createRoot(document.getElementById('root')).render(
    <main className="min-h-screen bg-surface-50 px-5 py-12 sm:py-20">
        <article className="mx-auto max-w-2xl rounded-2xl border border-surface-200 bg-white p-6 sm:p-10">
            <a href="/" className="text-sm text-accent">← JNM Coaching</a>
            <h1 className="my-6 text-4xl font-display text-ink">{isSupport ? 'Hjelp og kontakt' : 'Personvern'}</h1>
            {isSupport ? <SupportContent /> : <PrivacyContent />}
            <nav className="mt-8 border-t border-surface-200 pt-5 text-sm text-accent" aria-label="Informasjon">
                <a href={isSupport ? '/personvern/' : '/support/'} className="underline">{isSupport ? 'Personvern' : 'Hjelp og kontakt'}</a>
            </nav>
        </article>
    </main>
);
