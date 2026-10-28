import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';

const toastAdd = vi.fn();
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: toastAdd }) }));
vi.mock('@/service/leaveService', () => ({ leaveService: { completeDocument: vi.fn().mockResolvedValue({ success: true }) } }));
vi.mock('@/service/rbacService', () => ({ rbacService: { createRole: vi.fn().mockResolvedValue({ kd_role: 'hrd_staff', nm_role: 'Staff HRD', level: 90 }) } }));

import LeaveApprovalTimeline from '@/components/leave/LeaveApprovalTimeline.vue';
import LeaveCompleteDocumentDialog from '@/components/leave/LeaveCompleteDocumentDialog.vue';
import ProfileAvatarSection from '@/components/user/ProfileAvatarSection.vue';
import ProfilePasswordSection from '@/components/user/ProfilePasswordSection.vue';
import RoleFormDialog from '@/components/admin/RoleFormDialog.vue';
import { leaveService } from '@/service/leaveService';
import { rbacService } from '@/service/rbacService';

const DialogStub = defineComponent({
    name: 'Dialog',
    props: ['visible', 'header'],
    emits: ['update:visible'],
    setup: (p, { slots }) => () => (p.visible ? h('div', { class: 'dialog', 'data-header': p.header }, [slots.default?.(), slots.footer?.()]) : null)
});

const ButtonStub = defineComponent({
    name: 'Button',
    props: ['label', 'disabled', 'loading'],
    emits: ['click'],
    setup: (p, { slots, emit }) => () => h('button', { disabled: p.disabled || undefined, onClick: () => emit('click') }, [p.label, slots.default?.()])
});

const TagStub = defineComponent({
    name: 'Tag',
    props: ['value', 'severity'],
    setup: (p) => () => h('span', { class: `tag tag-${p.severity}` }, p.value)
});

const InputTextStub = defineComponent({
    name: 'InputText',
    props: ['modelValue', 'id'],
    emits: ['update:modelValue'],
    setup: (p, { emit }) => () => h('input', { id: p.id, value: p.modelValue, onInput: (e) => emit('update:modelValue', e.target.value) })
});

const SelectStub = defineComponent({
    name: 'Select',
    props: ['modelValue', 'options'],
    emits: ['update:modelValue'],
    setup: (p, { emit }) => () => h('select', { value: p.modelValue, onChange: (e) => emit('update:modelValue', e.target.value) })
});

const PasswordStub = defineComponent({
    name: 'Password',
    props: ['modelValue', 'inputId'],
    emits: ['update:modelValue'],
    setup: (p, { emit }) => () => h('input', { type: 'password', id: p.inputId, value: p.modelValue, onInput: (e) => emit('update:modelValue', e.target.value) })
});

describe('LeaveApprovalTimeline', () => {
    it('shows empty message when steps are empty', () => {
        const w = mount(LeaveApprovalTimeline, { props: { steps: [] } });
        expect(w.text()).toContain('Belum ada data tahapan approval');
    });

    it('renders step details, badges, notes and timestamps', () => {
        const steps = [
            {
                id: 'step-1',
                level: 1,
                approverName: 'Hizkia R',
                status: 'approved',
                isCurrent: false,
                actedAt: '2026-10-01T08:00:00Z',
                notes: 'Disetujui tanpa kendala'
            },
            {
                id: 'step-2',
                level: 2,
                approverName: 'Kepala Seksi',
                status: 'pending',
                isCurrent: true,
                actedAt: null,
                notes: null
            }
        ];
        const w = mount(LeaveApprovalTimeline, {
            props: { steps },
            global: { stubs: { Tag: TagStub } }
        });

        expect(w.text()).toContain('Tingkat 1: Hizkia R');
        expect(w.text()).toContain('Tingkat 2: Kepala Seksi');
        expect(w.text()).toContain('Disetujui tanpa kendala');
        expect(w.text()).toContain('Disetujui');
        expect(w.text()).toContain('Sedang Ditinjau');
    });
});

describe('LeaveCompleteDocumentDialog', () => {
    beforeEach(() => {
        toastAdd.mockClear();
        leaveService.completeDocument.mockClear();
    });

    it('renders document due date and request details', () => {
        const req = {
            id_request: 'REQ-001',
            nm_leave_type: 'Cuti Sakit',
            document_due_date: '2026-10-20'
        };
        const w = mount(LeaveCompleteDocumentDialog, {
            props: { visible: true, request: req },
            global: { stubs: { Dialog: DialogStub, Button: ButtonStub } }
        });

        expect(w.text()).toContain('REQ-001');
        expect(w.text()).toContain('Cuti Sakit');
        expect(w.text()).toContain('20 Oktober 2026');
    });

    it('validates file extension and size', async () => {
        const w = mount(LeaveCompleteDocumentDialog, {
            props: { visible: true, request: { id_request: 'REQ-001' } },
            global: { stubs: { Dialog: DialogStub, Button: ButtonStub } }
        });

        const fileInput = w.find('input[type="file"]');
        const badFile = new File(['hello'], 'doc.txt', { type: 'text/plain' });
        Object.defineProperty(fileInput.element, 'files', { value: [badFile], configurable: true, writable: true });
        await fileInput.trigger('change');

        expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ summary: 'Format Tidak Didukung' }));

        const bigFile = new File([new ArrayBuffer(3 * 1024 * 1024)], 'doc.pdf', { type: 'application/pdf' });
        Object.defineProperty(fileInput.element, 'files', { value: [bigFile], configurable: true, writable: true });
        await fileInput.trigger('change');

        expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ summary: 'Ukuran Terlalu Besar' }));
    });
});

describe('ProfileAvatarSection', () => {
    beforeEach(() => {
        toastAdd.mockClear();
    });

    it('displays initials when no photo is provided', () => {
        const w = mount(ProfileAvatarSection, {
            props: {
                name: 'Budi Santoso',
                roleName: 'Staff IT',
                deptName: 'Information Technology',
                deptCode: 'SIT',
                nip: '12345678',
                photoUrl: '',
                userInitials: 'BS'
            }
        });

        expect(w.text()).toContain('BS');
        expect(w.text()).toContain('Budi Santoso');
        expect(w.text()).toContain('Staff IT');
        expect(w.text()).toContain('12345678');
        expect(w.find('img').exists()).toBe(false);
    });

    it('displays image when photoUrl is present and emits correct removal event', async () => {
        const w = mount(ProfileAvatarSection, {
            props: {
                name: 'Budi Santoso',
                photoUrl: '/uploads/avatar.jpg',
                isPendingPhoto: false
            }
        });

        expect(w.find('img').exists()).toBe(true);
        const btn = w.find('button[type="button"].text-rose-600');
        expect(btn.text()).toContain('Hapus foto profil');
        await btn.trigger('click');
        expect(w.emitted('remove-photo')).toBeTruthy();

        await w.setProps({ isPendingPhoto: true });
        expect(w.find('button[type="button"].text-rose-600').text()).toContain('Batalkan foto baru');
        await w.find('button[type="button"].text-rose-600').trigger('click');
        expect(w.emitted('cancel-photo')).toBeTruthy();
    });
});

describe('ProfilePasswordSection', () => {
    it('shows password checklist when new password is entered', async () => {
        const form = {
            newPassword: '',
            confirmPassword: '',
            currentPassword: ''
        };
        const w = mount(ProfilePasswordSection, {
            props: { modelValue: form },
            global: { stubs: { Password: PasswordStub } }
        });

        expect(w.text()).toContain('Minimal 8 karakter');

        await w.setProps({
            modelValue: {
                newPassword: 'Secret',
                confirmPassword: 'Different',
                currentPassword: ''
            }
        });

        expect(w.text()).toContain('Belum sama dengan kata sandi baru');
        expect(w.text()).toContain('Minimal 8 karakter');
    });
});

describe('RoleFormDialog', () => {
    beforeEach(() => {
        toastAdd.mockClear();
        rbacService.createRole.mockClear();
    });

    it('filters out is_super from copy options', () => {
        const roles = [
            { kd_role: 'admin_super_app', nm_role: 'Super Admin', is_super: true, level: 0 },
            { kd_role: 'staff_it', nm_role: 'Staff IT', is_super: false, level: 90 }
        ];
        const w = mount(RoleFormDialog, {
            props: { visible: true, roles },
            global: { stubs: { Dialog: DialogStub, Button: ButtonStub, InputText: InputTextStub, Select: SelectStub } }
        });

        expect(w.findComponent(SelectStub).props('options')).toEqual([
            { label: 'Staff IT', value: 'staff_it' }
        ]);
    });

    it('validates empty name and calls rbacService on submit', async () => {
        const w = mount(RoleFormDialog, {
            props: { visible: true, roles: [] },
            global: { stubs: { Dialog: DialogStub, Button: ButtonStub, InputText: InputTextStub, Select: SelectStub } }
        });

        await w.find('form').trigger('submit');
        expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ summary: 'Nama peran wajib diisi' }));

        await w.find('#role-name').setValue('Staff HRD');
        await w.find('form').trigger('submit');
        await flushPromises();

        expect(rbacService.createRole).toHaveBeenCalledWith(expect.objectContaining({ nm_role: 'Staff HRD' }));
        expect(w.emitted('created')).toBeTruthy();
    });
});
