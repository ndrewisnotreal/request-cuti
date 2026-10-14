<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import api, { LOGOUT_NOTICE_KEY } from '@/service/api';
import { login } from '@/service/sicutiService';
import { useLayout } from '@/layout/composables/layout';
import { useToast } from 'primevue/usetoast';
import { User, Lock, LogIn, KeyRound, Sun, Moon, Check, Circle } from 'lucide-vue-next';
import { passwordChecks, passwordProblem } from '@/utils/passwordRules';

const router = useRouter();
const toast = useToast();
const { isDarkTheme, toggleDarkMode } = useLayout();

const identifier = ref('');
const password = ref('');
const errorMessage = ref('');
// Alasan sesi sebelumnya diputus (disimpan api.js sebelum diarahkan ke halaman ini)
try {
    errorMessage.value = sessionStorage.getItem(LOGOUT_NOTICE_KEY) || '';
    sessionStorage.removeItem(LOGOUT_NOTICE_KEY);
} catch {}
const submitting = ref(false);

// Password kedaluwarsa: data dari respons login untuk POST /auth/expired
const expired = ref(null);
const newPassword = ref('');
const confirmPassword = ref('');

async function handleLogin() {
    errorMessage.value = '';
    const cleanId = identifier.value.trim();
    const cleanPass = password.value.trim();

    if (!cleanId || !cleanPass) {
        errorMessage.value = 'ID Karyawan dan Password wajib diisi';
        return;
    }

    submitting.value = true;
    const res = await login(cleanId, cleanPass);
    submitting.value = false;
    if (res.success) {
        sessionStorage.setItem('sct_just_logged_in', 'true');
        sessionStorage.setItem('sct_login_user', JSON.stringify({ name: res.user.name }));
        toast.add({
            severity: 'success',
            summary: 'Login Berhasil',
            detail: `Selamat datang, ${res.user.name}`,
            life: 3000
        });
        await router.push('/');
    } else if (res.code === 'PASSWORD_EXPIRED' && res.data?.Token_login_API) {
        expired.value = { id_user: res.data.id_user, token: res.data.Token_login_API, passwordLama: cleanPass };
        newPassword.value = '';
        confirmPassword.value = '';
    } else {
        errorMessage.value = res.message || 'Login gagal. Periksa ID dan password.';
    }
}

const expiredChecks = computed(() => passwordChecks(newPassword.value));

async function handleExpiredChange() {
    errorMessage.value = '';
    if (!newPassword.value || !confirmPassword.value) {
        errorMessage.value = 'Isi password baru dan ulangi password baru.';
        return;
    }
    if (newPassword.value !== confirmPassword.value) {
        errorMessage.value = 'Ulangi password baru belum sama dengan password baru.';
        return;
    }
    const problem = passwordProblem(newPassword.value);
    if (problem) {
        errorMessage.value = problem;
        return;
    }
    submitting.value = true;
    try {
        await api.post('/auth/expired', {
            id_user: expired.value.id_user,
            password_lama: expired.value.passwordLama,
            password_baru: newPassword.value,
            Token_login_API: expired.value.token
        });
        toast.add({ severity: 'success', summary: 'Password diperbarui', detail: 'Password baru sudah aktif.', life: 3000 });
        const res = await login(identifier.value.trim(), newPassword.value);
        expired.value = null;
        password.value = '';
        if (res.success) {
            sessionStorage.setItem('sct_just_logged_in', 'true');
            sessionStorage.setItem('sct_login_user', JSON.stringify({ name: res.user.name }));
            await router.push('/');
        } else {
            errorMessage.value = 'Password sudah diganti. Silakan masuk dengan password baru.';
        }
    } catch (err) {
        const msg = err.data?.error || err.message || 'Password baru belum bisa disimpan.';
        // Token hangus (password lama salah / lewat 15 menit): kembali ke form login
        if (/token|login ulang/i.test(msg)) cancelExpired(`${msg.replace(/Token_login_API/g, 'sesi')}`);
        else errorMessage.value = msg;
    } finally {
        submitting.value = false;
    }
}

function cancelExpired(message = '') {
    expired.value = null;
    password.value = '';
    errorMessage.value = message;
}
</script>

<template>
    <div class="min-h-screen flex flex-col items-center justify-center p-4 relative bg-surface-50 dark:bg-surface-950 overflow-hidden">
        <!-- Background Image -->
        <div class="absolute inset-0 bg-cover bg-center" style="background-image: url('/assets/Pabrik-INALUM.jpg')"></div>
        <div
            :class="[
                'absolute inset-0 transition-colors duration-500',
                isDarkTheme ? 'bg-black/55 backdrop-blur-[2px]' : 'bg-slate-900/35 backdrop-blur-[2px]'
            ]"
        ></div>

        <!-- Dark / Light Mode Switcher -->
        <div class="absolute top-4 right-4 z-20">
            <button
                type="button"
                @click="toggleDarkMode($event)"
                class="w-9 h-9 rounded-xl flex items-center justify-center bg-white/80 dark:bg-surface-900/80 hover:bg-white dark:hover:bg-surface-800 text-surface-700 dark:text-surface-200 border border-black/5 dark:border-white/10 shadow-sm backdrop-blur-md transition-all duration-200 cursor-pointer"
                :aria-label="isDarkTheme ? 'Beralih ke mode terang' : 'Beralih ke mode gelap'"
                :title="isDarkTheme ? 'Beralih ke mode terang' : 'Beralih ke mode gelap'"
            >
                <Sun v-if="isDarkTheme" :size="18" :stroke-width="1.75" />
                <Moon v-else :size="18" :stroke-width="1.75" />
            </button>
        </div>

        <div class="relative z-10 w-full max-w-md bg-white/95 dark:bg-surface-900/95 rounded-2xl p-6 shadow-2xl border border-white/20 dark:border-surface-800/80 backdrop-blur-sm">
            <!-- Header Brand -->
            <div class="text-center mb-5">
                <img src="/logo-inalum.png" alt="Logo PT INALUM" class="h-16 w-auto object-contain mx-auto mb-3" />
                <h1 class="text-2xl font-black text-primary leading-tight">Lebur</h1>
                <p class="text-[11px] text-muted-color mt-1 tracking-wide">Sistem Manajemen Cuti Digital &bull; PT INALUM</p>
            </div>

            <!-- Error Banner -->
            <div v-if="errorMessage" role="alert" class="mb-4 p-3 rounded-xl text-xs bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-900">
                {{ errorMessage }}
            </div>

            <!-- Password kedaluwarsa: buat password baru -->
            <form v-if="expired" novalidate @submit.prevent="handleExpiredChange" class="space-y-4 text-sm">
                <div class="p-3 rounded-xl text-xs bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-100 dark:border-amber-900">
                    <p class="font-semibold mb-0.5">Password sudah kedaluwarsa</p>
                    <p>Password akun {{ identifier.trim() }} sudah dipakai lebih dari 90 hari. Buat password baru untuk melanjutkan.</p>
                </div>
                <div>
                    <label for="expired-new" class="block font-semibold text-surface-700 dark:text-surface-300 mb-1 text-sm">Password baru</label>
                    <IconField iconPosition="left" class="w-full">
                        <InputIcon>
                            <KeyRound :size="14" :stroke-width="1.75" class="text-muted-color" />
                        </InputIcon>
                        <InputText id="expired-new" v-model="newPassword" type="password" autocomplete="new-password" class="w-full text-xs" />
                    </IconField>
                    <ul class="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-[11px]">
                        <li v-for="c in expiredChecks" :key="c.label" class="flex items-center gap-1.5" :class="c.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-color'">
                            <Check v-if="c.ok" :size="12" />
                            <Circle v-else :size="12" />
                            {{ c.label }}
                        </li>
                    </ul>
                    <p class="text-[11px] text-muted-color mt-1">Tidak boleh sama dengan 3 password terakhir.</p>
                </div>
                <div>
                    <label for="expired-confirm" class="block font-semibold text-surface-700 dark:text-surface-300 mb-1 text-sm">Ulangi password baru</label>
                    <IconField iconPosition="left" class="w-full">
                        <InputIcon>
                            <Lock :size="14" :stroke-width="1.75" class="text-muted-color" />
                        </InputIcon>
                        <InputText id="expired-confirm" v-model="confirmPassword" type="password" autocomplete="new-password" class="w-full text-xs" />
                    </IconField>
                </div>
                <div class="flex gap-2">
                    <Button type="button" label="Batal" severity="secondary" text class="text-xs" @click="cancelExpired()" />
                    <Button type="submit" class="flex-1 justify-center text-xs font-bold gap-2" :loading="submitting">
                        <KeyRound :size="15" />
                        <span>Simpan &amp; Masuk</span>
                    </Button>
                </div>
            </form>

            <!-- Login Form -->
            <form v-else novalidate @submit.prevent="handleLogin" class="space-y-4 text-sm">
                <div>
                    <label for="login-id" class="block font-semibold text-surface-700 dark:text-surface-300 mb-1 text-sm">ID Karyawan / Email</label>
                    <IconField iconPosition="left" class="w-full">
                        <InputIcon>
                            <User :size="14" :stroke-width="1.75" class="text-muted-color" />
                        </InputIcon>
                        <InputText id="login-id" v-model="identifier" type="text" placeholder="NIK atau email" autocomplete="username" class="w-full text-xs" />
                    </IconField>
                </div>

                <div>
                    <div class="flex items-center justify-between mb-1">
                        <label for="login-password" class="block font-semibold text-surface-700 dark:text-surface-300 text-sm">Password</label>
                        <router-link to="/auth/forgot-password" class="text-xs text-primary hover:underline">Lupa Kata Sandi?</router-link>
                    </div>
                    <IconField iconPosition="left" class="w-full">
                        <InputIcon>
                            <Lock :size="14" :stroke-width="1.75" class="text-muted-color" />
                        </InputIcon>
                        <InputText id="login-password" v-model="password" type="password" autocomplete="current-password" class="w-full text-xs" />
                    </IconField>
                </div>

                <Button type="submit" class="w-full justify-center text-xs font-bold gap-2" :loading="submitting">
                    <LogIn :size="15" />
                    <span>Masuk ke Akun</span>
                </Button>
            </form>
        </div>
    </div>
</template>
