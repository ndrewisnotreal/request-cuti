import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/service/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

import api from '@/service/api';
import { leaveService } from '@/service/leaveService';

describe('leaveService draf pengajuan (QA #7)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('createLeave mengirim is_draft saat menyimpan draf', async () => {
        api.post.mockResolvedValue({ data: { id_request: 'REQ-1', status: 'draft' } });
        await leaveService.createLeave({ kd_leave_type: 'LT001', start_date: '2030-01-07', end_date: '2030-01-07', is_draft: true });
        expect(api.post).toHaveBeenCalledWith('/sicuti/leave-request', expect.objectContaining({ is_draft: true }));
    });

    it('createLeave biasa tidak mengirim is_draft', async () => {
        api.post.mockResolvedValue({ data: {} });
        await leaveService.createLeave({ kd_leave_type: 'LT001', start_date: '2030-01-07', end_date: '2030-01-07' });
        expect(api.post.mock.calls[0][1]).not.toHaveProperty('is_draft');
    });

    it('resubmitLeave meneruskan is_draft untuk simpan perubahan draf', async () => {
        api.put.mockResolvedValue({ data: {} });
        await leaveService.resubmitLeave('REQ-SIT-0001/2030', { kd_leave_type: 'LT001', start_date: '2030-01-07', end_date: '2030-01-07', is_draft: true });
        expect(api.put).toHaveBeenCalledWith('/sicuti/leave-request/REQ-SIT-0001%2F2030', expect.objectContaining({ is_draft: true }));
    });
});
