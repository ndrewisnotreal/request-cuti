// Konfirmasi sebelum approver menyetujui, menolak, atau mengembalikan pengajuan
export function approvalConfirmOptions(action, request) {
    const id = request?.id_request || request?.id || '';
    const name = request?.requester_name || request?.userName || 'pemohon';
    const common = { rejectLabel: 'Batal', rejectProps: { severity: 'secondary', outlined: true } };

    if (action === 'approve') {
        return {
            ...common,
            header: 'Setujui pengajuan?',
            message: `Pengajuan cuti #${id} atas nama ${name} akan disetujui.`,
            acceptLabel: 'Ya, setujui',
            acceptProps: { severity: 'success' }
        };
    }
    if (action === 'reject') {
        return {
            ...common,
            header: 'Tolak pengajuan?',
            message: `Pengajuan cuti #${id} atas nama ${name} akan ditolak dan tidak dapat diproses lagi.`,
            acceptLabel: 'Ya, tolak',
            acceptProps: { severity: 'danger' }
        };
    }
    return {
        ...common,
        header: 'Kembalikan pengajuan?',
        message: `Pengajuan cuti #${id} akan dikembalikan ke ${name} untuk diperbaiki.`,
        acceptLabel: 'Ya, kembalikan',
        acceptProps: { severity: 'warn' }
    };
}
