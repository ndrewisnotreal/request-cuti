function toDateString(val) {
    if (!val) return null;
    if (val instanceof Date) {
        if (Number.isNaN(val.getTime())) return null;
        const y = val.getFullYear();
        const m = String(val.getMonth() + 1).padStart(2, '0');
        const d = String(val.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    const str = String(val).trim();
    if (str.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(str)) {
        return str.slice(0, 10);
    }
    const parsed = new Date(str);
    if (Number.isNaN(parsed.getTime())) return null;
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function countWorkingDays(startDate, endDate, holidayDateStrings = new Set()) {
    if (!startDate || !endDate) return 0;

    const startStr = toDateString(startDate);
    const endStr = toDateString(endDate);
    if (!startStr || !endStr) return 0;

    const cur = new Date(`${startStr}T00:00:00Z`);
    const end = new Date(`${endStr}T00:00:00Z`);

    if (Number.isNaN(cur.getTime()) || Number.isNaN(end.getTime()) || end < cur) {
        return 0;
    }

    const holidays = holidayDateStrings instanceof Set ? holidayDateStrings : new Set(holidayDateStrings || []);
    let count = 0;

    while (cur <= end) {
        const day = cur.getUTCDay();
        const iso = cur.toISOString().slice(0, 10);
        if (day !== 0 && day !== 6 && !holidays.has(iso)) {
            count++;
        }
        cur.setUTCDate(cur.getUTCDate() + 1);
    }

    return count;
}
