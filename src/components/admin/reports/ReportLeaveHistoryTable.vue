<script setup>
import { formatDate, getStatusSeverity, getStatusLabel } from '@/service/sicutiService';

defineProps({
    items: {
        type: Array,
        default: () => []
    },
    loading: {
        type: Boolean,
        default: false
    }
});
</script>

<template>
    <div class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 shadow-sm">
        <DataTable :value="items" :loading="loading" paginator :rows="10" class="p-datatable-sm text-xs" responsiveLayout="scroll">
            <template #empty>
                <div class="text-center py-8 text-muted-color">Tidak ada data riwayat cuti untuk filter ini.</div>
            </template>
            <Column header="No. Pengajuan" style="width: 14%">
                <template #body="{ data }">
                    <span class="font-mono font-bold text-surface-900 dark:text-surface-100">{{ data.id_request }}</span>
                </template>
            </Column>
            <Column header="Karyawan" style="width: 22%">
                <template #body="{ data }">
                    <div class="font-bold text-surface-900 dark:text-surface-100">{{ data.requester_name }}</div>
                    <div class="text-[11px] text-muted-color">NIK: {{ data.namecode || '-' }} · {{ data.kd_dept || '-' }}</div>
                </template>
            </Column>
            <Column header="Jenis Cuti" style="width: 16%">
                <template #body="{ data }">
                    <span class="font-medium">{{ data.nm_leave_type }}</span>
                </template>
            </Column>
            <Column header="Periode Cuti" style="width: 20%">
                <template #body="{ data }">
                    <div>{{ formatDate(data.start_date) }} s/d {{ formatDate(data.end_date) }}</div>
                    <div class="text-[11px] text-primary font-bold">{{ data.total_days }} Hari Kerja</div>
                </template>
            </Column>
            <Column header="Status" style="width: 14%">
                <template #body="{ data }">
                    <Tag :value="getStatusLabel(data.status)" :severity="getStatusSeverity(data.status)" class="text-[11px]" />
                </template>
            </Column>
            <Column header="Alasan" style="width: 14%">
                <template #body="{ data }">
                    <span class="text-surface-600 dark:text-surface-400 truncate max-w-xs block" :title="data.reason">
                        {{ data.reason || '-' }}
                    </span>
                </template>
            </Column>
        </DataTable>
    </div>
</template>
