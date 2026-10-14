<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import api from '@/service/api';
import { adminService } from '@/service/adminService';
import { getAdminDivision, currentUser, isSuperAdmin, getStatusSeverity, getStatusLabel, formatDate, STATUS_OPTIONS, YEAR_OPTIONS } from '@/service/sicutiService';
import { useToast } from 'primevue/usetoast';
import { downloadReportCsv, printReportPdf } from './reportExport';
import { FileSpreadsheet, FileText, Calendar, Search, RefreshCw, BarChart3, Wallet, PieChart } from 'lucide-vue-next';

const toast = useToast();
const loading = ref(false);
const exporting = ref(false);
const adminDivision = computed(() => getAdminDivision(currentUser.value));
const isSuper = computed(() => isSuperAdmin(currentUser.value));

// 0: Riwayat Cuti, 1: Saldo Cuti, 2: Rekap per Jenis Cuti (backlog E37)
const activeTab = ref(0);

const leaveReports = ref([]);
const balanceReports = ref([]);
const typeSummary = ref([]);
const leaveTypes = ref([]);
const departments = ref([]);

const selectedYear = ref(new Date().getFullYear());
const yearOptions = YEAR_OPTIONS;
const departmentFilter = ref(null);
const leaveTypeFilter = ref(null);
const statusFilter = ref(null);
const searchQuery = ref('');
// Rentang tanggal cuti (backlog E38): pengajuan yang periodenya bersinggungan dengan rentang
const dateRange = ref(null);
const statusOptions = STATUS_OPTIONS;

function iso(d) {
    if (!d) return undefined;
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
const rangeStart = computed(() => iso(dateRange.value?.[0]));
const rangeEnd = computed(() => iso(dateRange.value?.[1] || dateRange.value?.[0]));
const targetDept = computed(() => adminDivision.value || departmentFilter.value || null);

/** Filter yang sama dikirim ke ekspor backend, agar isi berkas = isi tabel. */
const exportParams = computed(() => ({
    year: selectedYear.value,
    kd_dept: targetDept.value || undefined,
    kd_leave_type: leaveTypeFilter.value || undefined,
    status: statusFilter.value || undefined,
    start_date: rangeStart.value,
    end_date: rangeEnd.value,
    search: searchQuery.value.trim() || undefined
}));

async function loadSummary() {
    try {
        const res = await api.get('/sicuti/report/leave-type-summary', {
            year: selectedYear.value,
            kd_dept: targetDept.value || undefined,
            start_date: rangeStart.value,
            end_date: rangeEnd.value
        });
        typeSummary.value = Array.isArray(res?.data) ? res.data : [];
    } catch {
        typeSummary.value = [];
    }
}

async function loadData() {
    loading.value = true;
    try {
        const [repData, balData, typesData, deptsData] = await Promise.all([
            adminService.getReports({ year: selectedYear.value }),
            adminService.getBalances(selectedYear.value).catch(() => []),
            adminService.getLeaveTypes().catch(() => []),
            adminService.getDepartments().catch(() => [])
        ]);
        leaveReports.value = Array.isArray(repData) ? repData : [];
        balanceReports.value = Array.isArray(balData) ? balData : [];
        leaveTypes.value = Array.isArray(typesData) ? typesData : [];
        departments.value = Array.isArray(deptsData) ? deptsData : [];
        await loadSummary();
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Gagal Memuat Laporan', detail: err.message || 'Gagal mengambil data laporan cuti', life: 3000 });
    } finally {
        loading.value = false;
    }
}

watch(selectedYear, loadData);
watch([departmentFilter, dateRange], loadSummary);

const leaveTypeOptions = computed(() => [
    { label: 'Semua Jenis Cuti', value: null },
    ...leaveTypes.value.map((t) => ({ label: t.nm_leave_type || t.name, value: t.kd_leave_type || t.id }))
]);

const filteredLeaveReports = computed(() =>
    leaveReports.value.filter((r) => {
        if (targetDept.value && r.kd_dept !== targetDept.value) return false;
        if (leaveTypeFilter.value && r.kd_leave_type !== leaveTypeFilter.value) return false;
        if (statusFilter.value && r.status !== statusFilter.value) return false;
        const s = String(r.start_date || '').slice(0, 10);
        const e = String(r.end_date || r.start_date || '').slice(0, 10);
        if (rangeStart.value && e < rangeStart.value) return false;
        if (rangeEnd.value && s > rangeEnd.value) return false;
        if (searchQuery.value) {
            const q = searchQuery.value.toLowerCase();
            const hay = `${r.requester_name || ''} ${r.namecode || ''} ${r.id_request || ''}`.toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    })
);

const filteredBalanceReports = computed(() =>
    balanceReports.value.filter((b) => {
        if (targetDept.value && b.kd_dept !== targetDept.value) return false;
        if (searchQuery.value) {
            const q = searchQuery.value.toLowerCase();
            if (!`${b.nama || ''} ${b.namecode || ''}`.toLowerCase().includes(q)) return false;
        }
        return true;
    })
);

const summaryTotals = computed(() =>
    typeSummary.value.reduce(
        (acc, r) => ({ total: acc.total + Number(r.total), approved: acc.approved + Number(r.approved), days: acc.days + Number(r.approved_days) }),
        { total: 0, approved: 0, days: 0 }
    )
);
const maxSummary = computed(() => Math.max(1, ...typeSummary.value.map((r) => Number(r.total))));

const remaining = (b) => (b.remaining !== undefined ? b.remaining : Number(b.annual_quota || 0) + Number(b.carry_over_days || 0) - Number(b.used_days || 0));
const scopeLabel = computed(() => {
    const parts = [targetDept.value ? `Divisi ${targetDept.value}` : 'Semua divisi', `Tahun ${selectedYear.value}`];
    if (rangeStart.value) parts.push(`${formatDate(rangeStart.value)} – ${formatDate(rangeEnd.value)}`);
    return parts.join(' · ');
});

const EXPORT_TYPE = ['leave-request', 'leave-balance', 'leave-type-summary'];

async function exportCsv() {
    exporting.value = true;
    try {
        await downloadReportCsv({ ...exportParams.value, type: EXPORT_TYPE[activeTab.value] });
        toast.add({ severity: 'success', summary: 'Ekspor Berhasil', detail: 'Berkas CSV laporan sudah diunduh.', life: 3000 });
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Ekspor Gagal', detail: err.message || 'Coba lagi beberapa saat.', life: 4000 });
    } finally {
        exporting.value = false;
    }
}

function exportPdf() {
    const configs = [
        {
            title: 'Laporan Riwayat Cuti',
            rows: filteredLeaveReports.value,
            columns: [
                { header: 'No. Pengajuan', value: (r) => r.id_request },
                { header: 'NIK', value: (r) => r.namecode || '-' },
                { header: 'Nama Karyawan', value: (r) => r.requester_name },
                { header: 'Divisi', value: (r) => r.kd_dept || '-' },
                { header: 'Jenis Cuti', value: (r) => r.nm_leave_type },
                { header: 'Periode', value: (r) => `${formatDate(r.start_date)} – ${formatDate(r.end_date)}` },
                { header: 'Hari Kerja', value: (r) => r.total_days },
                { header: 'Status', value: (r) => getStatusLabel(r.status) },
                { header: 'Alasan', value: (r) => r.reason || '-' }
            ]
        },
        {
            title: 'Laporan Saldo Cuti',
            rows: filteredBalanceReports.value,
            columns: [
                { header: 'NIK', value: (b) => b.namecode || '-' },
                { header: 'Nama Karyawan', value: (b) => b.nama },
                { header: 'Divisi', value: (b) => b.kd_dept || '-' },
                { header: 'Periode', value: (b) => (b.period_start ? `${formatDate(b.period_start)} – ${formatDate(b.period_end)}` : '-') },
                { header: 'Kuota', value: (b) => b.annual_quota },
                { header: 'Carry Over', value: (b) => b.carry_over_days || 0 },
                { header: 'Terpakai', value: (b) => b.used_days || 0 },
                { header: 'Sisa', value: remaining }
            ]
        },
        {
            title: 'Rekap Penggunaan per Jenis Cuti',
            rows: typeSummary.value,
            columns: [
                { header: 'Jenis Cuti', value: (r) => r.nm_leave_type },
                { header: 'Jumlah Pengajuan', value: (r) => r.total },
                { header: 'Disetujui', value: (r) => r.approved },
                { header: 'Ditolak', value: (r) => r.rejected },
                { header: 'Dibatalkan', value: (r) => r.cancelled },
                { header: 'Dalam Proses', value: (r) => r.pending },
                { header: 'Total Hari Disetujui', value: (r) => r.approved_days }
            ]
        }
    ];
    const cfg = configs[activeTab.value];
    if (!printReportPdf({ ...cfg, subtitle: scopeLabel.value })) {
        toast.add({ severity: 'warn', summary: 'Jendela Diblokir', detail: 'Izinkan pop-up untuk mencetak laporan PDF.', life: 4000 });
    }
}

onMounted(loadData);
</script>

<template>
    <div class="space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h2 class="text-xl font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                    <BarChart3 class="text-primary w-5 h-5" />
                    <span>Laporan & Ekspor Data Cuti</span>
                </h2>
                <p class="text-xs text-muted-color">
                    Rekapitulasi riwayat pengajuan, saldo, dan penggunaan per jenis cuti
                    <span v-if="adminDivision" class="font-bold text-primary">Divisi {{ adminDivision }}</span>
                </p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
                <Button severity="secondary" outlined size="small" class="text-xs font-semibold flex items-center gap-1.5" :loading="loading" @click="loadData">
                    <RefreshCw :size="14" :stroke-width="1.75" />
                    <span>Segarkan</span>
                </Button>
                <Button severity="secondary" outlined size="small" class="text-xs font-semibold flex items-center gap-1.5" @click="exportPdf">
                    <FileText :size="14" :stroke-width="1.75" />
                    <span>Ekspor PDF</span>
                </Button>
                <Button severity="success" size="small" class="text-xs font-bold flex items-center gap-1.5" :loading="exporting" @click="exportCsv">
                    <FileSpreadsheet :size="14" :stroke-width="2" />
                    <span>Ekspor CSV</span>
                </Button>
            </div>
        </div>

        <div class="flex flex-wrap items-center gap-2 border-b border-surface-200 dark:border-surface-700 pb-2" role="tablist" aria-label="Jenis laporan">
            <button
                v-for="(t, i) in [
                    { label: 'Rekapitulasi Riwayat Cuti', icon: Calendar, count: filteredLeaveReports.length },
                    { label: 'Rekapitulasi Saldo Karyawan', icon: Wallet, count: filteredBalanceReports.length },
                    { label: 'Rekap per Jenis Cuti', icon: PieChart, count: typeSummary.length }
                ]"
                :key="t.label"
                type="button"
                role="tab"
                :aria-selected="activeTab === i"
                :class="[
                    'px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2',
                    activeTab === i ? 'bg-primary text-white shadow-sm' : 'text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800'
                ]"
                @click="activeTab = i"
            >
                <component :is="t.icon" :size="14" />
                <span>{{ t.label }}</span>
                <span class="ml-1 px-1.5 rounded-full text-[11px]" :class="activeTab === i ? 'bg-white/20 text-white' : 'bg-surface-200 dark:bg-surface-700 text-surface-700 dark:text-surface-300'">
                    {{ t.count }}
                </span>
            </button>
        </div>

        <div class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 shadow-sm">
            <div class="flex flex-wrap items-center gap-3">
                <IconField v-if="activeTab !== 2" iconPosition="left" class="w-full sm:w-60">
                    <InputIcon class="!flex items-center justify-center">
                        <Search :size="14" :stroke-width="1.75" class="text-muted-color" />
                    </InputIcon>
                    <InputText v-model="searchQuery" placeholder="Cari Karyawan / NIK..." class="w-full text-xs" size="small" />
                </IconField>
                <Select v-model="selectedYear" :options="yearOptions" optionLabel="label" optionValue="value" placeholder="Pilih Tahun" class="w-full sm:w-36 text-xs" size="small" />
                <div
                    v-if="adminDivision"
                    class="text-xs font-semibold px-3 py-1.5 rounded-lg bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 border border-surface-200 dark:border-surface-700"
                >
                    <span class="text-muted-color">Divisi:</span> <span class="text-primary font-bold">{{ adminDivision }}</span>
                </div>
                <Select
                    v-else-if="isSuper"
                    v-model="departmentFilter"
                    :options="[{ label: 'Semua Divisi', value: null }, ...departments.map((d) => ({ label: `${d.nm_dept} (${d.kd_dept})`, value: d.kd_dept }))]"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Pilih Divisi"
                    class="w-full sm:w-44 text-xs"
                    size="small"
                />
                <DatePicker
                    v-if="activeTab !== 1"
                    v-model="dateRange"
                    selectionMode="range"
                    :manualInput="false"
                    dateFormat="dd M yy"
                    placeholder="Rentang tanggal cuti"
                    showIcon
                    showButtonBar
                    class="w-full sm:w-64 text-xs"
                    inputClass="text-xs"
                    aria-label="Rentang tanggal cuti"
                />
                <template v-if="activeTab === 0">
                    <Select v-model="leaveTypeFilter" :options="leaveTypeOptions" optionLabel="label" optionValue="value" placeholder="Jenis Cuti" class="w-full sm:w-44 text-xs" size="small" />
                    <Select v-model="statusFilter" :options="statusOptions" optionLabel="label" optionValue="value" placeholder="Pilih Status" class="w-full sm:w-44 text-xs" size="small" />
                </template>
            </div>
        </div>

        <!-- Riwayat Cuti -->
        <div v-if="activeTab === 0" class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 shadow-sm">
            <DataTable :value="filteredLeaveReports" :loading="loading" paginator :rows="10" class="p-datatable-sm text-xs" responsiveLayout="scroll">
                <template #empty><div class="text-center py-8 text-muted-color">Tidak ada data riwayat cuti untuk filter ini.</div></template>
                <Column header="No. Pengajuan" style="width: 14%">
                    <template #body="{ data }"><span class="font-mono font-bold text-surface-900 dark:text-surface-100">{{ data.id_request }}</span></template>
                </Column>
                <Column header="Karyawan" style="width: 22%">
                    <template #body="{ data }">
                        <div class="font-bold text-surface-900 dark:text-surface-100">{{ data.requester_name }}</div>
                        <div class="text-[11px] text-muted-color">NIK: {{ data.namecode || '-' }} · {{ data.kd_dept || '-' }}</div>
                    </template>
                </Column>
                <Column header="Jenis Cuti" style="width: 16%">
                    <template #body="{ data }"><span class="font-medium">{{ data.nm_leave_type }}</span></template>
                </Column>
                <Column header="Periode Cuti" style="width: 20%">
                    <template #body="{ data }">
                        <div>{{ formatDate(data.start_date) }} s/d {{ formatDate(data.end_date) }}</div>
                        <div class="text-[11px] text-primary font-bold">{{ data.total_days }} Hari Kerja</div>
                    </template>
                </Column>
                <Column header="Status" style="width: 14%">
                    <template #body="{ data }"><Tag :value="getStatusLabel(data.status)" :severity="getStatusSeverity(data.status)" class="text-[11px]" /></template>
                </Column>
                <Column header="Alasan" style="width: 14%">
                    <template #body="{ data }"><span class="text-surface-600 dark:text-surface-400 truncate max-w-xs block" :title="data.reason">{{ data.reason || '-' }}</span></template>
                </Column>
            </DataTable>
        </div>

        <!-- Saldo Cuti -->
        <div v-else-if="activeTab === 1" class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 shadow-sm">
            <DataTable :value="filteredBalanceReports" :loading="loading" paginator :rows="10" class="p-datatable-sm text-xs" responsiveLayout="scroll">
                <template #empty><div class="text-center py-8 text-muted-color">Tidak ada data saldo cuti pada periode ini.</div></template>
                <Column header="NIK / ID" style="width: 15%">
                    <template #body="{ data }"><span class="font-mono font-bold">{{ data.namecode || '-' }}</span></template>
                </Column>
                <Column header="Nama Karyawan" style="width: 27%">
                    <template #body="{ data }">
                        <div class="font-bold text-surface-900 dark:text-surface-100">{{ data.nama }}</div>
                        <div class="text-[11px] text-muted-color">Divisi: {{ data.kd_dept || '-' }}</div>
                    </template>
                </Column>
                <Column header="Kuota Tahunan" style="width: 14%">
                    <template #body="{ data }"><span class="font-bold">{{ data.annual_quota }}</span> Hari</template>
                </Column>
                <Column header="Carry Over" style="width: 14%">
                    <template #body="{ data }"><span class="font-bold text-indigo-600 dark:text-indigo-400">{{ data.carry_over_days || 0 }}</span> Hari</template>
                </Column>
                <Column header="Digunakan" style="width: 14%">
                    <template #body="{ data }"><span class="font-bold text-rose-600 dark:text-rose-400">{{ data.used_days || 0 }}</span> Hari</template>
                </Column>
                <Column header="Sisa Saldo" style="width: 16%">
                    <template #body="{ data }">
                        <span class="px-2.5 py-1 rounded-full font-black text-xs bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">{{ remaining(data) }} Hari</span>
                    </template>
                </Column>
            </DataTable>
        </div>

        <!-- Rekap per Jenis Cuti -->
        <div v-else class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 shadow-sm space-y-4">
            <dl class="grid grid-cols-3 gap-3 text-center text-xs">
                <div class="rounded-lg bg-surface-50 dark:bg-surface-800 p-3"><dt class="text-muted-color">Total pengajuan</dt><dd class="text-xl font-bold tabular-nums">{{ summaryTotals.total }}</dd></div>
                <div class="rounded-lg bg-surface-50 dark:bg-surface-800 p-3"><dt class="text-muted-color">Disetujui</dt><dd class="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{{ summaryTotals.approved }}</dd></div>
                <div class="rounded-lg bg-surface-50 dark:bg-surface-800 p-3"><dt class="text-muted-color">Hari cuti disetujui</dt><dd class="text-xl font-bold tabular-nums">{{ summaryTotals.days }}</dd></div>
            </dl>
            <DataTable :value="typeSummary" :loading="loading" class="p-datatable-sm text-xs" responsiveLayout="scroll">
                <template #empty><div class="text-center py-8 text-muted-color">Belum ada jenis cuti.</div></template>
                <Column header="Jenis Cuti" style="width: 26%">
                    <template #body="{ data }">
                        <div class="font-semibold text-surface-900 dark:text-surface-100">{{ data.nm_leave_type }}</div>
                        <div class="h-1.5 mt-1 rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden" aria-hidden="true">
                            <div class="h-full bg-primary rounded-full" :style="{ width: `${(Number(data.total) / maxSummary) * 100}%` }" />
                        </div>
                    </template>
                </Column>
                <Column header="Pengajuan" style="width: 12%"><template #body="{ data }"><span class="tabular-nums font-bold">{{ data.total }}</span></template></Column>
                <Column header="Disetujui" style="width: 12%"><template #body="{ data }"><span class="tabular-nums text-emerald-600 dark:text-emerald-400">{{ data.approved }}</span></template></Column>
                <Column header="Ditolak" style="width: 12%"><template #body="{ data }"><span class="tabular-nums text-rose-600 dark:text-rose-400">{{ data.rejected }}</span></template></Column>
                <Column header="Dibatalkan" style="width: 12%"><template #body="{ data }"><span class="tabular-nums">{{ data.cancelled }}</span></template></Column>
                <Column header="Dalam Proses" style="width: 12%"><template #body="{ data }"><span class="tabular-nums text-amber-700 dark:text-amber-300">{{ data.pending }}</span></template></Column>
                <Column header="Hari Disetujui" style="width: 14%"><template #body="{ data }"><span class="tabular-nums font-bold">{{ data.approved_days }}</span></template></Column>
            </DataTable>
        </div>
    </div>
</template>
