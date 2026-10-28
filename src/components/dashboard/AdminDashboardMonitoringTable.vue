<template>
    <div class="space-y-4">
        <div data-tour="mon-filters" class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 flex flex-col gap-3 shadow-sm">
            <div class="flex flex-wrap items-center gap-3">
                <IconField iconPosition="left" class="w-full sm:w-64">
                    <InputIcon class="!flex items-center justify-center">
                        <Search :size="14" :stroke-width="1.75" class="text-muted-color" />
                    </InputIcon>
                    <InputText
                        id="cari-pemantauan"
                        name="cari-pemantauan"
                        aria-label="Cari pengajuan berdasarkan ID, nama, atau NIK"
                        v-model="searchQuery"
                        placeholder="Cari ID / Nama / NIK..."
                        class="w-full text-xs"
                        size="small"
                    />
                </IconField>

                <div v-if="adminDivision" class="text-xs font-semibold px-3 py-1.5 rounded-lg bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 border border-surface-200 dark:border-surface-700 flex items-center gap-1.5">
                    <span class="text-muted-color">Divisi:</span>
                    <span class="text-primary font-bold">{{ adminDivision }}</span>
                </div>
                <Select
                    v-else-if="isSuper"
                    v-model="departmentFilter"
                    :options="[{ label: 'Semua Divisi', value: null }, ...departments.map(d => ({ label: `${d.nm_dept} (${d.kd_dept})`, value: d.kd_dept }))]"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Pilih Divisi"
                    class="w-full sm:w-44 text-xs"
                    size="small"
                />

                <Select
                    v-model="statusFilter"
                    :options="statusOptions"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Pilih Status"
                    class="w-full sm:w-48 text-xs"
                    size="small"
                />

                <Select
                    v-model="leaveTypeFilter"
                    :options="leaveTypeOptions"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Jenis Cuti"
                    class="w-full sm:w-48 text-xs"
                    size="small"
                />

                <DatePicker
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
            </div>
            <div class="text-xs text-muted-color text-right">
                Menampilkan <span class="font-bold text-surface-900 dark:text-surface-100">{{ filteredRequests.length }}</span> pengajuan
            </div>
        </div>

        <div data-tour="mon-table" class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 shadow-sm">
            <DataTable
                :value="filteredRequests"
                :loading="loading"
                paginator
                :rows="10"
                class="p-datatable-sm text-xs"
                responsiveLayout="scroll"
            >
                <template #empty>
                    <div class="text-center py-8 text-muted-color">Tidak ada pengajuan cuti yang sesuai filter.</div>
                </template>

                <Column header="No. Pengajuan" style="width: 14%">
                    <template #body="{ data }">
                        <span class="font-mono font-bold text-surface-900 dark:text-surface-100">
                            {{ data.id_request || data.id }}
                        </span>
                        <div class="text-[11px] text-muted-color">
                            {{ formatDate(data.created_at || data.createdAt) }}
                        </div>
                    </template>
                </Column>

                <Column header="Karyawan" style="width: 22%">
                    <template #body="{ data }">
                        <div class="font-bold text-surface-900 dark:text-surface-100">
                            {{ data.requester_name || data.userName }}
                        </div>
                        <div class="text-[11px] text-muted-color">
                            NIK: {{ data.namecode || '-' }}
                            <span v-if="data.kd_dept"> · {{ data.kd_dept }}</span>
                        </div>
                    </template>
                </Column>

                <Column header="Jenis Cuti" style="width: 16%">
                    <template #body="{ data }">
                        <span class="font-semibold text-surface-800 dark:text-surface-200">
                            {{ data.nm_leave_type || data.leaveTypeName || data.kd_leave_type }}
                        </span>
                    </template>
                </Column>

                <Column header="Rentang Tanggal" style="width: 20%">
                    <template #body="{ data }">
                        <div>{{ formatDate(data.start_date || data.startDate) }} s/d {{ formatDate(data.end_date || data.endDate) }}</div>
                        <div class="text-[11px] font-bold text-primary">
                            {{ data.total_days || data.totalDays }} Hari Kerja
                        </div>
                    </template>
                </Column>

                <Column header="Status" style="width: 16%">
                    <template #body="{ data }">
                        <Tag
                            :value="getStatusLabel(data.status)"
                            :severity="getStatusSeverity(data.status)"
                            class="text-[11px]"
                        />
                    </template>
                </Column>

                <Column header="Aksi" style="width: 12%" :pt="{ headerCell: { 'data-tour': 'mon-col-aksi' } }">
                    <template #body="{ data }">
                        <Button
                            size="small"
                            severity="secondary"
                            text
                            class="text-xs font-semibold py-1 px-2.5 flex items-center gap-1"
                            @click="emit('view-detail', data)"
                            title="Lihat Detail"
                        >
                            <Eye :size="14" />
                            <span>Detail</span>
                        </Button>
                    </template>
                </Column>
            </DataTable>
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import {
    formatDate,
    getStatusLabel,
    getStatusSeverity,
    STATUS_OPTIONS
} from '@/service/sicutiService';
import { Search, Eye } from 'lucide-vue-next';

const props = defineProps({
    requests: {
        type: Array,
        default: () => []
    },
    loading: {
        type: Boolean,
        default: false
    },
    adminDivision: {
        type: String,
        default: ''
    },
    departments: {
        type: Array,
        default: () => []
    },
    leaveTypes: {
        type: Array,
        default: () => []
    },
    isSuper: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['view-detail', 'refresh']);

const searchQuery = ref('');
const statusFilter = ref(null);
const leaveTypeFilter = ref(null);
const departmentFilter = ref(null);
const dateRange = ref(null);

const statusOptions = computed(() => [
    { label: 'Semua Status', value: null },
    ...STATUS_OPTIONS
]);

const leaveTypeOptions = computed(() => [
    { label: 'Semua Jenis Cuti', value: null },
    ...(props.leaveTypes || []).map((t) => ({
        label: t.nm_leave_type || t.name,
        value: t.kd_leave_type || t.id
    }))
]);

const filteredRequests = computed(() => {
    return (props.requests || []).filter((r) => {
        if (props.adminDivision && r.kd_dept && r.kd_dept !== props.adminDivision) {
            return false;
        }

        if (departmentFilter.value && r.kd_dept !== departmentFilter.value) {
            return false;
        }

        if (statusFilter.value && r.status !== statusFilter.value) {
            return false;
        }

        if (leaveTypeFilter.value) {
            const matchCode = (r.kd_leave_type || r.leaveTypeId) === leaveTypeFilter.value;
            const matchName = (r.nm_leave_type || r.leaveTypeName) === leaveTypeFilter.value;
            if (!matchCode && !matchName) return false;
        }

        if (dateRange.value && dateRange.value[0]) {
            const filterStart = new Date(dateRange.value[0]);
            filterStart.setHours(0, 0, 0, 0);
            const filterEnd = dateRange.value[1] ? new Date(dateRange.value[1]) : new Date(filterStart);
            filterEnd.setHours(23, 59, 59, 999);

            const rStart = new Date(r.start_date || r.startDate);
            const rEnd = new Date(r.end_date || r.endDate || r.start_date || r.startDate);
            if (rEnd < filterStart || rStart > filterEnd) return false;
        }

        if (searchQuery.value.trim()) {
            const q = searchQuery.value.toLowerCase().trim();
            const id = (r.id_request || r.id || '').toLowerCase();
            const name = (r.requester_name || r.userName || '').toLowerCase();
            const nik = (r.namecode || '').toLowerCase();
            return id.includes(q) || name.includes(q) || nik.includes(q);
        }

        return true;
    });
});

function isoDate(d) {
    if (!d) return undefined;
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

defineExpose({
    filteredCount: computed(() => filteredRequests.value.length),
    exportFilters: computed(() => ({
        kd_dept: departmentFilter.value || undefined,
        status: statusFilter.value || undefined,
        kd_leave_type: leaveTypeFilter.value || undefined,
        start_date: isoDate(dateRange.value?.[0]),
        end_date: isoDate(dateRange.value?.[1] || dateRange.value?.[0]),
        search: searchQuery.value.trim() || undefined
    }))
});
</script>
