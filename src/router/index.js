import AppLayout from '@/layout/AppLayout.vue';
import { createRouter, createWebHistory } from 'vue-router';
import { currentUser, isAdmin, isSuperAdmin, isApprover, isApplicant, can } from '@/service/sicutiService';

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/',
            component: AppLayout,
            children: [
                {
                    path: '/',
                    alias: '/dashboard',
                    name: 'dashboard',
                    component: () => import('@/views/Dashboard.vue'),
                    meta: { requiresAuth: true }
                },
                {
                    // Prototype startNewLeave: pindah ke Pengajuan Cuti lalu buka form di atasnya
                    path: '/leave/new',
                    name: 'leave-new',
                    redirect: { path: '/leave/history', query: { action: 'new_leave' } }
                },
                {
                    path: '/leave/edit/:id',
                    name: 'leave-edit',
                    redirect: (to) => ({ path: '/leave/history', query: { editId: to.params.id } })
                },
                {
                    path: '/calendar',
                    name: 'leave-calendar',
                    component: () => import('@/views/sicuti/leave/LeaveCalendar.vue'),
                    meta: { requiresAuth: true, ability: 'dashboard_laporan.view_calendar' }
                },
                {
                    path: '/leave/history',
                    name: 'leave-history',
                    component: () => import('@/views/sicuti/leave/LeaveHistory.vue'),
                    meta: { requiresAuth: true, requiresApplicant: true, ability: 'dokumen_saldo.view_history' }
                },
                {
                    path: '/leave/balance',
                    name: 'leave-balance',
                    component: () => import('@/views/sicuti/leave/LeaveBalance.vue'),
                    meta: { requiresAuth: true, requiresApplicant: true, ability: 'dokumen_saldo.view_balance' }
                },
                // Approval
                {
                    path: '/approval/pending',
                    name: 'approval-pending',
                    component: () => import('@/views/sicuti/approval/PendingApproval.vue'),
                    meta: { requiresAuth: true, requiresApprover: true, ability: ['approval.view_requests', 'approval.validate'] }
                },
                {
                    path: '/approval/history',
                    name: 'approval-history',
                    component: () => import('@/views/sicuti/approval/ApprovalHistory.vue'),
                    meta: { requiresAuth: true, requiresApprover: true, ability: 'approval.view_requests' }
                },
                // Admin
                {
                    path: '/admin/monitoring',
                    name: 'admin-monitoring',
                    component: () => import('@/views/sicuti/admin/AdminMonitoring.vue'),
                    meta: { requiresAuth: true, requiresAdmin: true, ability: 'master_data.view_processed' }
                },
                {
                    path: '/admin/balances',
                    name: 'admin-balances',
                    component: () => import('@/views/sicuti/admin/AdminBalances.vue'),
                    meta: { requiresAuth: true, requiresAdmin: true, requiresMasterView: true }
                },
                {
                    path: '/admin/employees',
                    name: 'admin-employees',
                    component: () => import('@/views/sicuti/admin/AdminEmployees.vue'),
                    meta: { requiresAuth: true, requiresAdmin: true, requiresMasterView: true }
                },
                {
                    path: '/admin/accounts',
                    name: 'admin-accounts',
                    component: () => import('@/views/sicuti/admin/AdminAccounts.vue'),
                    meta: { requiresAuth: true, requiresSuperAdmin: true }
                },
                {
                    // Kelola role ada di halaman Hak Akses (prototype Permission Management)
                    path: '/admin/roles',
                    redirect: '/admin/permissions'
                },
                {
                    path: '/admin/policy',
                    name: 'admin-policy',
                    component: () => import('@/views/sicuti/admin/AdminPolicy.vue'),
                    meta: { requiresAuth: true, requiresAdmin: true, requiresMasterView: true }
                },
                {
                    path: '/admin/create-leave',
                    name: 'admin-create-leave',
                    component: () => import('@/views/sicuti/admin/AdminCreateLeave.vue'),
                    meta: { requiresAuth: true, requiresAdmin: true }
                },
                {
                    path: '/admin/leave-types',
                    name: 'admin-leave-types',
                    component: () => import('@/views/sicuti/admin/AdminLeaveTypes.vue'),
                    meta: { requiresAuth: true, requiresAdmin: true, requiresMasterView: true }
                },
                {
                    path: '/admin/holidays',
                    name: 'admin-holidays',
                    component: () => import('@/views/sicuti/admin/AdminHolidays.vue'),
                    meta: { requiresAuth: true, requiresAdmin: true, requiresMasterView: true }
                },
                {
                    path: '/admin/approval-flow',
                    name: 'admin-approval-flow',
                    component: () => import('@/views/sicuti/admin/AdminApprovalFlow.vue'),
                    meta: { requiresAuth: true, requiresAdmin: true, requiresMasterView: true }
                },
                {
                    path: '/admin/permissions',
                    name: 'admin-permissions',
                    component: () => import('@/views/sicuti/admin/AdminPermissions.vue'),
                    meta: { requiresAuth: true, requiresSuperAdmin: true }
                },
                {
                    path: '/admin/reports',
                    name: 'admin-reports',
                    component: () => import('@/views/sicuti/admin/AdminReports.vue'),
                    meta: { requiresAuth: true, requiresAdmin: true, ability: 'dashboard_laporan.view_reports' }
                },
                {
                    path: '/admin/audit-trail',
                    name: 'admin-audit-trail',
                    component: () => import('@/views/sicuti/admin/AdminAuditTrail.vue'),
                    meta: { requiresAuth: true, requiresAdmin: true, ability: 'dashboard_laporan.view_audit' }
                },
                {
                    path: '/profile',
                    name: 'profile',
                    component: () => import('@/views/sicuti/user/Profile.vue'),
                    meta: { requiresAuth: true, ability: 'login_user.view_profile' }
                }
            ]
        },
        {
            path: '/validasi/:secret(.*)',
            alias: '/validasi/:secret',
            name: 'document-validation',
            component: () => import('@/views/sicuti/approval/DocumentValidation.vue'),
            meta: { public: true }
        },
        {
            path: '/auth/forgot-password',
            name: 'forgot-password',
            component: () => import('@/views/pages/auth/ForgotPassword.vue'),
            meta: { public: true }
        },
        {
            path: '/auth/login',
            name: 'login',
            component: () => import('@/views/pages/auth/Login.vue')
        },
        {
            path: '/:pathMatch(.*)*',
            name: 'notfound',
            component: () => import('@/views/pages/NotFound.vue')
        }
    ]
});

router.beforeEach((to, from, next) => {
    if (to.meta.public || to.name === 'document-validation') {
        return next();
    }

    // Token ada di cookie httpOnly (tidak terbaca JS); sesi lokal jadi penanda login
    const isAuth = Boolean(currentUser.value);

    if (to.name !== 'login' && !isAuth) {
        return next({ name: 'login' });
    }

    if (to.name === 'login' && isAuth) {
        return next({ name: 'dashboard' });
    }

    // Role authorization guards
    if (to.meta.requiresSuperAdmin && !isSuperAdmin()) {
        return next({ name: 'dashboard' });
    }

    if (to.meta.requiresAdmin && !isAdmin()) {
        return next({ name: 'dashboard' });
    }

    if (to.meta.requiresApprover && !isApprover()) {
        return next({ name: 'dashboard' });
    }

    // Admin Seksi melihat master data hanya jika punya izin view_master_data
    if (to.meta.requiresMasterView && !isSuperAdmin() && !can('master_data.view_master_data')) {
        return next({ name: 'dashboard' });
    }

    // Izin melihat halaman dicek lewat meta.ability (satu izin atau daftar, cukup salah satu); izin submit hanya untuk form
    if (to.meta.requiresApplicant && !isApplicant()) {
        return next({ name: 'dashboard' });
    }

    if (to.meta.ability && !isSuperAdmin() && !can(to.meta.ability)) {
        return next({ name: 'dashboard' });
    }

    next();
});

export default router;
