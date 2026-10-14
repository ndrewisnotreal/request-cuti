import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/service/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

import api from '@/service/api';
import { adminService } from '@/service/adminService';

describe('adminService alur approval per templat', () => {
    beforeEach(() => vi.clearAllMocks());

    it('reorderApprovalFlows mengirim semua id_flow sesuai urutan baru', async () => {
        api.put.mockResolvedValue({ data: [{ id_flow: 'B' }, { id_flow: 'A' }] });
        const res = await adminService.reorderApprovalFlows('TPL_SITDEV', ['B', 'A']);
        expect(api.put).toHaveBeenCalledWith('/sicuti/approval-flow/order', { id_template: 'TPL_SITDEV', order: ['B', 'A'] });
        expect(res).toEqual([{ id_flow: 'B' }, { id_flow: 'A' }]);
    });

    it('anggota templat: ambil, tambah, keluarkan', async () => {
        api.get.mockResolvedValue({ data: [{ uid_user_system: 'USR109' }] });
        expect(await adminService.getTemplateMembers('TPL_SITDEV')).toEqual([{ uid_user_system: 'USR109' }]);
        expect(api.get).toHaveBeenCalledWith('/sicuti/approval-template/members', { id_template: 'TPL_SITDEV' });

        api.post.mockResolvedValue({ data: [] });
        await adminService.addTemplateMembers('TPL_SITDEV', ['USR109']);
        expect(api.post).toHaveBeenCalledWith('/sicuti/approval-template/members', { id_template: 'TPL_SITDEV', uids: ['USR109'] });

        api.delete.mockResolvedValue({ data: {} });
        await adminService.removeTemplateMember('USR 1');
        expect(api.delete).toHaveBeenCalledWith('/sicuti/approval-template/members?uid_user_system=USR%201');
    });

    it('peran approver, calon anggota, dan karyawan tanpa templat', async () => {
        api.get.mockResolvedValue({ data: [] });
        await adminService.getApproverRoles();
        await adminService.getMemberCandidates('TPL_SITADM');
        await adminService.getUnassignedEmployees();
        expect(api.get.mock.calls).toEqual([
            ['/sicuti/approval-flow/roles'],
            ['/sicuti/approval-template/candidates', { id_template: 'TPL_SITADM' }],
            ['/sicuti/approval-template/unassigned']
        ]);
    });
});
