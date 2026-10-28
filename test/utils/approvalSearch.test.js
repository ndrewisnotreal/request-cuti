import { describe, expect, it } from 'vitest';
import { matchesApprovalSearch } from '@/utils/approvalSearch';

const REQ = { id_request: 'REQ-SIT-0001/2026', requester_name: 'Ikhsan Nugraha', nm_leave_type: 'Cuti Tahunan' };

describe('matchesApprovalSearch', () => {
    it('kueri kosong menampilkan semua', () => {
        expect(matchesApprovalSearch(REQ, '')).toBe(true);
        expect(matchesApprovalSearch(REQ, null)).toBe(true);
    });

    it('cocok dengan nama pemohon, nomor pengajuan, atau jenis cuti (tanpa beda huruf besar/kecil)', () => {
        expect(matchesApprovalSearch(REQ, 'ikhsan')).toBe(true);
        expect(matchesApprovalSearch(REQ, 'req-sit-0001')).toBe(true);
        expect(matchesApprovalSearch(REQ, 'TAHUNAN')).toBe(true);
        expect(matchesApprovalSearch(REQ, '  ikhsan  ')).toBe(true);
    });

    it('tidak cocok bila kata kunci tidak ada di ketiga kolom', () => {
        expect(matchesApprovalSearch(REQ, 'sakit')).toBe(false);
    });

    it('memakai nama kolom alternatif (userName, id, leaveTypeName, kd_leave_type)', () => {
        expect(matchesApprovalSearch({ id: 'REQ-X', userName: 'Raka' }, 'raka')).toBe(true);
        expect(matchesApprovalSearch({ leaveTypeName: 'Cuti Sakit' }, 'sakit')).toBe(true);
        expect(matchesApprovalSearch({ kd_leave_type: 'LT002' }, 'lt002')).toBe(true);
    });

    it('kueri berisi spasi saja dianggap cocok (sama seperti sebelumnya)', () => {
        expect(matchesApprovalSearch(REQ, '   ')).toBe(true);
    });
});
