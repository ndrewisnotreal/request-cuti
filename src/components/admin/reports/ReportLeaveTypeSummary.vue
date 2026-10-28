<script setup>
import { computed } from 'vue';

const props = defineProps({
    items: {
        type: Array,
        default: () => []
    },
    loading: {
        type: Boolean,
        default: false
    }
});

const summaryTotals = computed(() =>
    props.items.reduce(
        (acc, r) => ({
            total: acc.total + Number(r.total || 0),
            approved: acc.approved + Number(r.approved || 0),
            days: acc.days + Number(r.approved_days || 0)
        }),
        { total: 0, approved: 0, days: 0 }
    )
);

const maxSummary = computed(() => Math.max(1, ...props.items.map((r) => Number(r.total || 0))));
</script>

<template>
    <div class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 shadow-sm space-y-4">
        <dl class="grid grid-cols-3 gap-3 text-center text-xs">
            <div class="rounded-lg bg-surface-50 dark:bg-surface-800 p-3">
                <dt class="text-muted-color">Total pengajuan</dt>
                <dd class="text-xl font-bold tabular-nums">{{ summaryTotals.total }}</dd>
            </div>
            <div class="rounded-lg bg-surface-50 dark:bg-surface-800 p-3">
                <dt class="text-muted-color">Disetujui</dt>
                <dd class="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{{ summaryTotals.approved }}</dd>
            </div>
            <div class="rounded-lg bg-surface-50 dark:bg-surface-800 p-3">
                <dt class="text-muted-color">Hari cuti disetujui</dt>
                <dd class="text-xl font-bold tabular-nums">{{ summaryTotals.days }}</dd>
            </div>
        </dl>
        <DataTable :value="items" :loading="loading" class="p-datatable-sm text-xs" responsiveLayout="scroll">
            <template #empty>
                <div class="text-center py-8 text-muted-color">Belum ada jenis cuti.</div>
            </template>
            <Column header="Jenis Cuti" style="width: 26%">
                <template #body="{ data }">
                    <div class="font-semibold text-surface-900 dark:text-surface-100">{{ data.nm_leave_type }}</div>
                    <div class="h-1.5 mt-1 rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden" aria-hidden="true">
                        <div class="h-full bg-primary rounded-full" :style="{ width: `${(Number(data.total || 0) / maxSummary) * 100}%` }" />
                    </div>
                </template>
            </Column>
            <Column header="Pengajuan" style="width: 12%">
                <template #body="{ data }"><span class="tabular-nums font-bold">{{ data.total }}</span></template>
            </Column>
            <Column header="Disetujui" style="width: 12%">
                <template #body="{ data }"><span class="tabular-nums text-emerald-600 dark:text-emerald-400">{{ data.approved }}</span></template>
            </Column>
            <Column header="Ditolak" style="width: 12%">
                <template #body="{ data }"><span class="tabular-nums text-rose-600 dark:text-rose-400">{{ data.rejected }}</span></template>
            </Column>
            <Column header="Dibatalkan" style="width: 12%">
                <template #body="{ data }"><span class="tabular-nums">{{ data.cancelled }}</span></template>
            </Column>
            <Column header="Dalam Proses" style="width: 12%">
                <template #body="{ data }"><span class="tabular-nums text-amber-700 dark:text-amber-300">{{ data.pending }}</span></template>
            </Column>
            <Column header="Hari Disetujui" style="width: 14%">
                <template #body="{ data }"><span class="tabular-nums font-bold">{{ data.approved_days }}</span></template>
            </Column>
        </DataTable>
    </div>
</template>
