<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { adminService, AUDIT_ACTION_LABEL, AUDIT_ENTITY_LABEL } from '@/service/adminService';
import { formatDate } from '@/service/sicutiService';
import { useToast } from 'primevue/usetoast';
import {
    ShieldCheck,
    Search,
    RefreshCw,
    Download,
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
const logs = ref([]);
const searchQuery = ref('');
const actionFilter = ref(null);
const entityFilter = ref(null);

const detailDialogVisible = ref(false);
const selectedLog = ref(null);

const actionOptions = [{ label: 'Semua Aksi', value: null }, ...Object.entries(AUDIT_ACTION_LABEL).map(([value, label]) => ({ label, value }))];
const entityOptions = [{ label: 'Semua Entitas', value: null }, ...Object.entries(AUDIT_ENTITY_LABEL).map(([value, label]) => ({ label, value }))];
const actionLabel = (code) => AUDIT_ACTION_LABEL[code] || code;
const entityLabel = (code) => AUDIT_ENTITY_LABEL[code] || code || 'Sistem';

// Rentang tanggal log (backlog E39 task 273: filter user, entitas, tanggal)
const dateRange = ref(null);
function iso(d) {
    if (!d) return undefined;
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

async function loadAuditLogs() {
    loading.value = true;
    try {
        // Filter dijalankan di server agar log lama tetap bisa ditemukan
        const data = await adminService.getAuditLogs({
            action: actionFilter.value || undefined,
            entity: entityFilter.value || undefined,
            search: searchQuery.value.trim() || undefined,
            start_date: iso(dateRange.value?.[0]),
            end_date: iso(dateRange.value?.[1] || dateRange.value?.[0])
        });
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

function exportCsv() {
    if (!filteredLogs.value.length) {
        toast.add({ severity: 'warn', summary: 'Ekspor', detail: 'Tidak ada data log untuk diekspor', life: 3000 });
        return;
    }

    const headers = ['Waktu', 'Pengguna', 'Aksi', 'Entitas', 'IP Address', 'Detail Perubahan'];
    const rows = filteredLogs.value.map((l) => [
        `"${l.timestamp || l.created_at || ''}"`,
        `"${l.username || l.user || ''}"`,
        `"${actionLabel(l.action)}"`,
        `"${entityLabel(l.entity)}"`,
        `"${l.ip_address || ''}"`,
        `"${(l.details || l.description || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Audit_Trail_SiCuti_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.add({ severity: 'success', summary: 'Ekspor Berhasil', detail: 'File CSV audit log telah diunduh', life: 3000 });
}

onMounted(() => {
    loadAuditLogs();
});
</script>

<template>
    <div class="space-y-6">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h2 class="text-xl font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                    <ShieldCheck class="text-primary w-5 h-5" />
                    <span>Audit Trail & Log Aktivitas</span>
                </h2>
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
                <Button
                    severity="success"
                    size="small"
                    class="text-xs font-bold flex items-center gap-1.5"
                    @click="exportCsv"
                >
                    <Download :size="14" :stroke-width="2" />
                    <span>Ekspor CSV</span>
                </Button>
            </div>
        </div>

        <!-- Filter Bar -->
        <div class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 flex flex-col md:flex-row gap-3 items-center justify-between">
            <div class="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <IconField iconPosition="left" class="w-full sm:w-64">
                    <InputIcon class="!flex items-center justify-center">
                        <Search :size="14" :stroke-width="1.75" class="text-muted-color" />
                    </InputIcon>
                    <InputText
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

            <div class="text-xs text-muted-color w-full md:w-auto text-right">
                Total: <span class="font-bold text-surface-900 dark:text-surface-100">{{ filteredLogs.length }}</span> entri log
            </div>
        </div>

        <!-- DataTable -->
        <div class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 shadow-sm">
            <DataTable
                :value="filteredLogs"
                paginator
                :rows="10"
                :rowsPerPageOptions="[12, 25, 50]"
                class="p-datatable-sm text-xs"
                responsiveLayout="scroll"
                :loading="loading"
            >
                <template #empty>
                    <div class="text-center py-8 text-muted-color text-xs">
                        Tidak ada catatan log audit yang sesuai dengan filter.
                    </div>
                </template>

                <!-- Waktu -->
                <Column field="timestamp" header="Waktu (WIB)" sortable style="width: 13%">
                    <template #body="{ data }">
                        <!-- Tanggal dan jam dipisah per baris, bukan terpotong di tengah tanggal -->
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

                <!-- Pengguna -->
                <Column field="username" header="Pengguna" sortable style="width: 18%">
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

                <!-- Aksi -->
                <Column field="action" header="Aksi" sortable style="width: 15%">
                    <template #body="{ data }">
                        <Tag
                            :value="actionLabel(data.action)"
                            :severity="getActionSeverity(data.action)"
                            :title="data.action"
                            class="text-[11px]"
                        />
                    </template>
                </Column>

                <!-- Entitas -->
                <Column field="entity" header="Entitas" sortable style="width: 13%">
                    <template #body="{ data }">
                        <span class="px-2 py-0.5 rounded text-[11px] font-mono bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 border border-surface-200 dark:border-surface-700">
                            {{ entityLabel(data.entity) }}
                        </span>
                    </template>
                </Column>

                <!-- IP Address -->
                <Column field="ip_address" header="IP Address" style="width: 13%">
                    <template #body="{ data }">
                        <span class="font-mono text-muted-color text-[11px] flex items-center gap-1">
                            <Globe :size="11" class="text-surface-400" />
                            {{ data.ip_address || '-' }}
                        </span>
                    </template>
                </Column>

                <!-- Detail Perubahan -->
                <Column field="details" header="Detail Perubahan" style="width: 20%">
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

        <!-- Modal Detail Audit -->
        <Dialog
            v-model:visible="detailDialogVisible"
            modal
            header="Rincian Log Aktivitas"
            :style="{ width: '500px', maxWidth: '95vw' }"
        >
            <div v-if="selectedLog" class="space-y-4 pt-2 text-xs">
                <div class="grid grid-cols-2 gap-3 p-3 rounded-xl bg-surface-50 dark:bg-surface-800/60 border border-surface-200 dark:border-surface-700">
                    <div>
                        <span class="text-muted-color block mb-0.5">Waktu Kejadian</span>
                        <span class="font-semibold text-surface-900 dark:text-surface-100">{{ formatDate(String(selectedLog.timestamp || selectedLog.created_at || '').split(/[ T]/)[0]) }}, {{ String(selectedLog.timestamp || selectedLog.created_at || '').split(/[ T]/)[1]?.slice(0, 8) }} WIB</span>
                    </div>
                    <div>
                        <span class="text-muted-color block mb-0.5">IP Address</span>
                        <span class="font-mono font-semibold text-surface-900 dark:text-surface-100">{{ selectedLog.ip_address || '-' }}</span>
                    </div>
                    <div>
                        <span class="text-muted-color block mb-0.5">Pengguna</span>
                        <span class="font-semibold text-surface-900 dark:text-surface-100">{{ selectedLog.username || selectedLog.user || '-' }}</span>
                    </div>
                    <div>
                        <span class="text-muted-color block mb-0.5">Entitas Target</span>
                        <span class="font-mono font-semibold text-surface-900 dark:text-surface-100">{{ selectedLog.entity || '-' }}</span>
                    </div>
                </div>

                <div>
                    <span class="text-muted-color block mb-1 font-semibold">Tipe Aksi</span>
                    <Tag
                        :value="selectedLog.action"
                        :severity="getActionSeverity(selectedLog.action)"
                        class="text-xs font-mono"
                    />
                </div>

                <div>
                    <span class="text-muted-color block mb-1 font-semibold">Keterangan / Deskripsi Perubahan</span>
                    <div class="p-3 rounded-lg bg-surface-100 dark:bg-surface-800 text-surface-800 dark:text-surface-200 leading-relaxed font-mono text-[11px] whitespace-pre-wrap break-words">
                        {{ selectedLog.details || selectedLog.description || '-' }}
                    </div>
                </div>

                <div v-if="selectedLog.payload" class="space-y-1">
                    <span class="text-muted-color block font-semibold">Payload Data (JSON)</span>
                    <pre class="p-3 rounded-lg bg-surface-950 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-48">{{ JSON.stringify(selectedLog.payload, null, 2) }}</pre>
                </div>

                <div class="flex justify-end pt-2">
                    <Button
                        label="Tutup"
                        severity="secondary"
                        size="small"
                        class="text-xs"
                        @click="detailDialogVisible = false"
                    />
                </div>
            </div>
        </Dialog>
    </div>
</template>
