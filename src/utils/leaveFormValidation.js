export function defaultFormatDate(d) {
    if (!d) return '';
    if (typeof d === 'string') {
        return d.split('T')[0];
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function validateLeaveForm({
    form,
    selectedLeaveType,
    calculatedDays,
    remainingBalance = 0,
    substituteRequired = false,
    formatDate = defaultFormatDate
}) {
    const s = formatDate(form?.startDate);
    const e = formatDate(form?.endDate);

    if (!form?.leaveTypeId) {
        return {
            valid: false,
            error: { severity: 'error', summary: 'Validasi', detail: 'Silakan pilih jenis cuti', life: 3000 }
        };
    }
    if (!s) {
        return {
            valid: false,
            error: { severity: 'error', summary: 'Validasi', detail: 'Pilih tanggal mulai cuti', life: 3000 }
        };
    }
    if (!e) {
        return {
            valid: false,
            error: { severity: 'error', summary: 'Validasi', detail: 'Pilih tanggal selesai yang sama dengan atau setelah tanggal mulai', life: 3000 }
        };
    }
    if (new Date(e) < new Date(s)) {
        return {
            valid: false,
            error: { severity: 'error', summary: 'Validasi', detail: 'Tanggal selesai harus setelah tanggal mulai', life: 3000 }
        };
    }
    if (calculatedDays <= 0) {
        return {
            valid: false,
            error: { severity: 'error', summary: 'Validasi', detail: 'Rentang tanggal tidak memuat hari kerja (akhir pekan/libur)', life: 3000 }
        };
    }

    if (selectedLeaveType?.usesQuota && calculatedDays > remainingBalance) {
        return {
            valid: false,
            error: {
                severity: 'error',
                summary: 'Saldo Kurang',
                detail: `Saldo cuti Anda (${remainingBalance} hari) tidak mencukupi untuk pengajuan ${calculatedDays} hari kerja`,
                life: 4000
            }
        };
    }

    if (selectedLeaveType?.maxDays && calculatedDays > selectedLeaveType.maxDays) {
        return {
            valid: false,
            error: {
                severity: 'error',
                summary: 'Melebihi Batas Hari',
                detail: `${selectedLeaveType.name} maksimal ${selectedLeaveType.maxDays} hari kerja per pengajuan (dipilih ${calculatedDays} hari)`,
                life: 4500
            }
        };
    }

    if (selectedLeaveType?.requiresDocument && !form?.documentName && !selectedLeaveType.allowLateDocument) {
        return {
            valid: false,
            error: {
                severity: 'error',
                summary: 'Dokumen Wajib',
                detail: `Jenis cuti ${selectedLeaveType.name} mensyaratkan dokumen fisik pendukung (misal: Surat Dokter)`,
                life: 4000
            }
        };
    }

    if (substituteRequired && !form?.substituteId) {
        return {
            valid: false,
            error: { severity: 'error', summary: 'Validasi', detail: 'Pilih rekan pengganti tugas selama Anda cuti', life: 3000 }
        };
    }

    if (!form?.reason || !form.reason.trim()) {
        return {
            valid: false,
            error: { severity: 'error', summary: 'Validasi', detail: 'Alasan pengajuan cuti wajib diisi', life: 3000 }
        };
    }

    return { valid: true };
}

export function validateDraftForm({ form, calculatedDays, formatDate = defaultFormatDate }) {
    if (!form?.leaveTypeId) {
        return { valid: false, error: { severity: 'error', summary: 'Validasi', detail: 'Pilih jenis cuti terlebih dahulu', life: 3000 } };
    }
    if (!form?.startDate || !form?.endDate) {
        return { valid: false, error: { severity: 'error', summary: 'Validasi', detail: 'Isi tanggal mulai dan tanggal selesai', life: 3000 } };
    }
    const s = formatDate(form.startDate);
    const e = formatDate(form.endDate);
    if (new Date(e) < new Date(s)) {
        return { valid: false, error: { severity: 'error', summary: 'Validasi', detail: 'Tanggal selesai harus setelah tanggal mulai', life: 3000 } };
    }
    if (calculatedDays <= 0) {
        return { valid: false, error: { severity: 'error', summary: 'Validasi', detail: 'Rentang tanggal tidak memuat hari kerja (akhir pekan/libur)', life: 3000 } };
    }
    return { valid: true };
}
