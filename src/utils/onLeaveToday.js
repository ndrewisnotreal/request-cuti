const APPROVED = ['approved', 'completed'];

export function localIsoDate(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export function shortDate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    return m ? `${Number(m[3])} ${SHORT_MONTHS[Number(m[2]) - 1]}` : '-';
}

export function onLeaveToday(leaves, today) {
    const day = (v) => String(v || '').slice(0, 10);
    return (leaves || [])
        .filter((l) => APPROVED.includes(l.status) && day(l.start_date) <= today && day(l.end_date || l.start_date) >= today)
        .sort((a, b) => day(a.end_date).localeCompare(day(b.end_date)) || String(a.nama || '').localeCompare(String(b.nama || '')));
}
