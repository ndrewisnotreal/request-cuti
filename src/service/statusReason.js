export const STATUS_REASON_OPTIONS = [
    { value: 'KONTRAK_HABIS', label: 'Kontrak habis' },
    { value: 'RESIGN', label: 'Resign' },
    { value: 'PENSIUN', label: 'Pensiun' },
    { value: 'MUTASI', label: 'Mutasi' },
    { value: 'LAINNYA', label: 'Lainnya' }
];

export function statusReasonLabel(code) {
    if (!code) return '';
    return STATUS_REASON_OPTIONS.find((o) => o.value === code)?.label || code;
}

export function statusFormProblem({ reason, note } = {}) {
    if (!reason) return 'Pilih alasan menonaktifkan akun';
    if (reason === 'LAINNYA' && !String(note || '').trim()) return 'Keterangan wajib diisi bila alasan Lainnya';
    return null;
}

export function isAccountActive(user) {
    const code = user?.status_user || user?.status || (user?.isActive === false ? 'N' : 'A');
    return code === 'A';
}

export function statusSummary(user) {
    if ((user?.status_user || user?.status) !== 'N') return '';
    const label = statusReasonLabel(user.status_reason);
    const note = String(user.status_note || '').trim();
    if (label && note) return `${label} — ${note}`;
    return label || note || 'Alasan belum dicatat';
}
