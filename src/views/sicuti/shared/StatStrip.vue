<script setup>
// Ringkasan angka dalam format kartu terpisah (dashboard, saldo, approval).
// item: { label, value, unit?, hint?, accent?, progress? (0-100) }
defineProps({
    items: { type: Array, required: true }
});
</script>

<template>
    <div
        class="grid gap-3.5 sm:gap-4"
        :class="items.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2 lg:grid-cols-4'"
    >
        <div
            v-for="item in items"
            :key="item.label"
            class="group relative min-w-0 bg-surface-0 dark:bg-surface-900 border border-surface-200/80 dark:border-surface-800 rounded-2xl p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.02)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.03)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06),0_12px_24px_rgba(0,0,0,0.03)] hover:border-surface-300 dark:hover:border-surface-700"
        >
            <!-- Label & Icon / Badge -->
            <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-medium text-surface-500 dark:text-surface-400 truncate">
                    {{ item.label }}
                </span>
                <div
                    v-if="item.icon"
                    class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105"
                    :class="item.accent ? 'bg-primary/10 text-primary' : 'bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400'"
                >
                    <component :is="item.icon" :size="16" :stroke-width="1.75" />
                </div>
                <span
                    v-else-if="item.badge"
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20"
                >
                    {{ item.badge }}
                </span>
            </div>

            <!-- Value & Unit: Angka highlight seperti 12 hari berwarna text-primary -->
            <div class="mt-2.5 flex items-baseline gap-1.5">
                <span
                    class="text-2xl sm:text-3xl font-bold tabular-nums tracking-tight transition-colors"
                    :class="item.accent ? 'text-primary' : 'text-surface-900 dark:text-surface-50'"
                >
                    {{ item.value }}
                </span>
                <span
                    v-if="item.unit"
                    class="text-xs font-semibold transition-colors"
                    :class="item.accent ? 'text-primary' : 'text-surface-500 dark:text-surface-400'"
                >
                    {{ item.unit }}
                </span>
            </div>

            <!-- Progress Bar (jika ada) -->
            <div
                v-if="item.progress !== undefined"
                class="mt-3.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800"
                role="progressbar"
                :aria-valuenow="item.progress"
                aria-valuemin="0"
                aria-valuemax="100"
            >
                <div
                    class="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                    :style="{ width: `${item.progress}%` }"
                ></div>
            </div>

            <!-- Hint Description -->
            <div v-if="item.hint" class="mt-2 text-xs leading-relaxed text-surface-500 dark:text-surface-400 font-normal">
                {{ item.hint }}
            </div>
        </div>
    </div>
</template>
