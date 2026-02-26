import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Utensils, Dumbbell, Pencil, Loader2, Check } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { Card, Button } from '../components/ui';

// Konfigurer marked (kun brukt her)
marked.setOptions({ breaks: true, gfm: true });

const PlanSection = React.memo(({ type, content, onSave, isReadOnly }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [text, setText] = useState(content);
    useEffect(() => setText(content), [content]);

    const Icon = type === 'diet' ? Utensils : Dumbbell;
    const title = type === 'diet' ? 'Matplan' : 'Treningsplan';

    const handleToggleEdit = useCallback(async () => {
        if (isEditing) {
            setIsSaving(true);
            try {
                await onSave(text);
            } finally {
                setIsSaving(false);
            }
        }
        setIsEditing(prev => !prev);
    }, [isEditing, text, onSave]);

    const handleTextChange = useCallback((e) => setText(e.target.value), []);

    // Memoize parsed markdown (sanitert med DOMPurify)
    const parsedContent = useMemo(() => {
        if (!text) return '<p class="text-ink-muted italic text-center py-12">Ingen plan enda</p>';
        const rawHtml = marked.parse(text);
        return DOMPurify.sanitize(rawHtml);
    }, [text]);

    return (
        <div className="space-y-5 pb-32 animate-slide-up">
            <Card className="overflow-hidden">
                <div className="flex justify-between items-center p-5 border-b border-surface-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-surface-100 rounded-xl flex items-center justify-center text-ink-muted">
                            <Icon size={20} />
                        </div>
                        <h2 className="font-display text-xl">{title}</h2>
                    </div>
                    {!isReadOnly && (
                        <Button
                            variant={isEditing ? 'primary' : 'secondary'}
                            size="sm"
                            onClick={handleToggleEdit}
                            disabled={isSaving}
                        >
                            {isSaving ? <><Loader2 size={16} className="animate-spin" /> Lagrer...</> : isEditing ? <><Check size={16} /> Lagre</> : <><Pencil size={16} /> Rediger</>}
                        </Button>
                    )}
                </div>

                <div className="p-5">
                    {isEditing && !isReadOnly ? (
                        <textarea 
                            value={text} 
                            onChange={handleTextChange} 
                            className="w-full min-h-[60vh] p-4 bg-surface-50 rounded-xl border border-surface-200 focus:ring-2 focus:ring-ink focus:border-ink outline-none text-ink font-mono text-sm leading-relaxed resize-none" 
                            placeholder="Skriv planen her..."
                        />
                    ) : (
                        <div 
                            className="prose prose-sm max-w-none" 
                            dangerouslySetInnerHTML={{ __html: parsedContent }} 
                        />
                    )}
                </div>
            </Card>
        </div>
    );
});

export default PlanSection;
