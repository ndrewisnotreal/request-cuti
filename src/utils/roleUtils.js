import { can } from '@/service/authService.js';

export const BUILT_IN_ROLES = [
    'staff_it', 'staff_seksi', 'staff_approval', 'kepala_it', 'kepala_dept',
    'admin_sit', 'admin_sis', 'admin_super_app'
];
export const ADMIN_ROLES = ['admin_super_app', 'admin_sit', 'admin_sis'];
export const APPROVER_ROLES = ['staff_approval', 'kepala_it', 'kepala_dept'];

export const ROLE_LABELS = {
    staff_it: 'Staff IT',
    staff_seksi: 'Staff Seksi',
    staff_approval: 'Staff Approval',
    kepala_it: 'Kepala Seksi',
    kepala_dept: 'Kepala Departemen',
    admin_sit: 'Admin Seksi',
    admin_sis: 'Admin Seksi',
    admin_super_app: 'Admin Super App'
};

let _getCurrentUser = () => null;

export function registerCurrentUserGetter(fn) {
    _getCurrentUser = fn;
}

export function roleOf(user) {
    return user?.kd_role || user?.role || null;
}

export function getPrimaryRole(userRole) {
    return ADMIN_ROLES.includes(userRole) ? 'admin' : 'user';
}

export function isAdmin(user = _getCurrentUser()) {
    return ADMIN_ROLES.includes(roleOf(user));
}

export function isSuperAdmin(user = _getCurrentUser()) {
    return roleOf(user) === 'admin_super_app' || Boolean(user?.isSuper);
}

function isSelf(user) {
    const cur = _getCurrentUser();
    return Boolean(user) && (user === cur || user.id === cur?.id);
}

export function isApprover(user = _getCurrentUser()) {
    if (!user) return false;
    if (isSelf(user)) return !isAdmin(user) && can('approval.view_requests', 'approval.validate', 'approval.approve_reject');
    return APPROVER_ROLES.includes(roleOf(user));
}

export function isApprovalOnly(user = _getCurrentUser()) {
    return isApprover(user);
}

export function isApplicant(user = _getCurrentUser()) {
    return Boolean(user) && !isAdmin(user) && !isApprovalOnly(user);
}

export function canSubmitLeave(user = _getCurrentUser()) {
    return isApplicant(user) && can('pengajuan_cuti.submit');
}

export function isSubstituteRequired(user = _getCurrentUser()) {
    return roleOf(user) !== 'staff_it';
}

export function getAdminDivision(user = _getCurrentUser()) {
    if (!user) return null;
    const r = user.role || user.kd_role;
    if (r === 'admin_super_app') return null;
    if (user.adminDivision) return user.adminDivision;
    if (r === 'admin_sis') return 'SIS';
    if (r === 'admin_sit') return 'SIT';
    return user.department || null;
}
