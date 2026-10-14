<script setup>
import { useRouter } from 'vue-router';
import { Home } from 'lucide-vue-next';

const router = useRouter();
</script>

<template>
    <div class="flex items-center justify-center min-h-[60vh]">
        <div class="text-center">
            <h1 class="text-6xl font-black text-primary mb-2">404</h1>
            <h2 class="text-lg font-bold text-surface-900 dark:text-surface-100 mb-2">Halaman Tidak Ditemukan</h2>
            <p class="text-xs text-muted-color mb-6">Halaman yang Anda cari tidak tersedia atau sedang dalam pengembangan.</p>
            <Button @click="router.push('/')" class="text-xs font-semibold gap-2">
                <Home :size="14" />
                <span>Kembali ke Dashboard</span>
            </Button>
        </div>
    </div>
</template>
