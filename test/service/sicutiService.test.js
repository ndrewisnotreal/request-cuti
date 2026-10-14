import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatDate, formatTimeAgo, getStatusLabel, isStepApprover, isSubstituteRequired, lastReturnNote, stepApproverName } from '@/service/sicutiService';

describe('calon approver di langkah pengajuan', () => {
    it('stepApproverName: yang bertindak, atau semua calon selama belum ditindak', () => {
        expect(stepApproverName({ approver_name: 'Hizkia', candidate_names: ['Hizkia', 'Raka'] })).toBe('Hizkia');
        expect(stepApproverName({ uid_approver: null, candidate_names: ['Hizkia', 'Raka'] })).toBe('Hizkia / Raka');
        expect(stepApproverName({}, { approver_name: 'Jabbar' })).toBe('Jabbar');
        expect(stepApproverName({})).toBe('Pejabat Penyetuju');
    });

    it('isStepApprover: yang bertindak atau salah satu calon', () => {
        expect(isStepApprover({ uid_candidates: ['USR002', 'USR014'] }, 'USR014')).toBe(true);
        expect(isStepApprover({ uid_approver: 'USR007' }, 'USR007')).toBe(true);
        expect(isStepApprover({ uid_candidates: ['USR002'] }, 'USR109')).toBe(false);
        expect(isStepApprover(null, 'USR002')).toBe(false);
    });
});

describe('lastReturnNote', () => {
    it('mengambil catatan pengembalian terbaru dari data list (camelCase)', () => {
        const req = {
            approvalRecords: [
                { action: 'return', notes: 'Catatan lama', approverName: 'Raka', createdAt: '2026-09-29T02:00:00Z' },
                { action: 'approve', notes: 'OK', approverName: 'Raka', createdAt: '2026-09-30T02:00:00Z' },
                { action: 'return', notes: ' Lampirkan jadwal ', approverName: 'Jabbar', createdAt: '2026-09-30T03:00:00Z' }
            ]
        };
        expect(lastReturnNote(req)).toEqual({ approverName: 'Jabbar', notes: 'Lampirkan jadwal' });
    });

    it('membaca data detail backend (snake_case) dan null bila tidak pernah dikembalikan', () => {
        expect(lastReturnNote({ approval_records: [{ action: 'return', notes: 'Revisi', approver_name: 'Raka', created_at: '2026-09-30' }] })).toEqual({
            approverName: 'Raka',
            notes: 'Revisi'
        });
        expect(lastReturnNote({ approvalRecords: [{ action: 'approve' }] })).toBeNull();
        expect(lastReturnNote(null)).toBeNull();
    });
});

describe('format tanggal & status', () => {
    afterEach(() => vi.useRealTimers());

    it('formatDate menulis tanggal panjang berbahasa Indonesia', () => {
        expect(formatDate('2026-12-08')).toBe('8 Desember 2026');
        expect(formatDate('')).toBe('-');
    });

    it('formatTimeAgo memberi waktu relatif', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-09-30T12:00:00Z'));
        expect(formatTimeAgo('2026-09-30T11:59:30Z')).toBe('Baru saja');
        expect(formatTimeAgo('2026-09-30T11:45:00Z')).toBe('15 mnt lalu');
        expect(formatTimeAgo('2026-09-30T09:00:00Z')).toBe('3 jam lalu');
        expect(formatTimeAgo('2026-09-29T11:00:00Z')).toBe('Kemarin');
    });

    it('label status mengikuti prototype', () => {
        expect(getStatusLabel('pending_validation')).toBe('Menunggu Validasi');
        expect(getStatusLabel('returned')).toBe('Dikembalikan');
    });
});

describe('isSubstituteRequired', () => {
    it('pengganti opsional hanya untuk Staff IT', () => {
        expect(isSubstituteRequired({ role: 'staff_it' })).toBe(false);
        expect(isSubstituteRequired({ kd_role: 'staff_seksi' })).toBe(true);
    });
});
