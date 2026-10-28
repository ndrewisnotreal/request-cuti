import { describe, expect, it } from 'vitest';
import { STATUS_REASON_OPTIONS, isAccountActive, statusFormProblem, statusReasonLabel, statusSummary } from '@/service/statusReason';

describe('alasan nonaktif karyawan', () => {
    it('pilihan alasan sama dengan backend', () => {
        expect(STATUS_REASON_OPTIONS.map((o) => o.value)).toEqual(['KONTRAK_HABIS', 'RESIGN', 'PENSIUN', 'MUTASI', 'LAINNYA']);
        expect(statusReasonLabel('KONTRAK_HABIS')).toBe('Kontrak habis');
        expect(statusReasonLabel(null)).toBe('');
    });

    it('validasi dialog: alasan wajib, keterangan wajib bila Lainnya', () => {
        expect(statusFormProblem({ reason: null, note: '' })).toBe('Pilih alasan menonaktifkan akun');
        expect(statusFormProblem({ reason: 'LAINNYA', note: '  ' })).toBe('Keterangan wajib diisi bila alasan Lainnya');
        expect(statusFormProblem({ reason: 'LAINNYA', note: 'Cuti di luar tanggungan' })).toBeNull();
        expect(statusFormProblem({ reason: 'RESIGN', note: '' })).toBeNull();
    });

    it('ringkasan di bawah badge Nonaktif', () => {
        expect(statusSummary({ status_user: 'N', status_reason: 'KONTRAK_HABIS', status_note: 'Berakhir 30 Sep' })).toBe('Kontrak habis — Berakhir 30 Sep');
        expect(statusSummary({ status_user: 'N', status_reason: 'RESIGN' })).toBe('Resign');
        expect(statusSummary({ status_user: 'N', status_reason: null, status_note: 'Diubah lewat impor data karyawan' })).toBe('Diubah lewat impor data karyawan');
        expect(statusSummary({ status_user: 'N' })).toBe('Alasan belum dicatat');
        expect(statusSummary({ status_user: 'A', status_reason: 'RESIGN' })).toBe('');
    });
});

describe('isAccountActive (badge Aktif/Nonaktif di Data Karyawan)', () => {
    it('membaca status_user/status dari backend; nonaktif tidak boleh tampil Aktif', () => {
        expect(isAccountActive({ status_user: 'N', status: 'N' })).toBe(false);
        expect(isAccountActive({ status_user: 'A' })).toBe(true);
        expect(isAccountActive({ status: 'N' })).toBe(false);
        expect(isAccountActive({ isActive: false })).toBe(false);
        expect(isAccountActive({})).toBe(true);
    });
});
