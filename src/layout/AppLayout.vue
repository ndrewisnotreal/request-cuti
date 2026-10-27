<script setup>
import { useLayout } from '@/layout/composables/layout';
import AppTopbar from './AppTopbar.vue';
import AppMenu from './AppMenu.vue';
import { showSidebar } from '@/layout/composables/sidebarMenu';

const { mobileMenuOpen, closeMobileMenu, isSidebarCollapsed } = useLayout();
</script>

<template>
    <div class="min-h-screen flex bg-surface-50 dark:bg-surface-950 text-surface-700 dark:text-surface-100 antialiased font-sans">
        <aside
            v-if="showSidebar"
            id="app-sidebar"
            :class="[
                'hidden lg:flex flex-col shrink-0 self-start sticky top-0 h-screen z-30 select-none transition-all duration-300 ease-in-out bg-surface-0 dark:bg-surface-900 rounded-r-2xl border border-l-0 border-surface-200 dark:border-surface-800',
                isSidebarCollapsed ? 'w-[68px]' : 'w-64'
            ]"
        >
            <span
                aria-hidden="true"
                class="absolute -top-px -right-px w-4 h-4 pointer-events-none bg-[image:radial-gradient(circle_at_bottom_left,transparent_16px,var(--p-surface-0)_16.5px)] dark:bg-[image:radial-gradient(circle_at_bottom_left,transparent_16px,var(--p-surface-900)_16.5px)]"
            ></span>

            <router-link
                to="/"
                :title="isSidebarCollapsed ? 'Lebur — PT Indonesia Asahan Aluminium' : undefined"
                :class="['flex items-center h-16 shrink-0 gap-3', isSidebarCollapsed ? 'justify-center' : 'px-4']"
            >
                <img src="/logo-inalum-mark.png" alt="Logo PT INALUM" class="w-8 h-8 object-contain shrink-0" />
                <div v-if="!isSidebarCollapsed" class="flex flex-col min-w-0">
                    <span class="font-bold text-lg leading-tight text-primary">Lebur</span>
                    <span class="text-[11px] text-muted-color whitespace-nowrap truncate">PT Indonesia Asahan Aluminium</span>
                </div>
            </router-link>

            <div class="flex-1 overflow-y-auto overflow-x-hidden scrollbar-none py-3" :class="isSidebarCollapsed ? 'px-2' : 'px-3'">
                <AppMenu :collapsed="isSidebarCollapsed" />
            </div>
        </aside>

        <Drawer v-if="showSidebar" v-model:visible="mobileMenuOpen" header="Menu Navigasi" class="!w-72">
            <div class="h-full flex flex-col overflow-y-auto p-1">
                <AppMenu :collapsed="false" @item-click="closeMobileMenu" />
            </div>
        </Drawer>

        <div class="flex-1 flex flex-col min-w-0 overflow-x-clip">
            <AppTopbar />
            <main class="flex-1 p-4 sm:p-6 lg:p-8 w-full">
                <router-view />
            </main>
        </div>
    </div>

    <Toast />
    <ConfirmDialog />
</template>
