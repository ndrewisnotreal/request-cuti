import { computed } from 'vue';
import {
    currentUser,
    sicutiState,
    isAdmin,
    isSuperAdmin,
    isApprover,
    isApprovalOnly,
    can
} from '@/service/sicutiService';
import {
    LayoutDashboard,
    FileText,
    Wallet,
    Activity,
    Users,
    User,
    Tag,
    Calendar,
    GitFork,
    ShieldCheck,
    FileSpreadsheet,
    ClipboardCheck,
    FileCheck,
    FileClock,
    Settings2,
    FilePlus2,
    CalendarDays
} from 'lucide-vue-next';

const pendingRequestsCount = computed(() => {
    if (!currentUser.value) return 0;
    return sicutiState.leaveRequests.filter(
        (r) => r.userId === currentUser.value.id && (r.status === 'submitted' || r.status === 'pending_validation')
    ).length;
});

// Menu yang izinnya dinonaktifkan di Manajemen Hak Akses tetap tampil, tetapi tidak bisa dibuka
function gated(item, allowed) {
    return allowed ? item : { ...item, disabled: true, badge: null };
}

// Susunan menu mengikuti prototype (renderSidebarMenu di app.js prototype)
/** Menu sidebar sesuai peran & izin (dipakai AppMenu dan AppLayout). */
export const sidebarModel = computed(() => {
    const user = currentUser.value;
    if (!user) return [];

    const sections = [];
    const admin = isAdmin(user);
    const superAdmin = isSuperAdmin(user);

    // Dashboard selalu bisa dibuka semua akun. Kalender Cuti (backlog E35) diatur di Manajemen
    // Hak Akses dan disembunyikan, bukan diredupkan, bila perannya belum diberi izin.
    const mainItems = [{ label: 'Dashboard', icon: LayoutDashboard, to: '/' }];
    if (can('dashboard_laporan.view_calendar')) mainItems.push({ label: 'Kalender Cuti', icon: CalendarDays, to: '/calendar' });
    sections.push({ label: 'Menu Utama', items: mainItems });

    // Approval: Staff Approval, Kepala Seksi, Kepala Departemen
    if (isApprover(user)) {
        // Nomor level alur bisa berubah saat admin menyisipkan tingkat; cukup nama bagian
        sections.push({
            label: 'Approval',
            items: [
                gated(
                    {
                        label: 'Validasi Pengajuan',
                        icon: ClipboardCheck,
                        to: '/approval/pending',
                        badge: sicutiState.pendingApprovalCount > 0 ? sicutiState.pendingApprovalCount : null
                    },
                    can('approval.view_requests', 'approval.validate')
                ),
                gated({ label: 'Riwayat Approval', icon: FileCheck, to: '/approval/history' }, can('approval.view_requests'))
            ]
        });
    }

    // Pengajuan: pemohon (Staff IT, Staff Seksi, role custom); approver tidak mengajukan cuti
    if (!admin && !isApprovalOnly(user)) {
        sections.push({
            label: 'Pengajuan',
            items: [
                // Prototype: daftar & tambah pengajuan jadi satu halaman "Pengajuan Cuti"
                gated(
                    {
                        label: 'Pengajuan Cuti',
                        icon: FileText,
                        to: '/leave/history',
                        badge: pendingRequestsCount.value > 0 ? pendingRequestsCount.value : null
                    },
                    can('dokumen_saldo.view_history')
                ),
                gated({ label: 'Saldo Cuti', icon: Wallet, to: '/leave/balance' }, can('dokumen_saldo.view_balance'))
            ]
        });
    }

    if (admin) {
        // Master data: Admin Seksi hanya melihat, kecuali diberi izin kelola
        const canMaster = superAdmin || can('master_data.view_master_data');
        sections.push({
            label: 'Master Data',
            items: [
                gated({ label: 'Karyawan', icon: Users, to: '/admin/employees' }, canMaster),
                gated({ label: 'Jenis Cuti', icon: Tag, to: '/admin/leave-types' }, canMaster),
                gated({ label: 'Kebijakan Cuti', icon: Settings2, to: '/admin/policy' }, canMaster),
                gated({ label: 'Hari Libur', icon: Calendar, to: '/admin/holidays' }, canMaster),
                gated({ label: 'Alur Approval', icon: GitFork, to: '/admin/approval-flow' }, canMaster)
            ]
        });

        sections.push({
            label: 'Transaksi',
            items: [
                { label: 'Pengajuan Karyawan', icon: FilePlus2, to: '/admin/create-leave' },
                gated({ label: 'Pemantauan Pengajuan', icon: Activity, to: '/admin/monitoring' }, superAdmin || can('master_data.view_processed')),
                gated({ label: 'Saldo Cuti', icon: Wallet, to: '/admin/balances' }, canMaster)
            ]
        });

        sections.push({
            label: 'Laporan',
            items: [
                gated({ label: 'Laporan', icon: FileSpreadsheet, to: '/admin/reports' }, superAdmin || can('dashboard_laporan.view_reports')),
                gated({ label: 'Audit Trail', icon: FileClock, to: '/admin/audit-trail' }, superAdmin || can('dashboard_laporan.view_audit'))
            ]
        });

        if (superAdmin) {
            sections.push({
                label: 'Keamanan',
                items: [
                    { label: 'Manajemen Akun', icon: User, to: '/admin/accounts' },
                    { label: 'Manajemen Hak Akses', icon: ShieldCheck, to: '/admin/permissions' }
                ]
            });
        }
    }

    // Profil Saya cukup diakses dari dropdown profil di topbar
    return sections;
});

/**
 * Ada menu selain Dashboard yang bisa dibuka? Bila seluruh otorisasi dihilangkan (QA #2),
 * cukup tampilkan Dashboard tanpa sidebar.
 */
export function hasOpenableMenu(sections) {
    return sections.some((g) => g.items.some((i) => i.to !== '/' && !i.disabled));
}

export const showSidebar = computed(() => hasOpenableMenu(sidebarModel.value));
