<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { adminService, AUDIT_ACTION_LABEL, AUDIT_ENTITY_LABEL } from '@/service/adminService';
import { formatDate } from '@/service/sicutiService';
import { useToast } from 'primevue/usetoast';
import { downloadExcel } from '@/utils/reportExport';
import AuditDetailDialog from '@/components/admin/AuditDetailDialog.vue';
import {
    ShieldCheck,
    Search,
    RefreshCw,
    FileSpreadsheet,
    Filter,
    User,
    Activity,
    Database,
    Globe,
    FileText,
    Eye
} from 'lucide-vue-next';

const toast = useToast();
const loading = ref(false);
const exporting = ref(false);
const logs = ref([]);
const searchQuery = ref('');
const actionFilter = ref(null);
const entityFilter = ref(null);

const detailDialogVisible = ref(false);
const selectedLog = ref(null);

const actionOptions = [{ label: 'Semua Aksi', value: null }, ...Object.entries(AUDIT_ACTION_LABEL).map(([value, label]) => ({ label, value }))];
const entityOptions = [{ label: 'Semua Entitas', value: null }, ...Object.entries(AUDIT_ENTITY_LABEL).map(([value, label]) => ({ label, value }))];
const actionLabel = (code) => AUDIT_ACTION_LABEL[code] || code;
const entityLabel = (code) => AUDIT_ENTITY_LABEL[code] || (code && code !== 'SYSTEM' ? code : 'Sistem');

const dateRange = ref(null);
function iso(d) {
    if (!d) return undefined;
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

const filterParams = computed(() => ({
    action: actionFilter.value || undefined,
    entity: entityFilter.value || undefined,
    search: searchQuery.value.trim() || undefined,
    start_date: iso(dateRange.value?.[0]),
    end_date: iso(dateRange.value?.[1] || dateRange.value?.[0])
}));

async function loadAuditLogs() {
    loading.value = true;
    try {
        const data = await adminService.getAuditLogs(filterParams.value);
        logs.value = Array.isArray(data) ? data : [];
    } catch (err) {
        toast.add({
            severity: 'error',
            summary: 'Gagal Memuat Log',
            detail: err.message || 'Gagal memuat data riwayat audit',
            life: 3000
        });
    } finally {
        loading.value = false;
    }
}

const filteredLogs = computed(() => logs.value);

let searchTimer = null;
watch([actionFilter, entityFilter, dateRange], loadAuditLogs);
watch(searchQuery, () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadAuditLogs, 400);
});

function getActionSeverity(action) {
    if (!action) return 'secondary';
    const a = action.toUpperCase();
    if (a.includes('APPROVE') || a === 'LOGIN') return 'success';
    if (a.includes('REJECT') || a.includes('DELETE') || a.includes('FAIL') || a.includes('DENIED')) return 'danger';
    if (a.includes('UPDATE') || a.includes('CHANGE')) return 'warn';
    if (a.includes('SUBMIT') || a.includes('CREATE')) return 'info';
    return 'secondary';
}

function viewDetail(item) {
    selectedLog.value = item;
    detailDialogVisible.value = true;
}

async function exportExcel() {
    if (!filteredLogs.value.length) {
        toast.add({ severity: 'warn', summary: 'Ekspor', detail: 'Tidak ada data log untuk diekspor', life: 3000 });
        return;
    }
    exporting.value = true;
    try {
        // Diambil ulang dari server sesuai filter: tidak terbatas 500 baris yang tampil di tabel
        await downloadExcel('/sicuti/audit-trail/export', filterParams.value, 'audit_trail.xlsx');
        toast.add({ severity: 'success', summary: 'Ekspor Berhasil', detail: 'File Excel audit log telah diunduh', life: 3000 });
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Gagal Ekspor', detail: err.message || 'Coba lagi beberapa saat.', life: 4000 });
    } finally {
        exporting.value = false;
    }
}

onMounted(() => {
    loadAuditLogs();
});
</script>

<template>
    <div class="space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                    <ShieldCheck class="text-primary w-5 h-5" />
                    <span>Audit Trail & Log Aktivitas</span>
                </h1>
                <p class="text-xs text-muted-color">
                    Catatan rekaman jejak audit sistem: login, pengajuan cuti, keputusan persetujuan, dan perubahan master data
                </p>
            </div>
            <div class="flex items-center gap-2">
                <Button
                    severity="secondary"
                    outlined
                    size="small"
                    class="text-xs font-semibold flex items-center gap-1.5"
                    :loading="loading"
                    @click="loadAuditLogs"
                >
                    <RefreshCw :size="14" :stroke-width="1.75" />
                    <span>Segarkan</span>
                </Button>
                <Button data-tour="export-excel"
                    severity="success"
                    size="small"
                    class="text-xs font-bold flex items-center gap-1.5"
                    :loading="exporting"
                    @click="exportExcel"
                >
                    <FileSpreadsheet :size="14" :stroke-width="2" />
                    <span>Ekspor Excel</span>
                </Button>
            </div>
        </div>

        <div data-tour="audit-filters" class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 flex flex-col md:flex-row gap-3 items-center justify-between">
            <div class="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <IconField iconPosition="left" class="w-full sm:w-64">
                    <InputIcon class="!flex items-center justify-center">
                        <Search :size="14" :stroke-width="1.75" class="text-muted-color" />
                    </InputIcon>
                    <InputText
                        id="cari-audit"
                        name="cari-audit"
                        aria-label="Cari audit trail berdasarkan user, aksi, IP, atau detail"
                        v-model="searchQuery"
                        placeholder="Cari user / aksi / IP / detail..."
                        class="w-full text-xs"
                        size="small"
                    />
                </IconField>

                <Select
                    v-model="actionFilter"
                    :options="actionOptions"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Pilih Aksi"
                    class="w-full sm:w-44 text-xs"
                    size="small"
                />

                <Select
                    v-model="entityFilter"
                    :options="entityOptions"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Pilih Entitas"
                    class="w-full sm:w-44 text-xs"
                    size="small"
                />

                <DatePicker
                    v-model="dateRange"
                    selectionMode="range"
                    :manualInput="false"
                    dateFormat="dd M yy"
                    placeholder="Rentang tanggal"
                    showIcon
                    showButtonBar
                    class="w-full sm:w-60 text-xs"
                    inputClass="text-xs"
                    aria-label="Rentang tanggal log"
                />
            </div>

            <div class="text-xs text-muted-color w-full md:w-auto text-right whitespace-nowrap shrink-0">
                Total: <span class="font-bold text-surface-900 dark:text-surface-100">{{ filteredLogs.length }}</span> entri log
            </div>
        </div>

        <div data-tour="audit-table" class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 shadow-sm">
            <DataTable
                :value="filteredLogs"
                paginator
                :rows="10"
                :rowsPerPageOptions="[10, 25, 50]"
                class="p-datatable-sm text-xs"
                tableStyle="min-width: 56rem"
                responsiveLayout="scroll"
                :loading="loading"
            >
                <template #empty>
                    <div class="text-center py-8 text-muted-color text-xs">
                        Tidak ada catatan log audit yang sesuai dengan filter.
                    </div>
                </template>

                <Column field="timestamp" header="Waktu (WIB)" sortable style="width: 12%">
                    <template #body="{ data }">
                        <div class="flex flex-col whitespace-nowrap tabular-nums">
                            <span class="font-semibold text-surface-900 dark:text-surface-100">
                                {{ formatDate(String(data.timestamp || data.created_at || '').split(/[ T]/)[0]) }}
                            </span>
                            <span class="text-muted-color">
                                {{ String(data.timestamp || data.created_at || '').split(/[ T]/)[1]?.slice(0, 8) }}
                            </span>
                        </div>
                    </template>
                </Column>

                <Column field="username" header="Pengguna" sortable style="width: 15%">
                    <template #body="{ data }">
                        <div class="flex items-center gap-2">
                            <div class="w-6 h-6 rounded-full bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 font-bold text-[11px] flex items-center justify-center shrink-0">
                                {{ (data.username || data.user || 'U').charAt(0).toUpperCase() }}
                            </div>
                            <div class="flex flex-col min-w-0">
                                <span class="font-semibold text-surface-900 dark:text-surface-100 truncate">
                                    {{ data.username || data.user || '-' }}
                                </span>
                                <span v-if="data.user_role" class="text-[11px] text-muted-color">
                                    {{ data.user_role }}
                                </span>
                            </div>
                        </div>
                    </template>
                </Column>

                <Column field="action" header="Aksi" sortable style="width: 13%">
                    <template #body="{ data }">
                        <Tag
                            :value="actionLabel(data.action)"
                            :severity="getActionSeverity(data.action)"
                            :title="data.action"
                            class="text-[11px]"
                        />
                    </template>
                </Column>

                <Column field="entity" header="Entitas" sortable style="width: 11%">
                    <template #body="{ data }">
                        <span class="inline-block whitespace-nowrap px-2 py-0.5 rounded text-[11px] font-mono bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 border border-surface-200 dark:border-surface-700">
                            {{ entityLabel(data.entity) }}
                        </span>
                    </template>
                </Column>

                <Column field="ip_address" header="IP Address" style="width: 11%" bodyClass="max-w-0">
                    <template #body="{ data }">
                        <span class="font-mono text-muted-color text-[11px] flex items-center gap-1" :title="data.ip_address">
                            <Globe :size="11" class="text-surface-400 shrink-0" />
                            <span class="truncate">{{ data.ip_address || '-' }}</span>
                        </span>
                    </template>
                </Column>

                <Column field="details" header="Detail Perubahan" style="width: 38%" bodyClass="max-w-0" :pt="{ headerCell: { 'data-tour': 'audit-col-detail' } }">
                    <template #body="{ data }">
                        <div class="flex items-center justify-between gap-2">
                            <span class="text-surface-700 dark:text-surface-300 truncate text-[11px]" :title="data.details || data.description">
                                {{ data.details || data.description || '-' }}
                            </span>
                            <button
                                type="button"
                                class="p-1 hover:bg-surface-100 dark:hover:bg-surface-800 rounded text-muted-color hover:text-primary transition-colors cursor-pointer shrink-0"
                                title="Lihat Detail Lengkap"
                                @click="viewDetail(data)"
                            >
                                <Eye :size="13" />
                            </button>
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>

        <AuditDetailDialog
            v-model:visible="detailDialogVisible"
            :log="selectedLog"
        />
    </div>
</template>
