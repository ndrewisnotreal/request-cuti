import { afterEach, describe, expect, it } from 'vitest';
import { appMode, canSubmitLeave, currentUser, isApplicant, isApprovalOnly } from '@/service/sicutiService';
import { userAbilities } from '@/service/authService';

// Approver tidak mengajukan cuti: tanpa sakelar Pengajuan/Approval dan tanpa riwayat pengajuan pribadi
describe('approver selalu mode Approval', () => {
    afterEach(() => {
        currentUser.value = null;
        userAbilities.value = [];
    });

    it('Staff Approval yang punya izin pengajuan tetap hanya Approval', () => {
        currentUser.value = { id: 'USR002', role: 'staff_approval', kd_role: 'staff_approval' };
        userAbilities.value = ['approval.view_requests', 'approval.approve_reject', 'pengajuan_cuti.submit', 'dokumen_saldo.view_history'];
        expect(isApprovalOnly()).toBe(true);
        expect(isApplicant()).toBe(false);
        expect(canSubmitLeave()).toBe(false);
        expect(appMode.value).toBe('approval');
    });

    it('akun lain berperan Staff Approval dibaca sebagai hanya Approval', () => {
        expect(isApprovalOnly({ id: 'X', role: 'staff_approval', kd_role: 'staff_approval' })).toBe(true);
    });

    it('Staff IT tetap pemohon dengan mode Pengajuan', () => {
        currentUser.value = { id: 'USR109', role: 'staff_it', kd_role: 'staff_it' };
        userAbilities.value = ['pengajuan_cuti.submit', 'dokumen_saldo.view_history'];
        expect(isApprovalOnly()).toBe(false);
        expect(isApplicant()).toBe(true);
        expect(appMode.value).toBe('user');
    });
});
