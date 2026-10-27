import { describe, expect, it, vi } from 'vitest';
import { h } from 'vue';
import { mount } from '@vue/test-utils';

vi.mock('vue-router', () => ({ useRoute: () => ({ query: {} }) }));
vi.mock('@/components/dashboard/UserDashboard.vue', () => ({ default: { name: 'UserDashboard', render: () => h('div', { class: 'stub-user' }) } }));
vi.mock('@/components/dashboard/AdminDashboard.vue', () => ({ default: { name: 'AdminDashboard', render: () => h('div', { class: 'stub-admin' }) } }));
vi.mock('@/components/dashboard/ApprovalDashboard.vue', () => ({ default: { name: 'ApprovalDashboard', render: () => h('div', { class: 'stub-approval' }) } }));

import Dashboard from '@/views/Dashboard.vue';
import { currentUser } from '@/service/sicutiService';

describe('Dashboard sesudah logout', () => {
    it('tanpa user login tidak merender dashboard apa pun (tidak ada pemanggilan API tanpa sesi)', () => {
        currentUser.value = null;
        const w = mount(Dashboard);
        expect(w.find('.stub-user').exists()).toBe(false);
        expect(w.find('.stub-admin').exists()).toBe(false);
        expect(w.find('.stub-approval').exists()).toBe(false);
    });

    it('dengan user login tetap merender dashboard sesuai peran', () => {
        currentUser.value = { id: 'USR101', role: 'staff_it' };
        const w = mount(Dashboard);
        expect(w.find('.stub-user').exists()).toBe(true);
        currentUser.value = null;
    });
});
