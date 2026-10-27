<script setup>
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

function remaining(b) {
    if (b.remaining !== undefined) return b.remaining;
    return Number(b.annual_quota || 0) + Number(b.carry_over_days || 0) - Number(b.used_days || 0);
}
</script>

<template>
    <div class="card border border-surface-200 dark:border-surface-700 p-4 rounded-xl bg-surface-0 dark:bg-surface-900 shadow-sm">
        <DataTable :value="items" :loading="loading" paginator :rows="10" class="p-datatable-sm text-xs" responsiveLayout="scroll">
            <template #empty>
                <div class="text-center py-8 text-muted-color">Tidak ada data saldo cuti pada periode ini.</div>
            </template>
            <Column header="NIK / ID" style="width: 15%">
                <template #body="{ data }">
                    <span class="font-mono font-bold">{{ data.namecode || '-' }}</span>
                </template>
            </Column>
            <Column header="Nama Karyawan" style="width: 27%">
                <template #body="{ data }">
                    <div class="font-bold text-surface-900 dark:text-surface-100">{{ data.nama }}</div>
                    <div class="text-[11px] text-muted-color">Divisi: {{ data.kd_dept || '-' }}</div>
                </template>
            </Column>
            <Column header="Kuota Tahunan" style="width: 14%">
                <template #body="{ data }">
                    <span class="font-bold">{{ data.annual_quota }}</span> Hari
                </template>
            </Column>
            <Column header="Carry Over" style="width: 14%">
                <template #body="{ data }">
                    <span class="font-bold text-indigo-600 dark:text-indigo-400">{{ data.carry_over_days || 0 }}</span> Hari
                </template>
            </Column>
            <Column header="Digunakan" style="width: 14%">
                <template #body="{ data }">
                    <span class="font-bold text-rose-600 dark:text-rose-400">{{ data.used_days || 0 }}</span> Hari
                </template>
            </Column>
            <Column header="Sisa Saldo" style="width: 16%">
                <template #body="{ data }">
                    <span class="px-2.5 py-1 rounded-full font-black text-xs bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                        {{ remaining(data) }} Hari
                    </span>
                </template>
            </Column>
        </DataTable>
    </div>
</template>
