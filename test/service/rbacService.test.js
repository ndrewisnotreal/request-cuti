import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/service/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

import api from '@/service/api';
import { rbacService } from '@/service/rbacService';

describe('rbacService.createRole', () => {
    beforeEach(() => vi.clearAllMocks());

    it('mengirim level peran sumber agar kelompok peran ikut tersalin', async () => {
        api.post.mockResolvedValue({ data: { kd_role: 'kepala_seksi_baru' } });
        await rbacService.createRole({ nm_role: 'Kepala Seksi Baru', abilities: ['persetujuan.approve'], level: 30 });
        expect(api.post).toHaveBeenCalledWith('/master/role-ability', { nm_role: 'Kepala Seksi Baru', abilities: ['persetujuan.approve'], level: 30 });
    });

    it('tanpa peran sumber tidak mengirim level (backend memakai bawaan Karyawan)', async () => {
        api.post.mockResolvedValue({ data: { kd_role: 'baru' } });
        await rbacService.createRole({ nm_role: 'Baru' });
        expect(api.post).toHaveBeenCalledWith('/master/role-ability', { nm_role: 'Baru', abilities: [] });
    });
});
