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

function gated(item, allowed) {
    return allowed ? item : { ...item, disabled: true, badge: null };
}

export const sidebarModel = computed(() => {
    const user = currentUser.value;
    if (!user) return [];

    const sections = [];
    const admin = isAdmin(user);
    const superAdmin = isSuperAdmin(user);

    const mainItems = [{ label: 'Dashboard', icon: LayoutDashboard, to: '/' }];
    if (can('dashboard_laporan.view_calendar')) mainItems.push({ label: 'Kalender Cuti', icon: CalendarDays, to: '/calendar' });
    sections.push({ label: 'Menu Utama', items: mainItems });

    if (isApprover(user)) {
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

    if (!admin && !isApprovalOnly(user)) {
        sections.push({
            label: 'Pengajuan',
            items: [
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

    return sections;
});

export function hasOpenableMenu(sections) {
    return sections.some((g) => g.items.some((i) => i.to !== '/' && !i.disabled));
}

export const showSidebar = computed(() => hasOpenableMenu(sidebarModel.value));
