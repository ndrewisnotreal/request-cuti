<template>
    <div v-if="calculatedDays > 0" class="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-surface-50 dark:bg-surface-800/80 border border-surface-200 dark:border-surface-700 text-xs">
        <span class="text-surface-700 dark:text-surface-300">
            Durasi Hari Kerja: <strong class="font-bold text-surface-900 dark:text-surface-0">{{ calculatedDays }} hari</strong>
            <span class="text-muted-color ml-1">(Sabtu, Minggu & libur nasional tidak dihitung)</span>
        </span>
        <span v-if="usesQuota" :class="estimatedRemaining < 0 ? 'text-red-600 font-semibold' : 'text-muted-color'">
            Estimasi sisa saldo: <strong :class="estimatedRemaining < 0 ? 'text-red-600' : 'text-surface-900 dark:text-surface-100 font-semibold'">{{ estimatedRemaining }} hari</strong>
        </span>
    </div>
</template>

<script setup>
defineProps({
    calculatedDays: {
        type: Number,
        default: 0
    },
    usesQuota: {
        type: Boolean,
        default: false
    },
    estimatedRemaining: {
        type: Number,
        default: 0
    }
});
</script>
