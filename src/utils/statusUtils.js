export const STATUS_LABELS = {
    draft: 'Draf',
    submitted: 'Diajukan',
    pending_validation: 'Menunggu Validasi',
    approved: 'Disetujui',
    rejected: 'Ditolak',
    returned: 'Dikembalikan',
    processing: 'Diproses',
    completed: 'Selesai',
    cancelled: 'Dibatalkan'
};

export function getStatusSeverity(status) {
    switch (status?.toLowerCase()) {
        case 'approved':
        case 'completed':
            return 'success';
        case 'submitted':
        case 'pending_validation':
            return 'warn';
        case 'processing':
            return 'info';
        case 'rejected':
            return 'danger';
        case 'returned':
            return 'warn';
        case 'draft':
        case 'cancelled':
        default:
            return 'secondary';
    }
}

export function getStatusLabel(status) {
    return STATUS_LABELS[status] || status;
}

export const STATUS_OPTIONS = [
    { label: 'Semua Status', value: null },
    ...['submitted', 'pending_validation', 'approved', 'returned', 'rejected', 'cancelled', 'draft'].map((value) => ({
        label: STATUS_LABELS[value],
        value
    }))
];
