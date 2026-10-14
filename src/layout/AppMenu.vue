<script setup>
import { onMounted, onUnmounted, watch } from 'vue';
import { currentUser } from '@/service/sicutiService';
import { authService } from '@/service/authService';
import { sidebarModel } from '@/layout/composables/sidebarMenu';
import { Lock } from 'lucide-vue-next';

const props = defineProps({
    collapsed: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['item-click']);

async function reloadMenu() {
    if (authService.isAuthenticated()) {
        try {
            await authService.getMenu();
        } catch {}
    }
}

function handleVisibilityChange() {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        reloadMenu();
    }
}

onMounted(() => {
    reloadMenu();
    if (typeof window !== 'undefined') {
        window.addEventListener('visibilitychange', handleVisibilityChange);
    }
});

onUnmounted(() => {
    if (typeof window !== 'undefined') {
        window.removeEventListener('visibilitychange', handleVisibilityChange);
    }
});

watch(
    () => [currentUser.value?.id, currentUser.value?.role],
    () => {
        reloadMenu();
    }
);

// Susunan menu dipakai bersama layout (sidebar disembunyikan bila tidak ada menu yang bisa dibuka)
const model = sidebarModel;
</script>

<template>
    <nav class="flex flex-col gap-3">
        <div v-for="(group, gIdx) in model" :key="group.label" class="flex flex-col">
            <!-- Group Header (Expanded) -->
            <div
                v-if="!collapsed"
                class="text-[11px] font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500 px-3 whitespace-nowrap select-none mb-1.5"
            >
                {{ group.label }}
            </div>

            <!-- Divider (Collapsed) -->
            <div
                v-if="collapsed && gIdx > 0"
                class="w-6 border-t border-surface-200 dark:border-surface-800 mx-auto my-2"
            />

            <!-- Items -->
            <div class="flex flex-col gap-1">
                <template v-for="item in group.items" :key="item.to">
                    <!-- Menu tanpa izin: tetap tampil, redup, tidak bisa dibuka -->
                    <div
                        v-if="item.disabled"
                        role="link"
                        aria-disabled="true"
                        :title="`${item.label}: tidak ada izin. Hubungi Super Admin untuk membukanya.`"
                        :class="[
                            collapsed
                                ? 'w-10 h-10 justify-center mx-auto'
                                : 'w-full h-10 px-3 justify-start gap-3',
                            'flex items-center rounded-xl cursor-not-allowed select-none opacity-50 text-surface-500 dark:text-surface-400'
                        ]"
                    >
                        <div class="w-5 h-5 flex items-center justify-center shrink-0">
                            <component :is="item.icon" :size="20" :stroke-width="1.75" class="text-surface-400 dark:text-surface-500" />
                        </div>
                        <template v-if="!collapsed">
                            <span class="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis flex-1">
                                {{ item.label }}
                            </span>
                            <Lock :size="14" :stroke-width="1.75" class="shrink-0" />
                        </template>
                    </div>
                    <router-link
                        v-else
                        :to="item.to"
                        @click="emit('item-click')"
                        :title="collapsed ? item.label : undefined"
                        :class="[
                            collapsed
                                ? 'w-10 h-10 justify-center mx-auto'
                                : 'w-full h-10 px-3 justify-start gap-3',
                            'flex items-center rounded-xl transition-colors cursor-pointer relative group text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-surface-0 hover:bg-surface-100 dark:hover:bg-surface-800'
                        ]"
                        exact-active-class="!bg-primary/10 !text-primary dark:!bg-primary/20 dark:!text-primary-300 font-semibold"
                    >
                        <div class="w-5 h-5 flex items-center justify-center shrink-0">
                            <component
                                :is="item.icon"
                                :size="20"
                                :stroke-width="1.75"
                                class="text-surface-500 dark:text-surface-400 group-hover:text-primary group-[.router-link-exact-active]:!text-primary dark:group-[.router-link-exact-active]:!text-primary-300 transition-colors"
                            />
                        </div>
                    
                        <template v-if="!collapsed">
                            <span class="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis flex-1">
                                {{ item.label }}
                            </span>
                        
                            <!-- Badge (Expanded) -->
                            <span
                                v-if="item.badge"
                                class="px-2 py-0.5 rounded-full text-xs font-bold bg-primary text-white shadow-xs shrink-0"
                            >
                                {{ item.badge }}
                            </span>
                        </template>

                        <!-- Badge Dot Indicator (Collapsed) -->
                        <span
                            v-if="collapsed && item.badge"
                            class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary ring-2 ring-surface-0 dark:ring-surface-900"
                            :title="`${item.badge} aktif`"
                        ></span>
                    </router-link>
                </template>
            </div>
        </div>
    </nav>
</template>
