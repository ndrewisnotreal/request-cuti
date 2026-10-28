<script setup>
import { computed } from 'vue';
import { currentUser, isAdmin, isApprover } from '@/service/sicutiService';
import UserDashboard from '@/components/dashboard/UserDashboard.vue';
import AdminDashboard from '@/components/dashboard/AdminDashboard.vue';
import ApprovalDashboard from '@/components/dashboard/ApprovalDashboard.vue';
import DashboardWelcomeOverlay from '@/components/dashboard/DashboardWelcomeOverlay.vue';

const isAdminRole = computed(() => isAdmin(currentUser.value));
const isApproverRole = computed(() => !isAdminRole.value && isApprover(currentUser.value));
</script>

<template>
    <div class="relative min-h-[60vh]">
        <template v-if="currentUser">
            <AdminDashboard v-if="isAdminRole" />
            <ApprovalDashboard v-else-if="isApproverRole" />
            <UserDashboard v-else />
        </template>
        <DashboardWelcomeOverlay />
    </div>
</template>
