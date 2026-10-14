<script setup>
import { useLayout } from '@/layout/composables/layout';
import { Palette, Moon, Sun, Check } from 'lucide-vue-next';

const {
    configSidebarVisible,
    toggleDarkMode,
    isDarkTheme,
    setPrimaryColor,
    currentPrimaryColor
} = useLayout();

const primaryColors = [
    { name: 'inalum', label: 'Inalum Blue', color: '#0077b8' },
    { name: 'emerald', label: 'Emerald', color: '#10b981' },
    { name: 'indigo', label: 'Indigo', color: '#6366f1' },
    { name: 'amber', label: 'Amber', color: '#f59e0b' },
    { name: 'cyan', label: 'Cyan', color: '#06b6d4' },
    { name: 'rose', label: 'Rose', color: '#f43f5e' }
];
</script>

<template>
    <Drawer
        v-model:visible="configSidebarVisible"
        position="right"
        header="Pengaturan Tema"
        class="!w-80"
    >
        <div class="flex flex-col gap-6 p-2">
            <!-- Mode Tampilan -->
            <div>
                <span class="text-xs font-bold uppercase tracking-wider text-muted-color block mb-3">Mode Tampilan</span>
                <div class="grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        @click="isDarkTheme && toggleDarkMode($event)"
                        :class="[
                            'p-3 rounded-xl border flex flex-col items-center gap-2 transition-all cursor-pointer',
                            !isDarkTheme
                                ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                                : 'border-surface-200 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800'
                        ]"
                    >
                        <Sun :size="20" :stroke-width="1.75" />
                        <span class="text-xs">Terang (Light)</span>
                    </button>
                    <button
                        type="button"
                        @click="!isDarkTheme && toggleDarkMode($event)"
                        :class="[
                            'p-3 rounded-xl border flex flex-col items-center gap-2 transition-all cursor-pointer',
                            isDarkTheme
                                ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                                : 'border-surface-200 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800'
                        ]"
                    >
                        <Moon :size="20" :stroke-width="1.75" />
                        <span class="text-xs">Gelap (Dark)</span>
                    </button>
                </div>
            </div>

            <!-- Palet Warna Primer -->
            <div>
                <span class="text-xs font-bold uppercase tracking-wider text-muted-color block mb-3">Warna Aksen Primer</span>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <button
                        v-for="c in primaryColors"
                        :key="c.name"
                        type="button"
                        @click="setPrimaryColor(c.name)"
                        class="p-2 rounded-lg border border-surface-200 dark:border-surface-700 flex items-center gap-2 transition-all cursor-pointer hover:border-surface-400"
                        :class="currentPrimaryColor === c.name ? 'ring-2 ring-primary ring-offset-2 dark:ring-offset-surface-900 font-bold' : ''"
                    >
                        <span
                            class="w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0 shadow-xs"
                            :style="{ backgroundColor: c.color }"
                        >
                            <Check v-if="currentPrimaryColor === c.name" :size="12" :stroke-width="3" />
                        </span>
                        <span class="text-xs truncate">{{ c.label }}</span>
                    </button>
                </div>
            </div>

            <!-- Informasi Versi -->
            <div class="mt-auto pt-6 border-t border-surface-200 dark:border-surface-800">
                <div class="p-3 rounded-xl bg-surface-100 dark:bg-surface-800 text-xs text-muted-color flex flex-col gap-1">
                    <span class="font-bold text-surface-900 dark:text-surface-100">Lebur v1.0</span>
                    <span>Lebur - PT Indonesia Asahan Aluminium</span>
                    <span class="text-[11px] text-surface-400">Modul Karyawan / User Portal</span>
                </div>
            </div>
        </div>
    </Drawer>
</template>
