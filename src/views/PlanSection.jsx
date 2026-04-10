import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Utensils, Dumbbell, Pencil, Loader2, Check, Eye, FileText, Heading1, List, ListOrdered, Bold, RotateCcw } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { Card, Button } from '../components/ui';

// Konfigurer marked (kun brukt her)
marked.setOptions({ breaks: true, gfm: true });

const PlanSection = React.memo(({ type, content, onSave, isReadOnly }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [text, setText] = useState(content);
    const [saveState, setSaveState] = useState('idle');
    const [activePane, setActivePane] = useState('write');
    const textareaRef = useRef(null);

    useEffect(() => {
        if (isEditing) return;
        setText(content);
        setSaveState('idle');
    }, [content, isEditing]);

    useEffect(() => {
        if (saveState !== 'saved') return;
        const timeoutId = setTimeout(() => setSaveState('idle'), 1800);
        return () => clearTimeout(timeoutId);
    }, [saveState]);

    const Icon = type === 'diet' ? Utensils : Dumbbell;
    const title = type === 'diet' ? 'Matplan' : 'Treningsplan';
    const template = type === 'diet'
        ? `# Ukeplan\n\n## Frokost\n- Velg 1 alternativ\n- Drikk vann eller kaffe\n\n## Lunsj\n- Protein\n- Karbohydrat\n- Grønnsaker\n\n## Middag\n- Protein\n- Poteter, ris eller pasta\n- Grønnsaker\n\n## Mellommåltid\n- Frukt eller yoghurt\n\n## Fokus denne uken\n- 8 000+ skritt daglig\n- Protein til hvert måltid\n`
        : `# Treningsuke\n\n## Dag 1 - Underkropp\n- Knebøy: 4 x 6\n- Rumensk markløft: 3 x 8\n- Utfall: 3 x 10 per bein\n\n## Dag 2 - Overkropp\n- Benkpress: 4 x 6\n- Sittende roing: 4 x 8\n- Skulderpress: 3 x 10\n\n## Kondisjon\n- 2 rolige økter á 25-30 min\n\n## Fokus denne uken\n- Kontrollerte repetisjoner\n- Stopp med 1-2 reps i reserve\n`;
    const canSave = text !== content && !isSaving;

    const applySelectionTransform = useCallback((transform) => {
        const el = textareaRef.current;
        if (!el) return;

        const start = el.selectionStart;
        const end = el.selectionEnd;
        const selectedText = text.slice(start, end);
        const { nextText, nextSelectionStart, nextSelectionEnd } = transform(text, selectedText, start, end);

        setText(nextText);
        setSaveState('dirty');

        requestAnimationFrame(() => {
            el.focus();
            el.setSelectionRange(nextSelectionStart, nextSelectionEnd);
        });
    }, [text]);

    const handleStartEditing = useCallback(() => {
        setText(content);
        setActivePane('write');
        setSaveState('idle');
        setIsEditing(true);
    }, [content]);

    const handleSave = useCallback(async () => {
        if (!canSave) return;
        setIsSaving(true);
        setSaveState('saving');
        try {
            await onSave(text);
            setSaveState('saved');
            setIsEditing(false);
        } finally {
            setIsSaving(false);
        }
    }, [canSave, onSave, text]);

    const handleCancel = useCallback(() => {
        setText(content);
        setSaveState('idle');
        setActivePane('write');
        setIsEditing(false);
    }, [content]);

    const handleTextChange = useCallback((e) => {
        setText(e.target.value);
        setSaveState('dirty');
    }, []);

    const handleInsertHeading = useCallback(() => {
        applySelectionTransform((currentText, selectedText, start, end) => {
            const insertion = selectedText ? `# ${selectedText}` : '# ';
            const nextText = currentText.slice(0, start) + insertion + currentText.slice(end);
            const caret = start + insertion.length;
            return {
                nextText,
                nextSelectionStart: caret,
                nextSelectionEnd: caret
            };
        });
    }, [applySelectionTransform]);

    const handleInsertBold = useCallback(() => {
        applySelectionTransform((currentText, selectedText, start, end) => {
            const inner = selectedText || 'viktig';
            const insertion = `**${inner}**`;
            const nextText = currentText.slice(0, start) + insertion + currentText.slice(end);
            const selectionStart = start + 2;
            const selectionEnd = start + 2 + inner.length;
            return {
                nextText,
                nextSelectionStart: selectionStart,
                nextSelectionEnd: selectionEnd
            };
        });
    }, [applySelectionTransform]);

    const handleInsertBullets = useCallback(() => {
        applySelectionTransform((currentText, selectedText, start, end) => {
            const baseText = selectedText || 'Punkt';
            const insertion = baseText
                .split('\n')
                .map(line => line.trim().length ? `- ${line}` : '- ')
                .join('\n');
            const nextText = currentText.slice(0, start) + insertion + currentText.slice(end);
            return {
                nextText,
                nextSelectionStart: start,
                nextSelectionEnd: start + insertion.length
            };
        });
    }, [applySelectionTransform]);

    const handleInsertNumbered = useCallback(() => {
        applySelectionTransform((currentText, selectedText, start, end) => {
            const baseText = selectedText || 'Steg';
            const insertion = baseText
                .split('\n')
                .map((line, index) => `${index + 1}. ${line.trim().length ? line : ''}`)
                .join('\n');
            const nextText = currentText.slice(0, start) + insertion + currentText.slice(end);
            return {
                nextText,
                nextSelectionStart: start,
                nextSelectionEnd: start + insertion.length
            };
        });
    }, [applySelectionTransform]);

    const handleInsertTemplate = useCallback(() => {
        setText(template);
        setSaveState('dirty');
        setActivePane('write');
        requestAnimationFrame(() => {
            textareaRef.current?.focus();
            textareaRef.current?.setSelectionRange(template.length, template.length);
        });
    }, [template]);

    // Memoize parsed markdown (sanitert med DOMPurify)
    const parsedContent = useMemo(() => {
        if (!text) return '<p class="text-ink-muted italic text-center py-12">Ingen plan enda</p>';
        const rawHtml = marked.parse(text);
        const sanitizedHtml = DOMPurify.sanitize(rawHtml);
        return sanitizedHtml
            .replace(/<table>/g, '<div class="plan-table-wrap"><table>')
            .replace(/<\/table>/g, '</table></div>');
    }, [text]);

    const toolbarButtons = [
        { icon: Heading1, label: 'Overskrift', onClick: handleInsertHeading },
        { icon: List, label: 'Punktliste', onClick: handleInsertBullets },
        { icon: ListOrdered, label: 'Nummerert', onClick: handleInsertNumbered },
        { icon: Bold, label: 'Fet tekst', onClick: handleInsertBold }
    ];

    return (
        <div className="space-y-5 pb-32 animate-slide-up">
            <Card className="overflow-hidden">
                <div className="flex justify-between items-center p-5 border-b border-surface-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-surface-100 rounded-xl flex items-center justify-center text-ink-muted">
                            <Icon size={20} />
                        </div>
                        <div>
                            <h2 className="font-display text-xl">{title}</h2>
                            {!isReadOnly && saveState !== 'idle' && (
                                <p className="text-xs text-ink-muted mt-0.5">
                                    {saveState === 'saving'
                                        ? 'Lagrer endringer...'
                                        : saveState === 'saved'
                                            ? 'Lagret'
                                            : 'Ulagrede endringer'}
                                </p>
                            )}
                        </div>
                    </div>
                    {!isReadOnly && (
                        isEditing ? (
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isSaving}>
                                    <RotateCcw size={16} /> Avbryt
                                </Button>
                                <Button variant="primary" size="sm" onClick={handleSave} disabled={!canSave}>
                                    {isSaving ? <><Loader2 size={16} className="animate-spin" /> Lagrer...</> : <><Check size={16} /> Lagre</>}
                                </Button>
                            </div>
                        ) : (
                            <Button variant="secondary" size="sm" onClick={handleStartEditing}>
                                <Pencil size={16} /> Rediger
                            </Button>
                        )
                    )}
                </div>

                {isEditing && !isReadOnly && (
                    <div className="border-b border-surface-100 bg-white/95 backdrop-blur-sm">
                        <div className="px-5 py-4 space-y-4">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                <div className="inline-flex rounded-2xl bg-surface-100 p-1">
                                    <button
                                        type="button"
                                        onClick={() => setActivePane('write')}
                                        className={`px-4 py-2 text-sm font-medium rounded-xl transition-all ${activePane === 'write' ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink'}`}
                                    >
                                        <span className="inline-flex items-center gap-2">
                                            <Pencil size={16} /> Skriv
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActivePane('preview')}
                                        className={`px-4 py-2 text-sm font-medium rounded-xl transition-all ${activePane === 'preview' ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink'}`}
                                    >
                                        <span className="inline-flex items-center gap-2">
                                            <Eye size={16} /> Forhåndsvis
                                        </span>
                                    </button>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                    <Button variant="secondary" size="sm" onClick={handleInsertTemplate}>
                                        <FileText size={16} /> Sett inn mal
                                    </Button>
                                    {toolbarButtons.map(({ icon: ToolbarIcon, label, onClick }) => (
                                        <button
                                            key={label}
                                            type="button"
                                            onClick={onClick}
                                            className="inline-flex items-center gap-2 rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-ink-muted hover:text-ink hover:border-surface-300 transition-colors"
                                            aria-label={label}
                                            title={label}
                                        >
                                            <ToolbarIcon size={16} />
                                            <span className="hidden sm:inline">{label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="p-5">
                    {isEditing && !isReadOnly ? (
                        <div className="space-y-4">
                            {activePane === 'write' ? (
                                <textarea
                                    ref={textareaRef}
                                    value={text}
                                    onChange={handleTextChange}
                                    autoFocus
                                    className="w-full min-h-[58vh] p-5 bg-[#fcfaf7] rounded-[1.4rem] border border-surface-200 focus:ring-2 focus:ring-ink focus:border-ink outline-none text-ink font-mono text-[15px] leading-7 resize-none shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
                                    placeholder="Skriv planen her..."
                                />
                            ) : (
                                <div className="rounded-[1.4rem] border border-surface-200 bg-[#fcfaf7] p-5 min-h-[58vh]">
                                    <div
                                        className="plan-prose max-w-none"
                                        dangerouslySetInnerHTML={{ __html: parsedContent }}
                                    />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div
                            className="plan-prose max-w-none"
                            dangerouslySetInnerHTML={{ __html: parsedContent }}
                        />
                    )}
                </div>
            </Card>
        </div>
    );
});

export default PlanSection;
