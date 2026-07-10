const PLAN_FORMAT = 'jnm-plan';
const PLAN_VERSION = 1;

let keyCounter = 0;
const createKey = (prefix) => `${prefix}-${Date.now()}-${++keyCounter}`;

const createItem = (text = '') => ({ key: createKey('item'), text });

export const createSection = (title = '', items = ['']) => ({
    key: createKey('section'),
    title,
    items: items.map(item => createItem(typeof item === 'string' ? item : item?.text || ''))
});

const cleanMarkdown = (value) => value
    .replace(/<[^>]*>/g, '')
    .replace(/^\s*>\s?/, '')
    .replace(/^\s*(?:[-+*]|\d+[.)])\s+/, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_~`]/g, '')
    .trim();

const parseLegacyTableRow = (line) => {
    if (!line.includes('|')) return null;
    const cells = line
        .split('|')
        .map(cell => cleanMarkdown(cell))
        .filter(Boolean);
    if (!cells.length || cells.every(cell => /^:?-{3,}:?$/.test(cell))) return '';
    return cells.join(' · ');
};

const parseLegacyPlan = (content) => {
    const sections = [];
    let current = null;

    const ensureSection = () => {
        if (!current) {
            current = createSection('Plan', []);
            sections.push(current);
        }
        return current;
    };

    String(content || '').replace(/\r\n?/g, '\n').split('\n').forEach(rawLine => {
        const line = rawLine.trim();
        if (!line || /^-{3,}$/.test(line)) return;

        const heading = line.match(/^#{1,6}\s+(.+)$/);
        if (heading) {
            const title = cleanMarkdown(heading[1]);
            if (current && current.items.length === 0) {
                current.title = title;
            } else {
                current = createSection(title, []);
                sections.push(current);
            }
            return;
        }

        const tableRow = parseLegacyTableRow(line);
        const text = tableRow === null ? cleanMarkdown(line) : tableRow;
        if (text) ensureSection().items.push(createItem(text));
    });

    return { sections: sections.filter(section => section.title || section.items.length) };
};

export const parsePlan = (content) => {
    if (!content || !String(content).trim()) return { sections: [] };

    try {
        const parsed = JSON.parse(content);
        if (parsed?.format === PLAN_FORMAT && Array.isArray(parsed.sections)) {
            return {
                sections: parsed.sections.map(section => createSection(
                    typeof section?.title === 'string' ? section.title : '',
                    Array.isArray(section?.items)
                        ? section.items.map(item => typeof item === 'string' ? item : item?.text || '')
                        : []
                ))
            };
        }
    } catch {
        // Eldre planer er lagret som Markdown og konverteres til blokker lokalt.
    }

    return parseLegacyPlan(content);
};

export const serializePlan = (plan) => {
    const sections = (plan?.sections || [])
        .map(section => ({
            title: String(section.title || '').trim(),
            items: (section.items || [])
                .map(item => String(typeof item === 'string' ? item : item?.text || '').trim())
                .filter(Boolean)
        }))
        .filter(section => section.title || section.items.length);

    if (!sections.length) return '';

    return JSON.stringify({
        format: PLAN_FORMAT,
        version: PLAN_VERSION,
        sections
    });
};

export const getPlanTemplate = (type) => ({
    sections: type === 'diet'
        ? [
            createSection('Frokost', ['Velg ett alternativ', 'Drikk vann eller kaffe']),
            createSection('Lunsj', ['Proteinkilde', 'Karbohydratkilde', 'Grønnsaker']),
            createSection('Middag', ['Proteinkilde', 'Poteter, ris eller pasta', 'Grønnsaker']),
            createSection('Mellommåltid', ['Frukt, yoghurt eller et annet avtalt alternativ']),
            createSection('Fokus denne uken', ['Protein til hvert måltid', 'Følg avtalt måltidsrytme'])
        ]
        : [
            createSection('Dag 1 – Underkropp', ['Knebøy – 4 × 6', 'Rumensk markløft – 3 × 8', 'Utfall – 3 × 10 per bein']),
            createSection('Dag 2 – Overkropp', ['Benkpress – 4 × 6', 'Sittende roing – 4 × 8', 'Skulderpress – 3 × 10']),
            createSection('Kondisjon', ['2 rolige økter à 25–30 minutter']),
            createSection('Fokus denne uken', ['Kontrollerte repetisjoner', 'Stopp med 1–2 repetisjoner i reserve'])
        ]
});
