import api from './api';

export const approvalService = {
    async getPendingApprovals(params = {}) {
        const res = await api.get('/sicuti/leave-request/pending-approval', params);
        if (Array.isArray(res?.data)) return res.data;
        if (Array.isArray(res?.data?.data)) return res.data.data;
        if (Array.isArray(res)) return res;
        return [];
    },

    async getApprovalHistory(params = {}) {
        const res = await api.get('/sicuti/leave-request/approval-history', params);
        if (Array.isArray(res?.data?.data)) return res.data.data;
        if (Array.isArray(res?.data)) return res.data;
        if (Array.isArray(res)) return res;
        return [];
    },

    async processApproval({ idRequest, id_request, action, notes, signature }) {
        const payload = {
            id_request: idRequest || id_request,
            action: action || 'approve',
            notes: notes || undefined,
            signature: signature || undefined
        };
        const res = await api.post('/sicuti/leave-request/approve', payload);
        return res?.data || res;
    }
};

export default approvalService;
