const CONTENT = {
    karyawan: () => import('./karyawan.js'),
    approval: () => import('./approval.js'),
    admin: () => import('./admin.js'),
    superadmin: () => import('./superadmin.js')
};

const KARYAWAN = ['karyawan'];
const APPROVER = ['approval', 'kepala'];
const ADMIN = ['admin'];
const ADMIN_PAGES = ['admin', 'superadmin'];
const SUPER = ['superadmin'];
const EVERYONE = ['karyawan', 'approval', 'kepala', 'admin', 'superadmin'];

const adminPage = (id, route, title) => ({ id: `admin.${id}`, version: 1, kind: 'page', route, personas: ADMIN_PAGES, title, content: 'admin' });

export const ALL_TOURS = [
    { id: 'karyawan.pengenalan', version: 1, kind: 'welcome', route: '/', readyAnchor: 'dash-riwayat', personas: KARYAWAN, title: 'Tur pengenalan', content: 'karyawan' },
    { id: 'karyawan.pengajuan', version: 1, kind: 'page', route: '/leave/history', personas: KARYAWAN, title: 'Pengajuan Cuti', content: 'karyawan' },
    { id: 'karyawan.saldo', version: 1, kind: 'page', route: '/leave/balance', personas: KARYAWAN, title: 'Saldo Cuti', content: 'karyawan' },
    { id: 'karyawan.formulir', version: 1, kind: 'dialog', personas: KARYAWAN, title: 'Panduan formulir pengajuan', content: 'karyawan' },
    { id: 'karyawan.detail', version: 1, kind: 'dialog', personas: KARYAWAN, title: 'Panduan detail pengajuan', content: 'karyawan' },
    { id: 'approval.pengenalan', version: 1, kind: 'welcome', route: '/', readyAnchor: 'appr-queue', personas: APPROVER, title: 'Tur pengenalan', content: 'approval' },
    { id: 'approval.validasi', version: 1, kind: 'page', route: '/approval/pending', personas: APPROVER, title: 'Validasi Pengajuan', content: 'approval' },
    { id: 'approval.riwayat', version: 1, kind: 'page', route: '/approval/history', personas: APPROVER, title: 'Riwayat Approval', content: 'approval' },
    { id: 'approval.proses', version: 1, kind: 'dialog', personas: APPROVER, title: 'Panduan proses persetujuan', content: 'approval' },
    { id: 'approval.detail', version: 1, kind: 'dialog', personas: APPROVER, title: 'Panduan detail pengajuan', content: 'approval' },
    { id: 'admin.pengenalan', version: 1, kind: 'welcome', route: '/', readyAnchor: 'admin-stats', personas: ADMIN, title: 'Tur pengenalan', content: 'admin' },
    adminPage('pemantauan', '/admin/monitoring', 'Pemantauan Pengajuan'),
    adminPage('pengajuan-karyawan', '/admin/create-leave', 'Pengajuan Karyawan'),
    adminPage('saldo', '/admin/balances', 'Saldo Cuti'),
    adminPage('karyawan', '/admin/employees', 'Data Karyawan'),
    adminPage('jenis-cuti', '/admin/leave-types', 'Jenis Cuti'),
    adminPage('kebijakan', '/admin/policy', 'Kebijakan Cuti'),
    adminPage('hari-libur', '/admin/holidays', 'Hari Libur'),
    adminPage('alur-approval', '/admin/approval-flow', 'Alur Approval'),
    adminPage('laporan', '/admin/reports', 'Laporan'),
    adminPage('audit', '/admin/audit-trail', 'Audit Trail'),
    { id: 'super.pengenalan', version: 1, kind: 'welcome', route: '/', readyAnchor: 'admin-stats', personas: SUPER, title: 'Tur pengenalan', content: 'superadmin' },
    { id: 'super.akun', version: 1, kind: 'page', route: '/admin/accounts', personas: SUPER, title: 'Manajemen Akun', content: 'superadmin' },
    { id: 'super.hak-akses', version: 1, kind: 'page', route: '/admin/permissions', personas: SUPER, title: 'Manajemen Hak Akses', content: 'superadmin' },
    { id: 'kalender', version: 1, kind: 'page', route: '/calendar', personas: EVERYONE, title: 'Kalender Cuti', content: 'superadmin' }
];

const forPersona = (tour, persona) => Boolean(persona) && tour.personas.includes(persona);

export function welcomeTour(persona, tours = ALL_TOURS) {
    return tours.find((t) => t.kind === 'welcome' && forPersona(t, persona)) || null;
}

export function tourForRoute(path, persona, tours = ALL_TOURS) {
    return tours.find((t) => t.kind === 'page' && t.route === path && forPersona(t, persona)) || null;
}

export function tourById(id, persona, tours = ALL_TOURS) {
    return tours.find((t) => t.id === id && forPersona(t, persona)) || null;
}

export async function loadTourSteps(tour) {
    const mod = await CONTENT[tour.content]();
    return mod.TOUR_STEPS[tour.id] || [];
}
