export const getScoreTone = (value) => {
    const score = value == null || value === '' ? NaN : Number(value);
    if (!Number.isFinite(score) || score < 1 || score > 10) return 'neutral';
    return score >= 8 ? 'good' : score >= 5 ? 'medium' : 'poor';
};

export const getReportTone = (report) => {
    const scores = [report.accuracy, report.energy, report.sleep];
    if (scores.some(score => getScoreTone(score) === 'neutral')) return 'neutral';
    return getScoreTone(scores.reduce((sum, score) => sum + Number(score), 0) / scores.length);
};
