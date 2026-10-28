import { describe, expect, it, vi } from 'vitest';
import {
    attachmentInfo,
    fetchAttachmentUrl,
    openAttachment,
    documentPending
} from '@/utils/attachmentUtils';
import {
    lastReturnNote,
    stepApproverName,
    isStepApprover,
    getUserApprovalLevel,
    getApprovalFlowsForRequest,
    getCurrentApprovalLevel,
    canUserApprove
} from '@/utils/approvalStepUtils';
import { api } from '@/service/api';

vi.mock('@/service/api', () => ({
    api: {
        blob: vi.fn().mockResolvedValue({
            blob: new Blob(['test-data'], { type: 'application/pdf' })
        })
    }
}));

describe('attachmentUtils', () => {
    it('returns null when no attachment is present', () => {
        expect(attachmentInfo(null)).toBeNull();
        expect(attachmentInfo({})).toBeNull();
    });

    it('extracts info for valid uploaded file', () => {
        const req = {
            id_request: 'REQ-001',
            attachment_url: '/uploads/documents/doc-123.jpg',
            attachment_name: 'Surat Dokter.jpg'
        };
        const info = attachmentInfo(req);
        expect(info).toEqual({
            name: 'Surat Dokter.jpg',
            hasFile: true,
            isImage: true,
            idRequest: 'REQ-001'
        });
    });

    it('identifies non-image documents correctly', () => {
        const req = {
            id: 'REQ-002',
            attachment_url: '/uploads/documents/surat.pdf'
        };
        const info = attachmentInfo(req);
        expect(info.isImage).toBe(false);
        expect(info.hasFile).toBe(true);
        expect(info.name).toBe('surat.pdf');
    });

    it('rejects external or unverified paths as hasFile: false', () => {
        const req = {
            id_request: 'REQ-003',
            attachment_url: 'https://external.com/file.png'
        };
        const info = attachmentInfo(req);
        expect(info.hasFile).toBe(false);
        expect(info.isImage).toBe(false);
    });

    it('detects documentPending status', () => {
        expect(documentPending({ document_due_date: '2025-06-20', attachment_url: '' })).toBe(true);
        expect(documentPending({ document_due_date: null })).toBe(false);
        expect(documentPending({ document_due_date: '2025-06-20', attachment_url: '/uploads/documents/a.pdf' })).toBe(false);
        expect(documentPending({ document_due_date: '2025-06-20', documents: [{ file_name: 'b.pdf' }] })).toBe(false);
    });

    it('fetchAttachmentUrl invokes api.blob', async () => {
        global.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/test');
        const url = await fetchAttachmentUrl('REQ-100');
        expect(api.blob).toHaveBeenCalledWith('/sicuti/leave-request/attachment', { id_request: 'REQ-100' });
        expect(url).toBe('blob:http://localhost/test');
    });

    it('openAttachment opens a window and navigates', async () => {
        const mockWin = { location: { href: '' }, close: vi.fn() };
        vi.stubGlobal('open', vi.fn().mockReturnValue(mockWin));
        await openAttachment('REQ-100');
        expect(mockWin.location.href).toBe('blob:http://localhost/test');
    });
});

describe('approvalStepUtils', () => {
    it('lastReturnNote returns the most recent return record', () => {
        const req = {
            approvalRecords: [
                { action: 'approve', approverName: 'Alice', createdAt: '2025-06-01T10:00:00Z' },
                { action: 'return', approverName: 'Bob', notes: 'Catatan pertama', createdAt: '2025-06-02T10:00:00Z' },
                { action: 'return', approverName: 'Charlie', notes: 'Catatan revisi terbaru', createdAt: '2025-06-03T10:00:00Z' }
            ]
        };
        const note = lastReturnNote(req);
        expect(note).toEqual({
            approverName: 'Charlie',
            notes: 'Catatan revisi terbaru'
        });
    });

    it('lastReturnNote returns null if no return record exists', () => {
        expect(lastReturnNote({ approvalRecords: [{ action: 'approve' }] })).toBeNull();
        expect(lastReturnNote(null)).toBeNull();
    });

    it('stepApproverName formats names and candidates correctly', () => {
        expect(stepApproverName({ approver_name: 'Manager SIT' })).toBe('Manager SIT');
        expect(stepApproverName({}, { approver_name: 'Lead Dev' })).toBe('Lead Dev');
        expect(stepApproverName({ candidate_names: ['Raka', 'Hizkia'] })).toBe('Raka / Hizkia');
        expect(stepApproverName({ uid_approver: 'USR-99' })).toBe('USR-99');
        expect(stepApproverName({})).toBe('Pejabat Penyetuju');
    });

    it('isStepApprover checks single approver or candidates list', () => {
        expect(isStepApprover({ uid_approver: 'USR-1' }, 'USR-1')).toBe(true);
        expect(isStepApprover({ uid_candidates: ['USR-1', 'USR-2'] }, 'USR-2')).toBe(true);
        expect(isStepApprover({ uid_candidates: ['USR-1'] }, 'USR-3')).toBe(false);
        expect(isStepApprover(null, 'USR-1')).toBe(false);
    });

    describe('approval flows and permissions', () => {
        const flows = [
            { level: 1, isActive: true, isMandatory: true, assignedUserIds: ['USR-APPR-1'], assignedRole: 'approver' },
            { level: 2, isActive: true, isMandatory: true, assignedUserIds: ['USR-APPR-2'], assignedRole: 'approver_2' }
        ];

        it('getUserApprovalLevel resolves assigned user or role flow', () => {
            expect(getUserApprovalLevel('USR-APPR-1', flows)).toBe(1);
            expect(getUserApprovalLevel('USR-UNKNOWN', flows)).toBeNull();
            const getUserFn = (id) => ({ id, role: 'approver_2' });
            expect(getUserApprovalLevel('USR-OTHER', flows, getUserFn)).toBe(2);
        });

        it('getApprovalFlowsForRequest excludes requester from assigned steps', () => {
            const req = { userId: 'USR-APPR-1' };
            const active = getApprovalFlowsForRequest(req, flows, (id) => ({ id }));
            expect(active).toHaveLength(1);
            expect(active[0].level).toBe(2);
        });

        it('getCurrentApprovalLevel identifies next pending level', () => {
            const req = {
                userId: 'USR-APPLICANT',
                approvalRecords: [
                    { level: 1, action: 'approve' }
                ]
            };
            expect(getCurrentApprovalLevel(req, flows)).toBe(2);
        });

        it('canUserApprove evaluates authorization accurately', () => {
            const user1 = { id: 'USR-APPR-1', role: 'approver' };
            const superUser = { id: 'USR-SUPER', role: 'super_admin' };
            const req = {
                status: 'submitted',
                userId: 'USR-APPLICANT',
                approvalRecords: []
            };

            const options = {
                isSuperAdminFn: (u) => u.role === 'super_admin',
                isApproverFn: (u) => u.role === 'approver'
            };

            expect(canUserApprove(req, user1, flows, options)).toBe(true);

            expect(canUserApprove(req, superUser, flows, options)).toBe(true);

            expect(canUserApprove({ ...req, userId: 'USR-APPR-1' }, user1, flows, options)).toBe(false);

            const user2 = { id: 'USR-APPR-2', role: 'approver_2' };
            expect(canUserApprove(req, user2, flows, options)).toBe(false);
        });
    });
});
