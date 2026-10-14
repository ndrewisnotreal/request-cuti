import { reactive, ref, computed } from 'vue';
import { getEncryptedItem, setEncryptedItem } from '@/utils/encryption';
import api, { clearAuth } from './api.js';
import authService, { userMenus, userAbilities, can } from './authService.js';
import leaveService from './leaveService.js';
import approvalService from './approvalService.js';
import adminService from './adminService.js';

export { userMenus, userAbilities, can };

const AUTH_KEY = 'sicuti_auth';
// Role prototype SiCuti (data.js prototype)
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

export const sicutiState = reactive({
    users: [],
    departments: [],
    leaveTypes: [],
    leavePolicy: {
        annualQuota: 12,
        maxCarryOver: 4,
        carryOverExpiryMonths: 6,
        description: 'Kuota tahunan 12 hari, carry over maks 4 hari'
    },
    holidays: [],
    leaveBalances: [],
    approvalFlows: [],
    leaveRequests: [],
    /** Pengajuan yang menunggu approval user login (badge menu). */
    pendingApprovalCount: 0,
    /** Naik setiap ada notifikasi baru; halaman antrean/riwayat memuat ulang datanya. */
    dataVersion: 0
});

/** Jumlah pengajuan yang menunggu persetujuan user login (badge menu Approval). */
export async function refreshPendingApprovalCount() {
    if (!isApprover()) return;
    try {
        const res = await api.get('/sicuti/leave-request/pending-approval');
        const list = res?.data || res;
        sicutiState.pendingApprovalCount = Array.isArray(list) ? list.length : 0;
    } catch {
        // dicoba lagi pada siklus berikutnya
    }
}

export function getPrimaryRole(userRole) {
    return ADMIN_ROLES.includes(userRole) ? 'admin' : 'user';
}

function loadInitialAuth() {
    const user = getEncryptedItem(AUTH_KEY);
    if (!user || typeof user !== 'object') return { user: null, activeRole: null };
    return {
        user,
        activeRole: getPrimaryRole(user.kd_role || user.role)
    };
}

const initialAuth = loadInitialAuth();
export const currentUser = ref(initialAuth.user);
export const activeRole = ref(initialAuth.activeRole);

function roleOf(user) {
    return user?.kd_role || user?.role || null;
}

export function isAdmin(user = currentUser.value) {
    return ADMIN_ROLES.includes(roleOf(user));
}

export function isSuperAdmin(user = currentUser.value) {
    return roleOf(user) === 'admin_super_app' || Boolean(user?.isSuper);
}

function isSelf(user) {
    return Boolean(user) && (user === currentUser.value || user.id === currentUser.value?.id);
}

/**
 * Approver = punya izin approval dari Manajemen Hak Akses (termasuk role custom).
 * Daftar role bawaan hanya dipakai untuk akun lain yang izinnya tidak dimuat di browser.
 */
export function isApprover(user = currentUser.value) {
    if (!user) return false;
    if (isSelf(user)) return !isAdmin(user) && can('approval.view_requests', 'approval.validate', 'approval.approve_reject');
    return APPROVER_ROLES.includes(roleOf(user));
}

/**
 * Approver selalu mode Approval: approver tidak mengajukan cuti (bukan anggota templat alur approval),
 * jadi tanpa sakelar Pengajuan/Approval dan tanpa riwayat/saldo pengajuan pribadi.
 */
export function isApprovalOnly(user = currentUser.value) {
    return isApprover(user);
}

/** Kuota tahunan dari Kebijakan Cuti aktif (cadangan sebelum data kebijakan termuat). */
export function defaultAnnualQuota() {
    return Number(sicutiState.leavePolicy?.annualQuota) || 12;
}

/** Pemohon (Staff IT/Seksi/Approval atau role custom): punya halaman Pengajuan Cuti & Saldo sendiri. */
export function isApplicant(user = currentUser.value) {
    return Boolean(user) && !isAdmin(user) && !isApprovalOnly(user);
}

/** Pemohon yang boleh membuka form pengajuan cuti. */
export function canSubmitLeave(user = currentUser.value) {
    return isApplicant(user) && can('pengajuan_cuti.submit');
}

/** Pengganti tugas bersifat opsional untuk Staff IT; role pemohon lain wajib mengisinya. */
export function isSubstituteRequired(user = currentUser.value) {
    return roleOf(user) !== 'staff_it';
}

/** Catatan approver terakhir saat pengajuan dikembalikan (data list maupun detail backend). */
export function lastReturnNote(req) {
    const records = req?.approvalRecords || req?.approval_records || [];
    const ret = records
        .filter((r) => r.action === 'return')
        .sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at))[0];
    if (!ret) return null;
    return { approverName: ret.approverName || ret.approver_name || '', notes: (ret.notes || '').trim() };
}

/** Nama di langkah approval: yang bertindak, atau semua calon ("Raka / Hizkia") selama belum ditindak. */
export function stepApproverName(step, record) {
    const candidates = Array.isArray(step?.candidate_names) ? step.candidate_names.filter(Boolean) : [];
    return step?.approver_name || record?.approver_name || (candidates.length ? candidates.join(' / ') : '') || step?.uid_approver || 'Pejabat Penyetuju';
}

/** User termasuk approver langkah ini: yang bertindak atau salah satu calon. */
export function isStepApprover(step, uid) {
    if (!step || !uid) return false;
    if ((step.uid_approver || step.approver_id || step.approverId) === uid) return true;
    return Array.isArray(step.uid_candidates) && step.uid_candidates.includes(uid);
}

/**
 * Mode Pengajuan tetap ada selama pemohon masih boleh mengajukan atau melihat
 * riwayat/saldo sendiri; izin submit yang dicabut hanya menutup form-nya.
 */
function hasApplicantAccess(user = currentUser.value) {
    return isApplicant(user) && can('pengajuan_cuti.submit', 'dokumen_saldo.view_history', 'dokumen_saldo.view_balance');
}

// Staff Approval punya dua mode seperti prototype: Pengajuan & Approval
const MODE_KEY = 'sicuti_mode';
function loadInitialMode() {
    try {
        return localStorage.getItem(MODE_KEY) === 'approval' ? 'approval' : 'user';
    } catch {
        return 'user';
    }
}
const storedMode = ref(loadInitialMode());

/** 'user' (Pengajuan) atau 'approval'. Role approval-only selalu 'approval'. */
export const appMode = computed({
    get() {
        const user = currentUser.value;
        if (isApprovalOnly(user)) return 'approval';
        if (!isApprover(user) || !hasApplicantAccess(user)) return isApprover(user) ? 'approval' : 'user';
        return storedMode.value;
    },
    set(mode) {
        storedMode.value = mode === 'approval' ? 'approval' : 'user';
        try {
            localStorage.setItem(MODE_KEY, storedMode.value);
        } catch {}
    }
});

/** Punya dua mode (Pengajuan & Approval) → tampilkan sakelar mode. */
export function saveToLocalStorage() {
    // Legacy helper preserved for views; state is centrally refreshed from API
}

let isSyncing = false;
export async function syncFromBackend() {
    if (isSyncing || !currentUser.value) return;
    isSyncing = true;
    try {
        const [reqs, balances, holidays, leaveTypes, policy, flows, depts, usersRes, menuRes] = await Promise.allSettled([
            api.get('/sicuti/leave-request', { limit: 1000 }),
            // Admin: saldo semua karyawan (scope divisi); pemohon: saldo sendiri
            can('master_data.view_master_data', 'dashboard_laporan.view_reports')
                ? api.get('/sicuti/leave-balance')
                : api.get('/sicuti/leave-balance/me'),
            api.get('/sicuti/holiday'),
            api.get('/sicuti/leave-type'),
            api.get('/sicuti/policy'),
            can('master_data.view_master_data', 'master_data.manage_approval', 'approval.view_requests')
                ? api.get('/sicuti/approval-flow')
                : Promise.resolve(null),
            api.get('/sicuti/department'),
            can('master_data.view_master_data', 'master_data.manage_employees') ? api.get('/master/user') : Promise.resolve(null),
            authService.getMenu()
        ]);

        void refreshPendingApprovalCount();

        if (reqs.status === 'fulfilled' && reqs.value) {
            const rawReqs = reqs.value.data?.data || reqs.value.data || reqs.value;
            if (Array.isArray(rawReqs)) {
                sicutiState.leaveRequests = rawReqs.map((r) => ({
                    id: r.id_request || r.id,
                    userId: r.uid_user_system || r.userId,
                    userName: r.requester_name || r.userName || r.nama,
                    namecode: r.namecode || r.username,
                    department: r.kd_dept || r.department,
                    departmentName: r.nm_dept || r.departmentName,
                    leaveTypeId: r.kd_leave_type || r.id_leave_type || r.leaveTypeId,
                    leaveTypeName: r.nm_leave_type || r.leaveTypeName,
                    startDate: r.start_date ? String(r.start_date).split('T')[0] : (r.startDate || ''),
                    endDate: r.end_date ? String(r.end_date).split('T')[0] : (r.endDate || ''),
                    totalDays: Number(r.total_days ?? r.totalDays ?? 0),
                    reason: r.reason || '',
                    substituteId: r.substitute_id || r.substituteId || null,
                    status: r.status || 'submitted',
                    createdAt: r.created_at || r.createdAt,
                    updatedAt: r.updated_at || r.updatedAt,
                    approvalRecords: (r.approval_records || r.approvalRecords || []).map((a) => ({
                        approverId: a.approver_id || a.approverId,
                        approverName: a.approver_name || a.approverName,
                        level: Number(a.level || 1),
                        action: a.action,
                        notes: a.notes,
                        signature: a.signature_url || a.signature || a.approver_name,
                        createdAt: a.created_at || a.createdAt
                    })),
                    documents: r.attachment_url ? [{ fileName: r.attachment_url }] : (r.documents || [])
                }));
            }
        }

        if (balances.status === 'fulfilled' && balances.value) {
            const rawBalances = balances.value.data || balances.value;
            if (Array.isArray(rawBalances)) {
                sicutiState.leaveBalances = rawBalances.map((b) => ({
                    id: b.id_balance || b.id,
                    userId: b.uid_user_system || b.userId,
                    userName: b.nama || b.userName,
                    namecode: b.namecode || b.username,
                    department: b.kd_dept || b.department,
                    year: Number(b.year || new Date().getFullYear()),
                    annualQuota: Number(b.annual_quota ?? b.annualQuota ?? defaultAnnualQuota()),
                    usedDays: Number(b.used_days ?? b.usedDays ?? 0),
                    carryOverDays: Number(b.carry_over_days ?? b.carryOverDays ?? 0),
                    carryOverExpiryDate: b.carry_over_expiry_date ? String(b.carry_over_expiry_date).split('T')[0] : null,
                    remaining: Number(b.remaining ?? 0),
                    periodStart: b.period_start || null,
                    periodEnd: b.period_end || null,
                    periodLabel: b.period_label || ''
                }));
            }
        }

        if (holidays.status === 'fulfilled' && holidays.value) {
            const rawHolidays = holidays.value.data || holidays.value;
            if (Array.isArray(rawHolidays)) {
                sicutiState.holidays = rawHolidays.map((h) => ({
                    id: h.id_holiday || h.id,
                    date: h.holiday_date ? String(h.holiday_date).split('T')[0] : (h.date || ''),
                    endDate: h.end_date ? String(h.end_date).split('T')[0] : (h.endDate || null),
                    name: h.nm_holiday || h.name,
                    year: Number(h.year || new Date().getFullYear()),
                    type: h.holiday_type || h.type || 'national'
                }));
            }
        }

        if (leaveTypes.status === 'fulfilled' && leaveTypes.value) {
            const rawTypes = leaveTypes.value.data || leaveTypes.value;
            if (Array.isArray(rawTypes)) {
                sicutiState.leaveTypes = rawTypes.map((t, idx) => ({
                    id: t.kd_leave_type || t.id_leave_type || t.id || `LT${idx + 1}`,
                    code: t.code || t.kd_leave_type || `LT${idx + 1}`,
                    name: t.nm_leave_type || t.name,
                    description: t.description || '',
                    usesQuota: Boolean(t.uses_quota ?? t.is_paid ?? t.usesQuota),
                    requiresDocument: Boolean(t.requires_document ?? t.requires_attachment ?? t.requiresDocument),
                    isActive: Boolean(t.is_active ?? t.isActive ?? true),
                    maxDays: t.max_days ? Number(t.max_days) : null,
                    allowBackdate: Boolean(t.allow_backdate),
                    allowLateDocument: Boolean(t.allow_late_document),
                    lateDocumentDays: Number(t.late_document_days || 3)
                }));
            }
        }

        if (policy.status === 'fulfilled' && policy.value?.data) {
            const p = policy.value.data;
            sicutiState.leavePolicy = {
                annualQuota: Number(p.annual_quota),
                maxCarryOver: Number(p.max_carry_over ?? 0),
                carryOverExpiryMonths: Number(p.carry_over_expiry_months ?? 0),
                description: `Kuota tahunan ${p.annual_quota} hari, carry over maks ${p.max_carry_over ?? 0} hari`
            };
        }

        if (flows.status === 'fulfilled' && flows.value) {
            const rawFlows = flows.value.data || flows.value;
            if (Array.isArray(rawFlows)) {
                sicutiState.approvalFlows = rawFlows.map((f) => ({
                    id: f.id_flow || f.id,
                    level: Number(f.level || 1),
                    name: f.nm_flow || f.name,
                    assignedRole: f.assigned_role || f.assignedRole,
                    isMandatory: Boolean(f.is_mandatory ?? f.isMandatory),
                    isActive: Boolean(f.is_active ?? f.isActive),
                    assignedUserIds: (f.users || [])
                        .map((u) => (typeof u === 'string' ? u : u?.uid_user_system || u?.id))
                        .filter(Boolean)
                }));
            }
        }

        if (depts.status === 'fulfilled' && depts.value) {
            const rawDepts = depts.value.data || depts.value;
            if (Array.isArray(rawDepts)) {
                sicutiState.departments = rawDepts.map((d) => ({
                    id: d.id_dept || d.id,
                    code: d.kd_dept || d.code,
                    name: d.nm_dept || d.name
                }));
            }
        }

        if (usersRes.status === 'fulfilled' && usersRes.value) {
            const rawUsers = usersRes.value.data || usersRes.value;
            if (Array.isArray(rawUsers)) {
                sicutiState.users = rawUsers.map((u) => ({
                    id: u.uid_user_system || u.id,
                    name: u.nama || u.name,
                    username: u.username,
                    namecode: u.username || u.namecode,
                    email: u.email || '',
                    role: u.kd_role || u.role,
                    roleName: u.nm_role || u.roleName,
                    department: u.kd_dept || u.department || 'SIT',
                    departmentName: u.nm_dept || u.departmentName,
                    position: u.position || '',
                    adminDivision: u.admin_division || null,
                    supervisorId: u.supervisor_id || null,
                    joinDate: u.join_date ? String(u.join_date).split('T')[0] : null,
                    isActive: u.status_user === 'A' && !u.is_locked && !u.is_deleted,
                    isLocked: Boolean(u.is_locked),
                    isDeleted: Boolean(u.is_deleted)
                }));
            }
        }
    } catch (e) {
        console.warn('[sicutiService] syncFromBackend error:', e.message);
    } finally {
        isSyncing = false;
    }
}

export async function login(identifier, password) {
    try {
        const data = await authService.login(identifier, password);
        const user = data.user;
        const normalizedUser = {
            id: user.uid_user_system || user.id,
            name: user.nama || user.name,
            username: user.username,
            namecode: user.username,
            email: user.email || '',
            role: user.kd_role || user.role,
            roleName: user.nm_role,
            department: user.kd_dept || user.department || null,
            position: user.position || '',
            adminDivision: user.admin_division || null,
            isSuper: Boolean(user.is_super),
            isActive: true
        };
        currentUser.value = normalizedUser;
        activeRole.value = getPrimaryRole(normalizedUser.role);
        persistCurrentUser();

        // Background sync
        syncFromBackend();

        return { success: true, user: normalizedUser };
    } catch (err) {
        return {
            success: false,
            message: err.data?.error || err.data?.message || err.message || 'Login gagal. Periksa ID dan kata sandi.',
            // PASSWORD_EXPIRED membawa id_user & Token_login_API untuk POST /auth/expired
            code: err.data?.data?.code || null,
            data: err.data?.data || null
        };
    }
}

/** Simpan ulang user login (terenkripsi), mis. setelah profil diubah. */
export function persistCurrentUser() {
    if (currentUser.value) setEncryptedItem(AUTH_KEY, currentUser.value);
}

export function logout() {
    authService.logout();
    currentUser.value = null;
    activeRole.value = null;
    clearAuth();
}

export function switchRole(role) {
    activeRole.value = role;
}

export function getAdminDivision(user = currentUser.value) {
    if (!user) return null;
    const r = user.role || user.kd_role;
    if (r === 'admin_super_app') return null;
    if (user.adminDivision) return user.adminDivision;
    if (r === 'admin_sis') return 'SIS';
    if (r === 'admin_sit') return 'SIT';
    return user.department || null;
}

export function getDivisionUsers(division = getAdminDivision()) {
    return division
        ? sicutiState.users.filter((u) => u.department === division)
        : sicutiState.users;
}

export function getDivisionRequests(division = getAdminDivision()) {
    const userIds = new Set(getDivisionUsers(division).map((u) => u.id));
    return sicutiState.leaveRequests.filter((r) => userIds.has(r.userId));
}

export function getDivisionBalances(division = getAdminDivision()) {
    const users = getDivisionUsers(division).filter((u) => u.isActive !== false);
    const userIds = new Set(users.map((u) => u.id));
    return sicutiState.leaveBalances.filter((b) => userIds.has(b.userId));
}

export function getUserBalance(userId) {
    const balance = sicutiState.leaveBalances.find((b) => b.userId === userId);
    if (balance) {
        const remaining = (balance.annualQuota || 0) + (balance.carryOverDays || 0) - (balance.usedDays || 0);
        return {
            annualQuota: balance.annualQuota,
            usedDays: balance.usedDays,
            carryOverDays: balance.carryOverDays,
            carryOverExpiryDate: balance.carryOverExpiryDate,
            remaining: Math.max(0, remaining)
        };
    }
    return {
        annualQuota: 12,
        usedDays: 0,
        carryOverDays: 0,
        carryOverExpiryDate: null,
        remaining: 12
    };
}

/** Semua tanggal libur (rentang end_date diurai per hari), format YYYY-MM-DD. */
export function holidayDateSet() {
    const dates = new Set();
    for (const h of sicutiState.holidays) {
        if (!h.date) continue;
        const cur = new Date(h.date + "T00:00:00Z");
        const fin = new Date((h.endDate || h.date) + "T00:00:00Z");
        while (cur <= fin) {
            dates.add(cur.toISOString().slice(0, 10));
            cur.setUTCDate(cur.getUTCDate() + 1);
        }
    }
    return dates;
}

export function calculateWorkingDays(startDate, endDate) {
    if (!startDate || !endDate) return 0;
    // Hitung dalam UTC supaya hari tidak bergeser oleh zona waktu browser
    const cur = new Date(String(startDate).slice(0, 10) + "T00:00:00Z");
    const end = new Date(String(endDate).slice(0, 10) + "T00:00:00Z");
    if (Number.isNaN(cur.getTime()) || Number.isNaN(end.getTime()) || end < cur) return 0;

    const holidayDates = holidayDateSet();
    let count = 0;
    while (cur <= end) {
        const day = cur.getUTCDay();
        if (day !== 0 && day !== 6 && !holidayDates.has(cur.toISOString().slice(0, 10))) count++;
        cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return count;
}

export async function createLeaveRequest(payload) {
    const res = await leaveService.createLeave(payload);
    await syncFromBackend();
    return res;
}

export async function updateLeaveRequest(id, payload) {
    // If updating or resubmitting
    if (payload.status === 'submitted') {
        const res = await leaveService.createLeave(payload);
        await syncFromBackend();
        return res;
    }
    return null;
}

export async function deleteLeaveRequest(id) {
    const res = await leaveService.cancelLeave(id);
    await syncFromBackend();
    return res;
}

export function getUserApprovalLevel(userId) {
    if (!userId) return null;
    const flow = sicutiState.approvalFlows.find(
        (f) => f.isActive && Array.isArray(f.assignedUserIds) && f.assignedUserIds.includes(userId)
    );
    if (flow) return flow.level;

    const user = getUser(userId);
    const roleFlow = sicutiState.approvalFlows.find(
        (f) => f.isActive && f.assignedRole === user?.role
    );
    return roleFlow ? roleFlow.level : null;
}

export function getApprovalFlowsForRequest(leaveRequest) {
    const applicant = leaveRequest?.userId ? getUser(leaveRequest.userId) : null;
    return sicutiState.approvalFlows
        .filter((f) => f.isActive && f.isMandatory)
        .filter((f) => {
            if (!applicant) return true;
            if (!Array.isArray(f.assignedUserIds)) return true;
            return !f.assignedUserIds.includes(applicant.id);
        })
        .sort((a, b) => a.level - b.level);
}

export function getCurrentApprovalLevel(req) {
    if (!req) return null;
    const activeFlows = getApprovalFlowsForRequest(req);

    for (const flow of activeFlows) {
        const isLevelApproved = req.approvalRecords?.some(
            (a) => a.level === flow.level && a.action === 'approve'
        );
        if (!isLevelApproved) {
            return flow.level;
        }
    }
    return null;
}

export function canUserApprove(req, user) {
    if (!req || !user) return false;
    if (!['submitted', 'pending_validation'].includes(req.status)) return false;
    if (req.userId === user.id) return false;

    // Super Admin can inspect/approve
    if (isSuperAdmin(user)) return true;

    const flows = getApprovalFlowsForRequest(req);
    const userLevel = getUserApprovalLevel(user.id);
    if (!userLevel) return isApprover(user);

    const currentLevel = getCurrentApprovalLevel(req);
    if (currentLevel === null || currentLevel !== userLevel) return false;

    const alreadyApproved = req.approvalRecords?.some(
        (a) => a.approverId === user.id && a.level === userLevel && a.action === 'approve'
    );
    if (alreadyApproved) return false;

    const flow = flows.find((f) => f.level === userLevel);
    if (!flow) return false;
    if (Array.isArray(flow.assignedUserIds) && flow.assignedUserIds.length > 0) {
        return flow.assignedUserIds.includes(user.id);
    }
    return flow.assignedRole === user.role;
}

export async function approveLeaveRequest(id, notes, signature) {
    const res = await approvalService.processApproval({
        idRequest: id,
        action: 'approve',
        notes,
        signature
    });
    await syncFromBackend();
    return res;
}

export async function rejectLeaveRequest(id, notes) {
    const res = await approvalService.processApproval({
        idRequest: id,
        action: 'reject',
        notes
    });
    await syncFromBackend();
    return res;
}

export async function returnLeaveRequest(id, notes) {
    const res = await approvalService.processApproval({
        idRequest: id,
        action: 'return',
        notes
    });
    await syncFromBackend();
    return res;
}

export function getUser(id) {
    return sicutiState.users.find((u) => u.id === id || u.username === id);
}

export function getLeaveType(id) {
    return sicutiState.leaveTypes.find((t) => t.id === id || t.code === id);
}

export function getStatusSeverity(status) {
    switch (status?.toLowerCase()) {
        case 'approved':
        case 'completed':
            return 'success';
        case 'submitted':
        case 'pending_validation':
            return 'warn';
        case 'processing':
            return 'info';
        case 'rejected':
            return 'danger';
        case 'returned':
            return 'warn';
        case 'draft':
        case 'cancelled':
        default:
            return 'secondary';
    }
}

/**
 * Lampiran pengajuan. Berkasnya tidak publik: diambil lewat GET /sicuti/leave-request/attachment
 * (cek hak akses) dengan fetchAttachmentUrl / openAttachment.
 * Hasil: { name, isImage, hasFile, idRequest }; null bila tidak ada lampiran.
 */
export function attachmentInfo(req) {
    const url = req?.attachment_url || '';
    const doc = req?.documents?.[0];
    const name = req?.attachment_name || (url ? url.split('/').pop() : doc?.file_name || doc?.fileName || '');
    if (!name) return null;
    // Hanya berkas hasil unggahan aplikasi; URL luar tidak pernah dijadikan tautan
    const hasFile = /^\/uploads\/documents\/[A-Za-z0-9._-]+$/.test(url);
    return { name, hasFile, isImage: hasFile && /\.(png|jpe?g)$/i.test(url), idRequest: req?.id_request || req?.id };
}

/** URL blob lampiran untuk pratinjau gambar (bebaskan dengan URL.revokeObjectURL). */
export async function fetchAttachmentUrl(idRequest) {
    const { blob } = await api.blob('/sicuti/leave-request/attachment', { id_request: idRequest });
    return URL.createObjectURL(blob);
}

/** Buka lampiran di tab baru. */
export async function openAttachment(idRequest) {
    const win = window.open('', '_blank');
    try {
        const url = await fetchAttachmentUrl(idRequest);
        if (win) win.location.href = url;
        else window.location.href = url;
    } catch (err) {
        win?.close();
        throw err;
    }
}

/** Dokumen pendukung masih menyusul (wajib, belum diunggah). */
export function documentPending(req) {
    return Boolean(req?.document_due_date) && !req?.attachment_url && !(req?.documents || []).length;
}

export const CURRENT_YEAR = new Date().getFullYear();

/** Pilihan tahun untuk filter: tahun berjalan dan tahun sebelumnya. */
export const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1].map((y) => ({ label: `Tahun ${y}`, value: y }));

const STATUS_LABELS = {
    draft: 'Draf',
    submitted: 'Diajukan',
    pending_validation: 'Menunggu Validasi',
    approved: 'Disetujui',
    rejected: 'Ditolak',
    returned: 'Dikembalikan',
    processing: 'Diproses',
    completed: 'Selesai',
    cancelled: 'Dibatalkan'
};

export function getStatusLabel(status) {
    return STATUS_LABELS[status] || status;
}

/** Pilihan filter status, label sama dengan badge di tabel. */
export const STATUS_OPTIONS = [
    { label: 'Semua Status', value: null },
    ...['submitted', 'pending_validation', 'approved', 'returned', 'rejected', 'cancelled', 'draft'].map((value) => ({
        label: STATUS_LABELS[value],
        value
    }))
];

export function formatDate(dateStr) {
    if (!dateStr) return '-';
    let clean = String(dateStr).split('T')[0];
    // Timestamp (mis. created_at) dikirim dalam UTC → pakai tanggal lokal (WIB)
    if (String(dateStr).includes('T')) {
        const d = new Date(dateStr);
        if (!Number.isNaN(d.getTime())) {
            clean = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
    }
    const parts = clean.split('-');
    if (parts.length === 3) {
        const months = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];
        const d = parseInt(parts[2], 10);
        const m = parseInt(parts[1], 10) - 1;
        const y = parts[0];
        if (months[m]) {
            return `${d} ${months[m]} ${y}`;
        }
    }
    return clean;
}

export function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export function formatTimeAgo(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) return 'Baru saja';
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'Baru saja';
    if (diffMin < 60) return `${diffMin} mnt lalu`;
    if (diffHour < 24) return `${diffHour} jam lalu`;
    if (diffDays === 1) return 'Kemarin';
    if (diffDays < 7) return `${diffDays} hr lalu`;
    return formatDate(dateStr);
}

export async function updateUserAccount(userId, payload) {
    const res = await adminService.updateUser({
        uid_user_system: userId,
        nama: payload.name,
        email: payload.email,
        password: payload.password,
        status_user: payload.isActive ? 'A' : 'N'
    });
    await syncFromBackend();
    return res;
}

export async function toggleUserStatus(userId) {
    const user = getUser(userId);
    if (!user) return null;
    const res = await adminService.updateUser({
        uid_user_system: userId,
        status_user: user.isActive ? 'N' : 'A'
    });
    await syncFromBackend();
    return res;
}

// Auto sync on client load if token present
if (typeof window !== 'undefined') {
    setTimeout(() => {
        syncFromBackend();
    }, 100);
}
