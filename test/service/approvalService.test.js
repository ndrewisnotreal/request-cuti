import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/service/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

import api from '@/service/api';
import { approvalService } from '@/service/approvalService';

describe('approvalService kartu Sedang Cuti Hari Ini', () => {
    beforeEach(() => vi.clearAllMocks());

    it('getOnLeaveToday memakai endpoint khusus dashboard approver (nama tidak disamarkan)', async () => {
        api.get.mockResolvedValue({ data: [{ nama: 'Ikhsan Nugraha' }] });
        expect(await approvalService.getOnLeaveToday()).toEqual([{ nama: 'Ikhsan Nugraha' }]);
        expect(api.get).toHaveBeenCalledWith('/sicuti/leave-request/on-leave-today');
    });

    it('respons tidak berbentuk daftar → daftar kosong', async () => {
        api.get.mockResolvedValue({ data: null });
        expect(await approvalService.getOnLeaveToday()).toEqual([]);
    });
});
