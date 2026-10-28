<script setup>
import { Eye } from 'lucide-vue-next';

defineProps({
    module: { type: String, default: 'data ini' }
});
</script>

<template>
    <div role="status" class="p-3 rounded-xl border text-xs flex items-start gap-2.5 bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-100">
        <Eye :size="16" class="mt-0.5 shrink-0" />
        <p class="leading-relaxed">
            <strong class="font-semibold">Mode lihat saja.</strong>
            Anda bisa melihat {{ module }}, tetapi belum diberi izin oleh Super Admin untuk menambah, mengubah, atau menghapusnya.
            Hubungi Super Admin bila perlu akses ubah.
        </p>
    </div>
</template>
