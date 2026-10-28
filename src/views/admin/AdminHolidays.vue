<script setup>
import { ref, computed } from 'vue';
import { sicutiState, syncFromBackend, isSuperAdmin, can, formatDate, CURRENT_YEAR } from '@/service/sicutiService';
import { useConfirm } from 'primevue/useconfirm';
import { adminService } from '@/service/adminService';
import { useToast } from 'primevue/usetoast';
import { Plus, Pencil, Trash2, Upload } from 'lucide-vue-next';
import ReadOnlyNotice from '@/components/common/ReadOnlyNotice.vue';
import HolidayFormDialog from '@/components/admin/HolidayFormDialog.vue';
import HolidayBatchUploadDialog from '@/components/admin/HolidayBatchUploadDialog.vue';

const toast = useToast();
const confirm = useConfirm();

const canManage = computed(() => isSuperAdmin() || can('master_data.manage_holidays'));

const dialogVisible = ref(false);
const isEditing = ref(false);
const selectedHoliday = ref(null);

const importDialogVisible = ref(false);

function dateLabel(h) {
    if (!h.endDate || h.endDate === h.date) return formatDate(h.date);
    return `${formatDate(h.date)} – ${formatDate(h.endDate)}`;
}

const holidayCounts = computed(() => {
    const list = sicutiState.holidays || [];
    const national = list.filter((h) => h.type === 'national').length;
    return { national, collective: list.length - national };
});

function openAdd() {
    isEditing.value = false;
    selectedHoliday.value = null;
    dialogVisible.value = true;
}

function openEdit(item) {
    isEditing.value = true;
    selectedHoliday.value = { ...item };
    dialogVisible.value = true;
}

function openImportHolidays() {
    importDialogVisible.value = true;
}

function deleteHoliday(item) {
    confirm.require({
        header: 'Hapus hari libur?',
        message: `${item.name} akan dihapus dari kalender libur.`,
        acceptLabel: 'Hapus',
        rejectLabel: 'Batal',
        acceptProps: { severity: 'danger' },
        rejectProps: { severity: 'secondary', outlined: true },
        accept: async () => {
            try {
                await adminService.deleteHoliday(item.id);
                await syncFromBackend();
                toast.add({ severity: 'info', summary: 'Dihapus', detail: `Hari libur ${item.name} telah dihapus`, life: 3000 });
            } catch (err) {
                toast.add({ severity: 'error', summary: 'Hari libur gagal dihapus', detail: err.message, life: 4000 });
            }
        }
    });
}
</script>

<template>
    <div class="space-y-6">
        <ReadOnlyNotice data-tour="readonly-notice" v-if="!canManage" module="hari libur" />

        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100">Master Hari Libur & Cuti Bersama {{ CURRENT_YEAR }}</h1>
                <p class="text-xs text-muted-color">Tanggal libur resmi yang dikecualikan dari pemotongan kuota cuti tahunan</p>
            </div>
            <div class="flex items-center gap-2">
                <Button data-tour="hol-import"
                    v-if="canManage"
                    severity="secondary"
                    outlined
                    size="small"
                    class="font-semibold flex items-center gap-1.5"
                    @click="openImportHolidays"
                >
                    <Upload :size="14" :stroke-width="2" />
                    <span>Impor CSV</span>
                </Button>
                <Button data-tour="hol-add"
                    v-if="canManage"
                    severity="primary"
                    size="small"
                    class="font-semibold flex items-center gap-1.5"
                    @click="openAdd"
                >
                    <Plus :size="14" :stroke-width="2" />
                    <span>Tambah Hari Libur</span>
                </Button>
            </div>
        </div>

        <div data-tour="hol-table" class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 shadow-sm">
            <div class="flex flex-wrap items-center gap-x-5 gap-y-2 px-1 pb-3 text-sm text-surface-700 dark:text-surface-300">
                <span class="inline-flex items-center gap-2">
                    <span class="size-2.5 rounded-full bg-red-600" aria-hidden="true" />
                    Libur Nasional <strong class="text-surface-900 dark:text-surface-0 tabular-nums">{{ holidayCounts.national }}</strong>
                </span>
                <span class="inline-flex items-center gap-2">
                    <span class="size-2.5 rounded-full bg-amber-500" aria-hidden="true" />
                    Cuti Bersama <strong class="text-surface-900 dark:text-surface-0 tabular-nums">{{ holidayCounts.collective }}</strong>
                </span>
            </div>
            <DataTable :value="sicutiState.holidays" paginator :rows="10" class="p-datatable-sm text-sm" responsiveLayout="scroll">
                <Column field="date" header="Tanggal" style="width: 24%">
                    <template #body="{ data }">
                        <span v-if="data.date" class="font-semibold text-surface-900 dark:text-surface-100">{{ dateLabel(data) }}</span>
                        <span v-else class="text-muted-color">-</span>
                    </template>
                </Column>
                <Column field="name" header="Nama hari libur" style="width: 38%">
                    <template #body="{ data }">
                        <span class="font-semibold text-surface-800 dark:text-surface-200">{{ data.name }}</span>
                    </template>
                </Column>
                <Column field="type" header="Kategori" style="width: 23%" :pt="{ headerCell: { 'data-tour': 'hol-col-type' } }">
                    <template #body="{ data }">
                        <span
                            class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold"
                            :class="
                                data.type === 'national'
                                    ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300'
                                    : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300'
                            "
                        >
                            <span class="size-1.5 rounded-full" :class="data.type === 'national' ? 'bg-red-600' : 'bg-amber-500'" aria-hidden="true" />
                            {{ data.type === 'national' ? 'Libur Nasional' : 'Cuti Bersama' }}
                        </span>
                    </template>
                </Column>
                <Column v-if="canManage" header="Aksi" style="width: 15%">
                    <template #body="{ data }">
                        <div class="flex items-center gap-1">
                            <button
                                type="button"
                                class="p-1.5 text-surface-500 hover:text-primary hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors cursor-pointer"
                                @click="openEdit(data)"
                                title="Ubah"
                            >
                                <Pencil :size="15" :stroke-width="1.75" />
                            </button>
                            <button
                                type="button"
                                class="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors cursor-pointer"
                                @click="deleteHoliday(data)"
                                title="Hapus"
                            >
                                <Trash2 :size="15" :stroke-width="1.75" />
                            </button>
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>

        <HolidayFormDialog
            v-model:visible="dialogVisible"
            :is-editing="isEditing"
            :holiday-data="selectedHoliday"
            @saved="syncFromBackend"
        />

        <HolidayBatchUploadDialog
            v-model:visible="importDialogVisible"
            :year="CURRENT_YEAR"
            @uploaded="syncFromBackend"
        />
    </div>
</template>
