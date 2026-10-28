<script setup>
import { ref, computed, onMounted } from 'vue';
import { isSuperAdmin, can, setActiveLeaveTypes } from '@/service/sicutiService';
import { adminService } from '@/service/adminService';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { Plus, Pencil, Ban, Check } from 'lucide-vue-next';
import ReadOnlyNotice from '@/components/common/ReadOnlyNotice.vue';
import LeaveTypeFormDialog from '@/components/admin/LeaveTypeFormDialog.vue';

const toast = useToast();
const confirm = useConfirm();
const dialogVisible = ref(false);
const isEditing = ref(false);
const leaveTypes = ref([]);

const canManage = computed(() => isSuperAdmin() || can('master_data.manage_leave_types'));

const currentType = ref({
    id: '',
    code: '',
    name: '',
    description: '',
    usesQuota: true,
    requiresDocument: false,
    isActive: true,
    maxDays: null,
    allowBackdate: false,
    allowLateDocument: false,
    lateDocumentDays: 3
});

function fromApi(t) {
    return {
        id: t.kd_leave_type,
        code: t.code,
        name: t.nm_leave_type,
        description: t.description || '',
        usesQuota: Boolean(t.uses_quota),
        requiresDocument: Boolean(t.requires_document),
        isActive: Boolean(t.is_active),
        maxDays: t.max_days ? Number(t.max_days) : null,
        allowBackdate: Boolean(t.allow_backdate),
        allowLateDocument: Boolean(t.allow_late_document),
        lateDocumentDays: Number(t.late_document_days) || 3
    };
}


async function load() {
    try {
        const list = await adminService.getLeaveTypes(true);
        leaveTypes.value = (Array.isArray(list) ? list : []).map(fromApi);
        setActiveLeaveTypes(list);
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Jenis cuti gagal dimuat', detail: err.message, life: 4000 });
    }
}

function openAdd() {
    isEditing.value = false;
    const existingNums = leaveTypes.value
        .map((t) => {
            const m = String(t.id || '').match(/\d+/);
            return m ? parseInt(m[0], 10) : 0;
        })
        .filter((n) => !isNaN(n));
    const nextNum = (existingNums.length ? Math.max(...existingNums) : 0) + 1;
    currentType.value = {
        id: 'LT' + String(nextNum).padStart(3, '0'),
        code: '',
        name: '',
        description: '',
        usesQuota: false,
        requiresDocument: false,
        isActive: true,
        maxDays: null,
        allowBackdate: false,
        allowLateDocument: false,
        lateDocumentDays: 3
    };
    dialogVisible.value = true;
}

function openEdit(item) {
    isEditing.value = true;
    currentType.value = { ...item };
    dialogVisible.value = true;
}


function toggleStatus(item) {
    if (!item.isActive) return applyStatus(item);
    confirm.require({
        header: 'Nonaktifkan jenis cuti?',
        message: `${item.name} tidak bisa dipilih lagi di pengajuan baru. Pengajuan yang sudah ada tidak berubah.`,
        acceptLabel: 'Nonaktifkan',
        rejectLabel: 'Batal',
        acceptProps: { severity: 'danger' },
        rejectProps: { severity: 'secondary', outlined: true },
        accept: () => applyStatus(item)
    });
}

function toApi(t) {
    return {
        kd_leave_type: t.id || undefined,
        code: (t.code || '').trim(),
        nm_leave_type: (t.name || '').trim(),
        description: t.description?.trim() || undefined,
        uses_quota: t.usesQuota,
        requires_document: t.requiresDocument,
        is_active: t.isActive,
        max_days: t.maxDays ? Number(t.maxDays) : null,
        allow_backdate: t.allowBackdate,
        allow_late_document: t.requiresDocument && t.allowLateDocument,
        late_document_days: Number(t.lateDocumentDays) || 3
    };
}

async function applyStatus(item) {
    try {
        await adminService.upsertLeaveType(toApi({ ...item, isActive: !item.isActive }));
        await load();
        toast.add({
            severity: 'info',
            summary: 'Status',
            detail: `Status jenis cuti ${item.name} diubah menjadi ${!item.isActive ? 'Aktif' : 'Nonaktif'}`,
            life: 3000
        });
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Status gagal diubah', detail: err.message, life: 4000 });
    }
}

onMounted(load);
</script>

<template>
    <div class="space-y-6">
        <ReadOnlyNotice data-tour="readonly-notice" v-if="!canManage" module="jenis cuti" />
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100">Master Jenis Cuti</h1>
                <p class="text-xs text-muted-color">Konfigurasi jenis cuti, aturan pengurangan kuota tahunan, dan syarat dokumen</p>
            </div>
            <Button data-tour="lt-add"
                v-if="canManage"
                severity="primary"
                size="small"
                class="text-xs font-bold flex items-center gap-1.5"
                @click="openAdd"
            >
                <Plus :size="14" :stroke-width="2" />
                <span>Tambah Jenis Cuti</span>
            </Button>
        </div>

        <div data-tour="lt-table" class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 shadow-sm">
            <DataTable :value="leaveTypes" class="p-datatable-sm text-xs" responsiveLayout="scroll">
                <Column field="code" header="Kode" style="width: 10%">
                    <template #body="{ data }">
                        <span class="font-bold text-sky-600">{{ data.code }}</span>
                    </template>
                </Column>
                <Column field="name" header="Nama Jenis Cuti" style="width: 25%">
                    <template #body="{ data }">
                        <div class="font-bold text-surface-900 dark:text-surface-100">{{ data.name }}</div>
                        <div class="text-[11px] text-muted-color">{{ data.description }}</div>
                    </template>
                </Column>
                <Column header="Mengurangi Kuota" style="width: 18%" :pt="{ headerCell: { 'data-tour': 'lt-col-quota' } }">
                    <template #body="{ data }">
                        <Tag
                            :value="data.usesQuota ? 'Ya (Kurangi Kuota)' : 'Tidak (Cuti Khusus)'"
                            :severity="data.usesQuota ? 'warn' : 'info'"
                            class="text-[11px]"
                        />
                    </template>
                </Column>
                <Column header="Wajib Dokumen" style="width: 18%">
                    <template #body="{ data }">
                        <Tag
                            :value="data.requiresDocument ? (data.allowLateDocument ? `Wajib, boleh menyusul ${data.lateDocumentDays} hari` : 'Wajib Bukti') : 'Tidak Wajib'"
                            :severity="data.requiresDocument ? 'danger' : 'secondary'"
                            class="text-[11px]"
                        />
                    </template>
                </Column>
                <Column header="Aturan" style="width: 16%" :pt="{ headerCell: { 'data-tour': 'lt-col-rules' } }">
                    <template #body="{ data }">
                        <div class="text-[11px] text-surface-700 dark:text-surface-300 space-y-0.5">
                            <div>{{ data.maxDays ? `Maks. ${data.maxDays} hari kerja` : 'Tanpa batas hari' }}</div>
                            <div :class="data.allowBackdate ? 'text-amber-700 dark:text-amber-300' : 'text-muted-color'">
                                {{ data.allowBackdate ? 'Boleh tanggal lampau' : 'Tidak boleh tanggal lampau' }}
                            </div>
                        </div>
                    </template>
                </Column>
                <Column header="Status" style="width: 12%">
                    <template #body="{ data }">
                        <Tag :value="data.isActive ? 'Aktif' : 'Nonaktif'" :severity="data.isActive ? 'success' : 'secondary'" class="text-[11px]" />
                    </template>
                </Column>
                <Column v-if="canManage" header="Aksi" style="width: 17%">
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
                                :class="[
                                    'p-1.5 rounded-lg transition-colors cursor-pointer',
                                    data.isActive
                                        ? 'text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20'
                                        : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20'
                                ]"
                                @click="toggleStatus(data)"
                                :title="data.isActive ? 'Nonaktifkan' : 'Aktifkan'"
                            >
                                <Ban v-if="data.isActive" :size="15" :stroke-width="1.75" />
                                <Check v-else :size="15" :stroke-width="2" />
                            </button>
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>

        <LeaveTypeFormDialog
            v-model:visible="dialogVisible"
            :is-editing="isEditing"
            :type-data="currentType"
            @saved="load"
        />
    </div>
</template>
