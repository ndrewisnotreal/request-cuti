<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { leaveService } from '@/service/leaveService';
import {
    getStatusSeverity,
    getStatusLabel,
    formatDate,
    can,
    lastReturnNote,
    documentPending,
    sicutiState
} from '@/service/sicutiService';
import LeaveDetailDialog from '@/components/leave/LeaveDetailDialog.vue';
import LeaveFormDialog from '@/components/leave/LeaveFormDialog.vue';
import LeaveCompleteDocumentDialog from '@/components/leave/LeaveCompleteDocumentDialog.vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { Plus, Search, Eye, Trash2, Pencil, FolderOpen, RotateCcw, X, Ban, FileUp } from 'lucide-vue-next';

const toast = useToast();
const confirm = useConfirm();
const router = useRouter();
const route = useRoute();

const loading = ref(false);
const myRequests = ref([]);
const selectedRequest = ref(null);
const detailVisible = ref(false);
const statusFilter = ref(null);
const searchQuery = ref('');
const first = ref(0);
const rows = ref(10);
const paginatedMobileRequests = computed(() => {
    return filteredRequests.value.slice(first.value, first.value + rows.value);
});

const isLeaveFormVisible = ref(false);
const editingLeaveId = ref(null);
const editingLeaveData = ref(null);

watch(searchQuery, () => {
    first.value = 0;
});

async function fetchRequests() {
    loading.value = true;
    try {
        const list = await leaveService.getMyLeaves({ limit: 100 });
        myRequests.value = Array.isArray(list) ? list : [];
    } catch (err) {
        console.error('Failed to fetch leave history:', err);
    } finally {
        loading.value = false;
    }
}

onMounted(() => {
    fetchRequests();
});
watch(() => sicutiState.dataVersion, fetchRequests);

const docDialogVisible = ref(false);
const docRequest = ref(null);

function openCompleteDocument(req) {
    docRequest.value = req;
    docDialogVisible.value = true;
}

const canSubmit = computed(() => can('pengajuan_cuti.submit'));
const canEditReturned = computed(() => can('pengajuan_cuti.edit_returned'));
const canCancel = computed(() => can('pengajuan_cuti.cancel'));

function openNewLeave() {
    if (!canSubmit.value) return;
    editingLeaveId.value = null;
    editingLeaveData.value = null;
    isLeaveFormVisible.value = true;
}

function openEditLeave(reqOrId) {
    if (!canSubmit.value && !canEditReturned.value) return;
    if (reqOrId && typeof reqOrId === 'object') {
        editingLeaveData.value = reqOrId;
        editingLeaveId.value = reqOrId.id_request || reqOrId.id;
    } else {
        editingLeaveId.value = reqOrId;
        const found = myRequests.value.find((r) => (r.id_request || r.id) === reqOrId);
        editingLeaveData.value = found || (reqOrId ? { id: reqOrId } : null);
    }
    isLeaveFormVisible.value = true;
}

watch(
    () => [route.query.action, route.query.editId],
    ([action, editId]) => {
        if (action === 'new_leave') {
            openNewLeave();
            router.replace({ query: {} });
        } else if (editId) {
            openEditLeave(editId);
            router.replace({ query: {} });
        }
    },
    { immediate: true }
);

const stats = computed(() => {
    const list = myRequests.value;
    const total = list.length;
    const pending = list.filter((r) => r.status === 'submitted' || r.status === 'pending_validation').length;
    const approved = list.filter((r) => r.status === 'approved' || r.status === 'completed').length;
    const count = (status) => list.filter((r) => r.status === status).length;
    return { total, draft: count('draft'), pending, approved, returned: count('returned'), rejected: count('rejected'), cancelled: count('cancelled') };
});

const statusTabs = computed(() => [
    { key: null, label: 'Semua', count: stats.value.total },
    { key: 'draft', label: 'Draf', count: stats.value.draft },
    { key: 'pending_group', label: 'Menunggu Approval', count: stats.value.pending },
    { key: 'approved', label: 'Disetujui', count: stats.value.approved },
    { key: 'returned', label: 'Dikembalikan', count: stats.value.returned },
    { key: 'rejected', label: 'Ditolak', count: stats.value.rejected },
    { key: 'cancelled', label: 'Dibatalkan', count: stats.value.cancelled }
]);

const filteredRequests = computed(() => {
    return myRequests.value.filter((r) => {
        if (statusFilter.value) {
            if (statusFilter.value === 'pending_group') {
                if (r.status !== 'submitted' && r.status !== 'pending_validation') return false;
            } else if (statusFilter.value === 'approved') {
                if (r.status !== 'approved' && r.status !== 'completed') return false;
            } else if (r.status !== statusFilter.value) {
                return false;
            }
        }
        if (searchQuery.value) {
            const q = searchQuery.value.toLowerCase().trim();
            const id = (r.id_request || r.id || '').toLowerCase();
            const typeName = (r.nm_leave_type || r.leaveTypeName || r.kd_leave_type || '').toLowerCase();
            const reason = (r.reason || '').toLowerCase();
            if (!id.includes(q) && !typeName.includes(q) && !reason.includes(q)) {
                return false;
            }
        }
        return true;
    });
});

function setQuickFilter(val) {
    first.value = 0;
    statusFilter.value = val;
}

function resetFilters() {
    searchQuery.value = '';
    statusFilter.value = null;
    first.value = 0;
}

function formatPeriod(start, end) {
    if (!start) return '-';
    if (!end || start === end) {
        return formatDate(start);
    }
    return `${formatDate(start)} – ${formatDate(end)}`;
}

function viewDetail(req) {
    selectedRequest.value = req;
    detailVisible.value = true;
}

function cancelRequest(req) {
    const id = req.id_request || req.id;

    confirm.require({
        message: `Batalkan pengajuan cuti #${id}? Pengajuan yang dibatalkan tidak dapat diproses lagi.`,
        header: 'Konfirmasi Pembatalan Cuti',
        icon: 'pi pi-exclamation-triangle',
        rejectProps: { label: 'Kembali', severity: 'secondary', outlined: true },
        acceptProps: { label: 'Ya, Batalkan Pengajuan', severity: 'danger' },
        accept: async () => {
            try {
                await leaveService.cancelLeave(id);
                toast.add({
                    severity: 'info',
                    summary: 'Cuti Dibatalkan',
                    detail: `Pengajuan #${id} berhasil dibatalkan`,
                    life: 4500
                });
                await fetchRequests();
            } catch (err) {
                const msg = err?.data?.message || err?.message || 'Gagal membatalkan pengajuan cuti';
                toast.add({
                    severity: 'error',
                    summary: 'Gagal Membatalkan',
                    detail: msg,
                    life: 4000
                });
            }
        }
    });
}
</script>

<template>
    <div class="space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100">Pengajuan Cuti</h1>
                <p class="text-xs text-muted-color">Ajukan cuti dan pantau proses persetujuannya</p>
            </div>
            <Button v-if="canSubmit" data-tour="leave-add" @click="openNewLeave" size="small" class="font-semibold text-xs flex items-center gap-1.5 self-start sm:self-auto">
                <Plus :size="14" :stroke-width="2" />
                <span>Tambah Pengajuan</span>
            </Button>
        </div>

        <div class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-900 shadow-2xs overflow-hidden">
            <div data-tour="leave-status-tabs" class="flex gap-5 px-4 border-b border-surface-200 dark:border-surface-700 overflow-x-auto scrollbar-none" role="tablist" aria-label="Saring status pengajuan">
                <button
                    v-for="tab in statusTabs"
                    :key="tab.key || 'all'"
                    type="button"
                    role="tab"
                    :aria-selected="statusFilter === tab.key"
                    @click="setQuickFilter(tab.key)"
                    :class="[
                        'relative py-3 text-xs whitespace-nowrap flex items-center gap-1.5 cursor-pointer transition-colors',
                        statusFilter === tab.key
                            ? 'text-primary font-semibold after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-primary after:rounded-full'
                            : 'text-muted-color font-medium hover:text-surface-800 dark:hover:text-surface-200'
                    ]"
                >
                    <span>{{ tab.label }}</span>
                    <span
                        :class="[
                            'min-w-5 px-1.5 rounded-full text-[11px] leading-5 text-center tabular-nums',
                            statusFilter === tab.key ? 'bg-primary/10 text-primary' : 'bg-surface-100 dark:bg-surface-800 text-muted-color'
                        ]"
                    >{{ tab.count }}</span>
                </button>
            </div>

            <div class="p-3.5 sm:p-4 border-b border-surface-200/80 dark:border-surface-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div data-tour="leave-search" class="w-full sm:w-80 md:w-96 relative">
                    <IconField iconPosition="left" class="w-full">
                        <InputIcon class="!left-3">
                            <Search :size="15" :stroke-width="1.8" class="text-surface-400 dark:text-surface-500" />
                        </InputIcon>
                        <InputText
                            id="cari-pengajuan"
                            name="cari-pengajuan"
                            v-model="searchQuery"
                            placeholder="Cari nomor ID, jenis cuti, atau alasan..."
                            aria-label="Cari pengajuan cuti"
                            class="w-full text-xs !pl-9 !pr-8"
                        />
                    </IconField>
                    <button
                        v-if="searchQuery"
                        type="button"
                        class="absolute right-2.5 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 p-1 rounded-md transition-colors cursor-pointer"
                        @click="searchQuery = ''"
                        title="Hapus pencarian"
                    >
                        <X :size="13" :stroke-width="2" />
                    </button>
                </div>

                <div class="flex items-center gap-2">
                    <Button
                        v-if="statusFilter !== null || searchQuery"
                        severity="secondary"
                        text
                        size="small"
                        class="text-xs font-semibold text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100 flex items-center gap-1 px-2.5 py-1"
                        @click="resetFilters"
                    >
                        <RotateCcw :size="12" :stroke-width="2" />
                        <span>Reset</span>
                    </Button>
                </div>
            </div>

            <div class="hidden md:block">
                <DataTable
                    v-model:first="first"
                    :value="filteredRequests"
                    :loading="loading"
                    paginator
                    :rows="rows"
                    :rowsPerPageOptions="[5, 10, 20, 50]"
                    paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport"
                    currentPageReportTemplate="Menampilkan {first} - {last} dari {totalRecords} data"
                    :rowHover="true"
                    class="p-datatable-sm text-xs"
                    responsiveLayout="scroll"
                >
                    <template #empty>
                        <div class="text-center py-12 text-muted-color text-sm">
                            <FolderOpen :size="40" :stroke-width="1.5" class="text-surface-300 dark:text-surface-600 mb-3 block mx-auto" />
                            <p class="font-medium text-surface-700 dark:text-surface-300 mb-1">
                                {{ searchQuery || statusFilter ? 'Data cuti tidak ditemukan' : 'Belum ada pengajuan cuti' }}
                            </p>
                            <p class="text-xs text-muted-color mb-4">
                                {{ searchQuery || statusFilter ? 'Coba ubah kata kunci pencarian atau bersihkan filter status.' : 'Anda belum pernah membuat permohonan cuti.' }}
                            </p>
                            <Button
                                v-if="searchQuery || statusFilter"
                                severity="secondary"
                                outlined
                                size="small"
                                class="text-xs font-semibold"
                                @click="resetFilters"
                            >
                                Bersihkan Saringan
                            </Button>
                            <Button
                                v-else-if="canSubmit"
                                size="small"
                                class="text-xs font-semibold"
                                @click="openNewLeave"
                            >
                                Tambah Pengajuan
                            </Button>
                        </div>
                    </template>

                    <Column header="No" style="width: 3.5rem" class="text-center">
                        <template #body="{ index }">
                            <span class="text-muted-color font-semibold text-xs tabular-nums">{{ first + index + 1 }}</span>
                        </template>
                    </Column>

                    <Column field="id_request" header="No. Pengajuan" sortable style="width: 13%">
                        <template #body="{ data }">
                            <span class="text-xs font-semibold text-primary whitespace-nowrap">{{ data.id_request || data.id }}</span>
                        </template>
                    </Column>

                    <Column field="created_at" header="Tgl. Pengajuan" sortable style="width: 13%">
                        <template #body="{ data }">
                            <span class="text-xs text-surface-600 dark:text-surface-300 tabular-nums">
                                {{ formatDate(data.created_at || data.createdAt) }}
                            </span>
                        </template>
                    </Column>

                    <Column header="Jenis Cuti & Alasan" style="min-width: 220px">
                        <template #body="{ data }">
                            <div class="flex flex-col gap-0.5 py-0.5">
                                <span class="text-xs font-semibold text-surface-900 dark:text-surface-0">
                                    {{ data.nm_leave_type || data.leaveTypeName || data.kd_leave_type || '-' }}
                                </span>
                                <span
                                    class="text-[11px] text-muted-color line-clamp-1"
                                    :title="data.reason || '-'"
                                >
                                    {{ data.reason || '-' }}
                                </span>
                            </div>
                        </template>
                    </Column>

                    <Column header="Periode Cuti" sortable style="width: 18%">
                        <template #body="{ data }">
                            <span class="text-xs text-surface-700 dark:text-surface-200 tabular-nums font-medium">
                                {{ formatPeriod(data.start_date || data.startDate, data.end_date || data.endDate) }}
                            </span>
                        </template>
                    </Column>

                    <Column header="Durasi" sortable style="width: 10%" class="text-left">
                        <template #body="{ data }">
                            <span class="inline-flex items-center px-2 py-0.5 rounded-md bg-surface-100 dark:bg-surface-800 text-xs font-semibold text-surface-800 dark:text-surface-200 tabular-nums">
                                {{ data.total_days ?? data.totalDays ?? '-' }} <span class="font-normal text-muted-color ml-1" title="Sabtu, Minggu & libur nasional tidak dihitung">hari kerja</span>
                            </span>
                        </template>
                    </Column>

                    <Column field="status" header="Status" sortable style="width: 14%" class="text-left" :pt="{ headerCell: { 'data-tour': 'leave-col-status' } }">
                        <template #body="{ data }">
                            <Tag
                                :value="getStatusLabel(data.status)"
                                :severity="getStatusSeverity(data.status)"
                                class="text-xs font-semibold !rounded-full !px-2.5 !py-0.5"
                            />
                            <p
                                v-if="data.status === 'returned' && lastReturnNote(data)?.notes"
                                class="mt-1 text-[11px] leading-snug text-amber-700 dark:text-amber-300 line-clamp-2"
                                :title="lastReturnNote(data).notes"
                            >
                                {{ lastReturnNote(data).notes }}
                            </p>
                        </template>
                    </Column>

                    <Column header="Aksi" style="width: 12rem; min-width: 12rem" class="text-left" :pt="{ headerCell: { 'data-tour': 'leave-col-aksi' } }">
                        <template #body="{ data }">
                            <div class="flex items-center justify-start gap-1.5 flex-wrap">
                                <Button
                                    size="small"
                                    severity="secondary"
                                    text
                                    class="text-xs font-semibold py-1 px-2.5 flex items-center gap-1"
                                    @click="viewDetail(data)"
                                    title="Lihat Detail"
                                >
                                    <Eye :size="14" />
                                    <span>Detail</span>
                                </Button>

                                <button
                                    v-if="documentPending(data) && ['submitted', 'pending_validation', 'returned'].includes(data.status)"
                                    type="button"
                                    class="h-7 px-2 flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-md transition-colors cursor-pointer"
                                    :title="`Unggah dokumen paling lambat ${formatDate(data.document_due_date)}`"
                                    @click="openCompleteDocument(data)"
                                >
                                    <FileUp :size="12" :stroke-width="2.2" />
                                    <span>Lengkapi Dokumen</span>
                                </button>

                                <button
                                    v-else-if="data.status === 'returned' && canEditReturned"
                                    type="button"
                                    class="h-7 px-2 flex items-center gap-1 text-[11px] font-semibold text-primary hover:bg-primary/10 rounded-md transition-colors cursor-pointer"
                                    @click="openEditLeave(data)"
                                    title="Ajukan Ulang / Ubah"
                                >
                                    <RotateCcw :size="12" :stroke-width="2.2" />
                                    <span>Ajukan Ulang / Ubah</span>
                                </button>

                                <button
                                    v-else-if="data.status === 'draft' && canSubmit"
                                    type="button"
                                    class="w-7 h-7 flex items-center justify-center rounded-md text-surface-500 dark:text-surface-400 transition-colors cursor-pointer hover:text-primary hover:bg-surface-100 dark:hover:bg-surface-800"
                                    @click="openEditLeave(data)"
                                    title="Ubah Draf"
                                >
                                    <Pencil :size="15" :stroke-width="1.75" />
                                </button>

                                <button
                                    v-if="['submitted', 'draft'].includes(data.status) && canCancel"
                                    type="button"
                                    class="w-7 h-7 flex items-center justify-center rounded-md text-surface-500 dark:text-surface-400 transition-colors cursor-pointer hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                                    @click="cancelRequest(data)"
                                    title="Batalkan Pengajuan"
                                >
                                    <Trash2 :size="15" :stroke-width="1.75" />
                                </button>
                            </div>
                        </template>
                    </Column>
                </DataTable>
            </div>

            <div data-tour="leave-list-mobile" class="block md:hidden p-3.5 space-y-3">
                <div v-if="!filteredRequests.length && !loading" class="text-center py-10 text-muted-color text-sm">
                    <FolderOpen :size="36" :stroke-width="1.5" class="text-surface-300 dark:text-surface-600 mb-2.5 block mx-auto" />
                    <p class="font-medium text-surface-700 dark:text-surface-300 mb-1">
                        {{ searchQuery || statusFilter ? 'Data cuti tidak ditemukan' : 'Belum ada pengajuan cuti' }}
                    </p>
                    <p class="text-xs text-muted-color mb-3">
                        {{ searchQuery || statusFilter ? 'Coba ubah kata kunci pencarian atau bersihkan filter status.' : 'Anda belum pernah membuat permohonan cuti.' }}
                    </p>
                    <Button
                        v-if="searchQuery || statusFilter"
                        severity="secondary"
                        outlined
                        size="small"
                        class="text-xs font-semibold"
                        @click="resetFilters"
                    >
                        Bersihkan Saringan
                    </Button>
                    <Button
                        v-else-if="canSubmit"
                        size="small"
                        class="text-xs font-semibold"
                        @click="openNewLeave"
                    >
                        Tambah Pengajuan
                    </Button>
                </div>

                <div
                    v-for="item in paginatedMobileRequests"
                    :key="item.id_request || item.id"
                    class="p-4 rounded-xl border border-surface-200/80 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-800/40 space-y-3 shadow-2xs"
                >
                    <div class="flex items-start justify-between gap-2">
                        <div>
                            <span class="text-xs font-semibold text-primary block">
                                {{ item.id_request || item.id }}
                            </span>
                            <span class="text-xs font-medium text-surface-900 dark:text-surface-0">
                                {{ item.nm_leave_type || item.leaveTypeName || item.kd_leave_type || '-' }}
                            </span>
                        </div>
                        <Tag
                            :value="getStatusLabel(item.status)"
                            :severity="getStatusSeverity(item.status)"
                            class="text-xs font-semibold !rounded-full !px-2.5 !py-0.5"
                        />
                    </div>

                    <div class="text-xs text-surface-600 dark:text-surface-300 space-y-1.5 pt-1 border-t border-surface-200/60 dark:border-surface-700/60">
                        <div class="flex items-center justify-between">
                            <span class="text-muted-color">Tgl. Pengajuan:</span>
                            <span class="tabular-nums">{{ formatDate(item.created_at || item.createdAt) }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-muted-color">Periode:</span>
                            <span class="font-medium tabular-nums text-surface-800 dark:text-surface-200">
                                {{ formatPeriod(item.start_date || item.startDate, item.end_date || item.endDate) }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-muted-color">Durasi:</span>
                            <span class="inline-flex items-center px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 font-semibold text-surface-800 dark:text-surface-200 tabular-nums">
                                {{ item.total_days ?? item.totalDays ?? '-' }} hari kerja
                            </span>
                        </div>
                        <div v-if="item.reason" class="pt-1">
                            <span class="text-muted-color block text-[11px]">Alasan:</span>
                            <p class="text-[11px] text-surface-700 dark:text-surface-300 italic line-clamp-2">{{ item.reason }}</p>
                        </div>
                        <p
                            v-if="item.status === 'returned' && lastReturnNote(item)?.notes"
                            class="mt-1 text-[11px] leading-snug text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg"
                        >
                            <strong>Catatan Pengembalian:</strong> {{ lastReturnNote(item).notes }}
                        </p>
                    </div>

                    <div class="pt-2.5 border-t border-surface-200/60 dark:border-surface-700/60 flex items-center justify-end gap-2 flex-wrap">
                        <Button
                            size="small"
                            severity="secondary"
                            outlined
                            class="text-xs font-semibold py-1 px-2.5 flex items-center gap-1"
                            @click="viewDetail(item)"
                        >
                            <Eye :size="13" />
                            <span>Detail</span>
                        </Button>
                        <button
                            v-if="documentPending(item) && ['submitted', 'pending_validation', 'returned'].includes(item.status)"
                            type="button"
                            class="h-7 px-2.5 flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
                            @click="openCompleteDocument(item)"
                        >
                            <FileUp :size="12" :stroke-width="2.2" />
                            <span>Lengkapi Dokumen</span>
                        </button>
                        <button
                            v-else-if="item.status === 'returned' && canEditReturned"
                            type="button"
                            class="h-7 px-2.5 flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors cursor-pointer"
                            @click="openEditLeave(item)"
                        >
                            <RotateCcw :size="12" :stroke-width="2.2" />
                            <span>Ajukan Ulang</span>
                        </button>
                        <button
                            v-else-if="item.status === 'draft' && canSubmit"
                            type="button"
                            class="h-7 px-2.5 flex items-center gap-1 text-[11px] font-semibold text-surface-700 dark:text-surface-200 bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 rounded-lg transition-colors cursor-pointer"
                            @click="openEditLeave(item)"
                        >
                            <Pencil :size="12" :stroke-width="1.75" />
                            <span>Ubah Draf</span>
                        </button>
                        <button
                            v-if="['submitted', 'draft'].includes(item.status) && canCancel"
                            type="button"
                            class="h-7 px-2.5 flex items-center gap-1 text-[11px] font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                            @click="cancelRequest(item)"
                        >
                            <Trash2 :size="12" :stroke-width="1.75" />
                            <span>Batalkan</span>
                        </button>
                    </div>
                </div>

                <Paginator
                    v-if="filteredRequests.length > rows"
                    v-model:first="first"
                    :rows="rows"
                    :totalRecords="filteredRequests.length"
                    template="PrevPageLink PageLinks NextPageLink"
                    class="mt-2 border-0 bg-transparent"
                />
            </div>
        </div>

        <LeaveDetailDialog v-model:visible="detailVisible" :request="selectedRequest" @refresh="fetchRequests" @edit="openEditLeave" />

        <LeaveCompleteDocumentDialog
            v-model:visible="docDialogVisible"
            :request="docRequest"
            @uploaded="fetchRequests"
        />
        <LeaveFormDialog v-model:visible="isLeaveFormVisible" :editId="editingLeaveId" :editingLeave="editingLeaveData" @saved="fetchRequests" />
    </div>
</template>

<style scoped>
:deep(.header-center .p-datatable-column-header-content),
:deep(th.text-center .p-datatable-column-header-content) {
    justify-content: center;
}
:deep(.header-right .p-datatable-column-header-content),
:deep(th.text-right .p-datatable-column-header-content) {
    justify-content: flex-end;
}
</style>
