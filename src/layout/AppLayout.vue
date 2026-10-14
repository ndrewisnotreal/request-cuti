<script setup>
import { useLayout } from '@/layout/composables/layout';
import AppTopbar from './AppTopbar.vue';
import AppMenu from './AppMenu.vue';
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';
import { showSidebar } from '@/layout/composables/sidebarMenu';

const { mobileMenuOpen, closeMobileMenu, isSidebarCollapsed, toggleSidebarCollapse } = useLayout();
</script>

<template>
    <div class="min-h-screen flex flex-col bg-surface-50 dark:bg-surface-950 text-surface-700 dark:text-surface-100 antialiased font-sans">
        <!-- Topbar -->
        <AppTopbar />

        <div class="flex flex-1 w-full">
            <!-- Desktop Collapsible Mini Sidebar -->
            <!-- Tanpa menu yang bisa dibuka (seluruh otorisasi dicabut): cukup Dashboard, tanpa sidebar -->
            <aside
                v-if="showSidebar"
                :class="[
                    'hidden lg:flex flex-col shrink-0 bg-surface-0 dark:bg-surface-900 border-r border-surface-200 dark:border-surface-800 sticky top-16 h-[calc(100vh-4rem)] z-30 select-none transition-all duration-300 ease-in-out relative group/sidebar',
                    isSidebarCollapsed ? 'w-[68px]' : 'w-60'
                ]"
            >
                <!-- Floating Edge Toggle (Notion / Arc style) -->
                <button
                    type="button"
                    class="absolute -right-3 top-5 z-40 w-6 h-6 rounded-full flex items-center justify-center bg-surface-0 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-400 hover:text-primary hover:border-primary/50 dark:hover:border-primary/50 shadow-xs hover:shadow-sm transition-all duration-200 cursor-pointer opacity-70 group-hover/sidebar:opacity-100 hover:!opacity-100 hover:scale-110 active:scale-95"
                    @click="toggleSidebarCollapse"
                    :title="isSidebarCollapsed ? 'Lebarkan bilah samping' : 'Ciutkan bilah samping'"
                    :aria-label="isSidebarCollapsed ? 'Lebarkan bilah samping' : 'Ciutkan bilah samping'"
                >
                    <component
                        :is="isSidebarCollapsed ? ChevronRight : ChevronLeft"
                        :size="13"
                        :stroke-width="2.2"
                    />
                </button>

                <!-- Menu Items Area -->
                <div class="flex-1 overflow-y-auto overflow-x-hidden py-3" :class="isSidebarCollapsed ? 'px-2' : 'px-2.5'">
                    <AppMenu :collapsed="isSidebarCollapsed" />
                </div>
            </aside>

            <!-- Mobile Navigation Drawer -->
            <Drawer v-if="showSidebar" v-model:visible="mobileMenuOpen" header="Menu Navigasi" class="!w-72">
                <div class="h-full flex flex-col overflow-y-auto p-1">
                    <AppMenu :collapsed="false" @item-click="closeMobileMenu" />
                </div>
            </Drawer>

            <!-- Main Content Area -->
            <div class="flex-1 flex flex-col min-w-0 overflow-x-hidden">
                <main class="flex-1 p-4 sm:p-6 lg:p-8 w-full">
                    <router-view />
                </main>
            </div>
        </div>
    </div>

    <Toast />
    <ConfirmDialog />
</template>
