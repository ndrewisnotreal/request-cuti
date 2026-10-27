<script setup>
import { publicPath } from '@/utils/publicPath';
import { ArrowLeft, ShieldQuestion } from 'lucide-vue-next';
</script>

<template>
    <div class="min-h-screen flex flex-col items-center justify-center p-4 relative bg-surface-950">
        <div class="absolute inset-0 bg-cover bg-center" :style="{ backgroundImage: `url('${publicPath('assets/Pabrik-INALUM.jpg')}')` }"></div>
        <div class="absolute inset-0 bg-black/50 backdrop-blur-[2px]"></div>

        <div class="relative z-10 w-full max-w-md bg-white/95 dark:bg-surface-900/95 rounded-2xl p-6 shadow-2xl border border-white/20 backdrop-blur-sm">
            <div class="text-center mb-5">
                <img :src="publicPath('logo-inalum.png')" alt="Logo PT INALUM" class="h-16 w-auto object-contain mx-auto mb-3" />
                <h1 class="text-2xl font-black text-primary leading-tight">Lebur</h1>
                <p class="text-[11px] text-muted-color mt-1 tracking-wide">Pemulihan Akun &bull; PT INALUM</p>
            </div>

            <div class="mb-4 text-center">
                <div class="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
                    <ShieldQuestion :size="20" />
                </div>
                <h2 class="text-base font-bold text-surface-900 dark:text-surface-100">Lupa Kata Sandi?</h2>
            </div>

            <div class="space-y-3 text-xs text-surface-700 dark:text-surface-200 leading-relaxed">
                <p>Kata sandi tidak bisa diatur ulang sendiri dari halaman ini. Hubungi admin untuk mendapatkan kata sandi baru:</p>
                <ul class="list-disc pl-5 space-y-1">
                    <li><strong>Admin Seksi</strong> di divisi Anda (SIT atau SIS), atau</li>
                    <li><strong>Admin Super App</strong> bila admin seksi tidak tersedia.</li>
                </ul>
                <p>Sebutkan NIK atau username Anda. Setelah masuk dengan kata sandi dari admin, Anda bisa menggantinya lewat menu profil &rarr; <strong>Ubah Kata Sandi</strong>.</p>
                <p class="text-muted-color">Akun terkunci karena salah kata sandi berkali-kali juga dibuka oleh admin.</p>
            </div>

            <div class="pt-5 text-center">
                <router-link to="/auth/login" class="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline">
                    <ArrowLeft :size="13" />
                    <span>Kembali ke Halaman Login</span>
                </router-link>
            </div>
        </div>
    </div>
</template>
