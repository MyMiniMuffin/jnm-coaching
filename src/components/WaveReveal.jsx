import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { JNM_WAVE_PALETTE, JNM_WAVE_STYLE, loadWaveController, preloadWaveController } from '../lib/wave';

// Stabil markup fra første render, så skjemaet aldri remountes når biblioteket lastes.
// Stilobjektene er konstante: React skriver aldri over det kontrolleren setter.
const ROOT = { display: 'grid', isolation: 'isolate', overflow: 'hidden' };
const LAYER = { gridArea: '1 / 1', minWidth: 0, minHeight: 0, isolation: 'isolate' };
const LAYER_HIDDEN = { ...LAYER, opacity: 0, pointerEvents: 'none' };
// Kvitteringen dekker skjemaet under seg, så crossfaden (Reduser bevegelse) og
// overleveringen etter bølgen aldri viser to tekstlag oppå hverandre.
const LAYER_REVEALED = { ...LAYER_HIDDEN, background: 'inherit' };
// Skjemaets opacity skrives i hvert bilde. Uten overgang: Reduser bevegelse-regelen i index.css
// gir ellers alt en overgang på 0,01 ms, og da kommer skjemaet ett bilde etter kvitteringen.
const FORM = { transitionProperty: 'none' };

// rAF pauser i bakgrunnen; da må appen gå videre likevel.
const SAFETY_MS = 6000;
// Skjemaet er tonet helt ut når kvitteringslaget er 1 / 4 = 25 % synlig.
const FORM_FADE_RATIO = 4;

/**
 * Bølgeovergang fra `children` til `revealedContent`.
 * - armed: innsending pågår. Kontrolleren opprettes og tar bilde av skjemaet.
 * - revealed: innsendingen lyktes. Bølgen kjøres (eller hoppes over uten bibliotek).
 * - getAnchorTop(): funksjon som gir viewport-y (px) der det nye innholdet skal starte.
 *   Kalles bare i det revealed blir true.
 * - onFinish({ top, height }): kalles én gang per kjøring; top er innholdets viewport-top,
 *   height er bølgeflatens høyde rett før byttet.
 */
const WaveReveal = ({
    revealed = false,
    armed = false,
    source,
    revealedContent = null,
    children,
    onFinish,
    getAnchorTop,
    className = '',
    layerClassName = '',
}) => {
    const rootRef = useRef(null);
    const contentLayerRef = useRef(null);
    const contentInnerRef = useRef(null);
    const revealedLayerRef = useRef(null);
    const padRef = useRef(null);
    const measureRef = useRef(null);
    const controllerRef = useRef(null);
    const onFinishRef = useRef(onFinish);
    onFinishRef.current = onFinish;
    const sourceRef = useRef(source);
    sourceRef.current = source;

    useEffect(() => { preloadWaveController(); }, []);

    useEffect(() => {
        if (!armed) return undefined;
        let cancelled = false;
        let made = null;
        loadWaveController().then((WaveController) => {
            if (cancelled || !WaveController || !rootRef.current) return;
            try {
                made = new WaveController(rootRef.current, contentLayerRef.current, revealedLayerRef.current);
                made.update({
                    revealed: false,
                    source: sourceRef.current,
                    palette: JNM_WAVE_PALETTE,
                    waveStyle: JNM_WAVE_STYLE,
                    capture: false,
                    prewarm: false,
                    live: true,
                    reducedMotion: 'system',
                });
                controllerRef.current = made;
                made.prepare().catch(() => {});
            } catch (error) {
                console.error('[WaveReveal] Kunne ikke opprette kontrolleren:', error);
                try { made?.destroy(); } catch (e) { /* ingenting å rydde */ }
                made = null;
                controllerRef.current = null;
            }
        });
        return () => {
            cancelled = true;
            if (made) {
                try { made.reset(); made.destroy(); } catch (e) { /* allerede ryddet */ }
            }
            if (controllerRef.current === made) controllerRef.current = null;
        };
    }, [armed]);

    useLayoutEffect(() => {
        if (!revealed) return undefined;

        // Kvitteringens topp ligger alltid på anchorTop; root vokser om laget blir høyere.
        const pad = padRef.current;
        const root = rootRef.current;
        if (pad && root) {
            pad.style.paddingTop = '0px';
            const anchor = getAnchorTop ? getAnchorTop() : 0;
            pad.style.paddingTop = `${Math.max(0, anchor - root.getBoundingClientRect().top)}px`;
        }

        let finished = false;
        let timer = 0;
        const finish = () => {
            if (finished) return;
            finished = true;
            window.clearTimeout(timer);
            const top = measureRef.current ? measureRef.current.getBoundingClientRect().top : 0;
            const height = rootRef.current ? rootRef.current.getBoundingClientRect().height : 0;
            onFinishRef.current?.({ top, height });
        };

        const controller = controllerRef.current;
        if (!controller) {
            finish();
            return undefined;
        }
        timer = window.setTimeout(finish, SAFETY_MS);
        // Biblioteket toner kvitteringslaget inn under fargen. Skjemaet og den faste send-linjen
        // følger hver skriving til laget før neste bilde tegnes: skjemaet er borte når kvitteringen
        // er 25 % synlig, send-linjen i takt med kvitteringen (--wave-revealed i CSS). Det virker
        // likt for bølgen og for crossfaden ved Reduser bevegelse, uansett hvor lang overgangen er.
        const inner = contentInnerRef.current;
        const layer = revealedLayerRef.current;
        const page = document.documentElement;
        const follow = () => {
            const shown = layer.style.opacity === '' ? 1 : Number(layer.style.opacity) || 0;
            inner.style.opacity = String(Math.max(0, 1 - shown * FORM_FADE_RATIO));
            page.style.setProperty('--wave-revealed', String(shown));
        };
        const observer = inner && layer ? new MutationObserver(follow) : null;
        if (observer) {
            observer.observe(layer, { attributes: true, attributeFilter: ['style'] });
            follow();
        }
        try {
            controller.update({
                revealed: true,
                source: sourceRef.current,
                palette: JNM_WAVE_PALETTE,
                waveStyle: JNM_WAVE_STYLE,
                capture: false,
                prewarm: false,
                live: true,
                reducedMotion: 'system',
                onFinish: (isRevealed) => { if (isRevealed) finish(); },
            });
        } catch (error) {
            console.error('[WaveReveal] Bølgen feilet:', error);
            finish();
        }
        return () => {
            window.clearTimeout(timer);
            observer?.disconnect();
            if (inner) inner.style.opacity = '';
            page.style.removeProperty('--wave-revealed');
        };
        // getAnchorTop kalles bare i det revealed blir true.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [revealed]);

    return (
        <div ref={rootRef} data-distortion-wave="" className={className} style={ROOT}>
            <div ref={contentLayerRef} data-dw-layer="content" className={layerClassName} style={LAYER}>
                <div ref={contentInnerRef} style={FORM}>{children}</div>
            </div>
            <div ref={revealedLayerRef} data-dw-layer="revealed" className={layerClassName} style={LAYER_REVEALED}>
                <div ref={padRef}>
                    <div ref={measureRef}>{revealedContent}</div>
                </div>
            </div>
        </div>
    );
};

export default WaveReveal;
