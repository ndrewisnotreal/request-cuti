<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { currentUser, persistCurrentUser } from '@/service/sicutiService';
import { authService } from '@/service/authService';
import api, { assetUrl } from '@/service/api';
import { useToast } from 'primevue/usetoast';
import { Mail, Save, Camera, Trash2, KeyRound, Check, Circle, X, Lock } from 'lucide-vue-next';
import { passwordChecks as checkPassword } from '@/utils/passwordRules';

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

const router = useRouter();
const toast = useToast();
const profile = ref(null);
const saving = ref(false);
const photoInput = ref(null);

const form = ref({
    email: '',
    phone: '',
    newPassword: '',
    confirmPassword: '',
    currentPassword: ''
});

// Foto baru baru diunggah saat "Simpan perubahan" diklik
const pendingPhoto = ref(null);
const pendingPreview = ref('');
const removePhoto = ref(false);

// Data dari /master/user/profile diutamakan; currentUser (sesi login) sebagai cadangan
const view = computed(() => {
    const p = profile.value || {};
    const u = currentUser.value || {};
    const savedPhoto = assetUrl(p.foto_profil ?? u.foto_profil);
    return {
        name: p.nama || u.name || '-',
        username: p.username || u.username || '-',
        nip: p.nip || p.namecode || u.namecode || '-',
        deptCode: p.kd_dept || u.department || '-',
        deptName: p.nm_dept || u.departmentName || '',
        position: p.position || u.position || '',
        roleName: p.nm_role || u.roleName || u.role || '-',
        email: p.email ?? u.email ?? '',
        phone: p.no_hp ?? u.phone ?? u.no_hp ?? '',
        photo: pendingPreview.value || (removePhoto.value ? null : savedPhoto),
        hasSavedPhoto: Boolean(savedPhoto)
    };
});

const userInitials = computed(() => {
    const name = view.value.name;
    if (!name || name === '-') return 'U';
    return name
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
});

const contactChanged = computed(
    () => form.value.email.trim() !== (view.value.email || '') || form.value.phone.trim() !== (view.value.phone || '')
);
const photoChanged = computed(() => Boolean(pendingPhoto.value) || removePhoto.value);
const passwordStarted = computed(() => Boolean(form.value.newPassword || form.value.confirmPassword));
const isDirty = computed(() => contactChanged.value || photoChanged.value || passwordStarted.value);

// Sama dengan aturan backend (assertPasswordStrength)
const passwordChecks = computed(() => checkPassword(form.value.newPassword));
const passwordMismatch = computed(() => Boolean(form.value.confirmPassword) && form.value.confirmPassword !== form.value.newPassword);

async function loadProfile() {
    try {
        const res = await api.get('/master/user/profile');
        profile.value = res?.data || null;
    } catch {
        profile.value = null;
    }
}

function resetForm() {
    form.value = {
        email: view.value.email || '',
        phone: view.value.phone || '',
        newPassword: '',
        confirmPassword: '',
        currentPassword: ''
    };
}

function cancelChanges() {
    clearPendingPhoto();
    removePhoto.value = false;
    resetForm();
}

function handleClose() {
    cancelChanges();
    if (window.history.state?.back) {
        router.back();
    } else {
        router.push('/');
    }
}

function handleKeyDown(event) {
    if (event.key === 'Escape') {
        handleClose();
    }
}

function clearPendingPhoto() {
    if (pendingPreview.value) URL.revokeObjectURL(pendingPreview.value);
    pendingPhoto.value = null;
    pendingPreview.value = '';
}

function pickPhoto() {
    photoInput.value?.click();
}

function onPhotoSelected(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) {
        toast.add({ severity: 'warn', summary: 'Format foto tidak didukung', detail: 'Pilih foto JPG, PNG, atau WEBP.', life: 3500 });
        return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
        toast.add({ severity: 'warn', summary: 'Foto terlalu besar', detail: 'Ukuran foto maksimal 2 MB.', life: 3500 });
        return;
    }
    clearPendingPhoto();
    pendingPhoto.value = file;
    pendingPreview.value = URL.createObjectURL(file);
    removePhoto.value = false;
}

function onRemovePhoto() {
    if (pendingPhoto.value) {
        clearPendingPhoto();
        return;
    }
    removePhoto.value = true;
}

function syncSessionUser() {
    if (!currentUser.value || !profile.value) return;
    const p = profile.value;
    Object.assign(currentUser.value, { email: p.email || '', phone: p.no_hp || '', no_hp: p.no_hp || '', foto_profil: p.foto_profil || null });
    persistCurrentUser();
}

function validate() {
    if (!form.value.email.trim()) return 'Isi alamat email untuk menerima notifikasi cuti.';
    if (passwordStarted.value) {
        const failed = passwordChecks.value.find((c) => !c.ok);
        if (failed) return `Kata sandi baru belum memenuhi syarat: ${failed.label.toLowerCase()}.`;
        if (form.value.newPassword !== form.value.confirmPassword) return 'Konfirmasi kata sandi tidak sama dengan kata sandi baru.';
        if (!form.value.currentPassword) return 'Isi kata sandi saat ini untuk mengganti kata sandi.';
    }
    return null;
}

async function saveChanges() {
    const problem = validate();
    if (problem) {
        toast.add({ severity: 'warn', summary: 'Periksa kembali isian', detail: problem, life: 4000 });
        return;
    }

    saving.value = true;
    try {
        if (contactChanged.value) {
            const res = await api.put('/master/user/profile', { email: form.value.email.trim(), no_hp: form.value.phone.trim() });
            profile.value = res?.data || profile.value;
        }
        if (pendingPhoto.value) {
            const fd = new FormData();
            fd.append('file', pendingPhoto.value);
            const res = await api.upload('/master/user/profile/photo', fd);
            profile.value = res?.data || profile.value;
            clearPendingPhoto();
        } else if (removePhoto.value) {
            const res = await api.delete('/master/user/profile/photo', {});
            profile.value = res?.data || profile.value;
            removePhoto.value = false;
        }
        if (passwordStarted.value) {
            await authService.changePassword({
                current_password: form.value.currentPassword,
                new_password: form.value.newPassword,
                confirm_password: form.value.confirmPassword
            });
        }
        syncSessionUser();
        resetForm();
        toast.add({ severity: 'success', summary: 'Perubahan disimpan', detail: 'Profil Anda sudah diperbarui.', life: 3000 });
    } catch (err) {
        syncSessionUser();
        toast.add({ severity: 'error', summary: 'Perubahan gagal disimpan', detail: err.message || 'Coba lagi beberapa saat.', life: 4500 });
    } finally {
        saving.value = false;
    }
}

onMounted(async () => {
    await loadProfile();
    syncSessionUser();
    resetForm();
    window.addEventListener('keydown', handleKeyDown);
});

onBeforeUnmount(() => {
    clearPendingPhoto();
    window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
    <!-- Overlay Melayang Bergaya Khas Apple (Material Vibrancy Scrim) -->
    <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto profile-backdrop"
        @click.self="handleClose"
    >
        <!-- Input foto tersembunyi -->
        <input ref="photoInput" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" @change="onPhotoSelected" />

        <!-- Kartu Modal Konsep 1 (Max 580px) -->
        <div
            class="relative w-full max-w-[580px] max-h-[90vh] flex flex-col rounded-2xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-900 shadow-2xl overflow-hidden text-surface-900 dark:text-surface-0 my-auto animate-scale-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-dialog-title"
        >
            <!-- Header Modal -->
            <div class="px-6 py-4 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between bg-surface-50/50 dark:bg-surface-800/30 shrink-0">
                <div>
                    <h2 id="profile-dialog-title" class="text-base font-bold tracking-tight text-surface-900 dark:text-surface-0">
                        Profil &amp; Pengaturan Akun
                    </h2>
                    <p class="text-xs text-muted-color mt-0.5">
                        Data kepegawaian resmi dan konfigurasi akun portal SiCuti.
                    </p>
                </div>
                <button
                    type="button"
                    class="rounded-lg p-1.5 text-muted-color hover:text-surface-900 dark:hover:text-surface-0 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer"
                    title="Tutup (ESC)"
                    aria-label="Tutup dialog profil"
                    @click="handleClose"
                >
                    <X :size="18" />
                </button>
            </div>

            <!-- Body Modal (Scrollable) -->
            <form id="profile-form" class="p-6 overflow-y-auto space-y-5 text-xs flex-1" @submit.prevent="saveChanges">
                <!-- Identitas Pegawai Ringkas (Status Pegawai Dihapus) -->
                <div class="p-4 rounded-xl bg-surface-50 dark:bg-surface-800/40 border border-surface-200 dark:border-surface-700 flex items-center gap-4">
                    <!-- Avatar dengan tombol kamera ganti foto -->
                    <div class="relative rounded-2xl bg-surface-100 dark:bg-surface-800 p-1 border border-surface-200 dark:border-surface-700 shadow-sm flex items-center justify-center shrink-0 size-16">
                        <img v-if="view.photo" :src="view.photo" :alt="`Foto profil ${view.name}`" class="size-full rounded-xl object-cover" />
                        <div
                            v-else
                            class="size-full rounded-xl bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300 text-xl font-extrabold flex items-center justify-center select-none"
                        >
                            {{ userInitials }}
                        </div>
                        <button
                            type="button"
                            class="absolute -bottom-1 -right-1 size-[22px] rounded-full bg-primary text-primary-contrast shadow flex items-center justify-center hover:bg-primary-emphasis transition-colors cursor-pointer"
                            aria-label="Ganti foto profil"
                            title="Ganti foto profil (JPG, PNG, atau WEBP maks 2 MB)"
                            @click="pickPhoto"
                        >
                            <Camera :size="11" />
                        </button>
                    </div>

                    <!-- Info Pegawai: Nama, Role, Unit SIT/SIS, NIP murni -->
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2">
                            <span class="text-base font-bold text-surface-900 dark:text-surface-0 truncate">{{ view.name }}</span>
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 shrink-0">
                                {{ view.roleName || view.position || 'Staff IT' }}
                            </span>
                        </div>
                        <p class="text-xs text-muted-color mt-0.5 truncate">
                            {{ view.deptName || 'Smelter Information Technology' }} &bull; Seksi {{ view.deptCode || 'SIT' }}
                        </p>
                        <div class="flex items-center gap-3 mt-1.5 text-[11px] text-muted-color">
                            <span>NIP: <strong class="font-mono text-surface-800 dark:text-surface-200">{{ view.nip }}</strong></span>
                        </div>

                        <!-- Aksi batalkan / hapus foto jika ada foto -->
                        <div v-if="view.photo" class="mt-1.5">
                            <button
                                type="button"
                                class="text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:underline inline-flex items-center gap-1 cursor-pointer transition-colors"
                                @click="onRemovePhoto"
                            >
                                <Trash2 :size="12" />
                                <span>{{ pendingPhoto ? 'Batalkan foto baru' : 'Hapus foto profil' }}</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Section Kontak Notifikasi -->
                <div class="space-y-3 pt-1">
                    <h3 class="text-xs font-bold text-surface-900 dark:text-surface-100 uppercase tracking-wider flex items-center gap-1.5">
                        <Mail :size="14" class="text-primary" />
                        <span>Kontak Notifikasi</span>
                    </h3>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                            <label for="profile-email" class="block font-medium text-surface-700 dark:text-surface-300 mb-1">
                                Email Kantor <span class="text-rose-500">*</span>
                            </label>
                            <InputText
                                id="profile-email"
                                v-model="form.email"
                                type="email"
                                placeholder="nama@inalum.co.id"
                                class="w-full text-xs"
                                required
                            />
                        </div>
                        <div>
                            <label for="profile-phone" class="block font-medium text-surface-700 dark:text-surface-300 mb-1">
                                Nomor WhatsApp / HP
                            </label>
                            <InputText
                                id="profile-phone"
                                v-model="form.phone"
                                type="tel"
                                placeholder="081234567890"
                                class="w-full text-xs"
                            />
                        </div>
                    </div>
                </div>

                <!-- Section Keamanan Kata Sandi -->
                <div class="space-y-3 pt-2 border-t border-surface-100 dark:border-surface-800">
                    <h3 class="text-xs font-bold text-surface-900 dark:text-surface-100 uppercase tracking-wider flex items-center gap-1.5">
                        <Lock :size="14" class="text-primary" />
                        <span>Ubah Kata Sandi (Opsional)</span>
                    </h3>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                            <label for="profile-new-password" class="block font-medium text-surface-700 dark:text-surface-300 mb-1">
                                Kata Sandi Baru
                            </label>
                            <Password
                                v-model="form.newPassword"
                                inputId="profile-new-password"
                                :feedback="false"
                                toggleMask
                                fluid
                                autocomplete="new-password"
                                placeholder="Kata sandi baru"
                                class="text-xs"
                            />
                        </div>
                        <div>
                            <label for="profile-confirm-password" class="block font-medium text-surface-700 dark:text-surface-300 mb-1">
                                Konfirmasi Kata Sandi Baru
                            </label>
                            <Password
                                v-model="form.confirmPassword"
                                inputId="profile-confirm-password"
                                :feedback="false"
                                toggleMask
                                fluid
                                autocomplete="new-password"
                                placeholder="Ulangi kata sandi baru"
                                :invalid="passwordMismatch"
                                class="text-xs"
                            />
                            <p v-if="passwordMismatch" class="text-[11px] text-rose-600 dark:text-rose-400 mt-1">
                                Belum sama dengan kata sandi baru.
                            </p>
                        </div>
                    </div>

                    <!-- Syarat kata sandi & kata sandi saat ini muncul saat mulai mengetik kata sandi baru -->
                    <template v-if="passwordStarted">
                        <ul class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                            <li
                                v-for="c in passwordChecks"
                                :key="c.label"
                                class="flex items-center gap-1.5"
                                :class="c.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-color'"
                            >
                                <Check v-if="c.ok" :size="13" />
                                <Circle v-else :size="13" />
                                {{ c.label }}
                            </li>
                        </ul>
                        <div class="sm:max-w-[calc(50%-0.375rem)] pt-1">
                            <label for="profile-current-password" class="block font-medium text-surface-700 dark:text-surface-300 mb-1">
                                Kata Sandi Saat Ini <span class="text-rose-500">*</span>
                            </label>
                            <Password
                                v-model="form.currentPassword"
                                inputId="profile-current-password"
                                :feedback="false"
                                toggleMask
                                fluid
                                autocomplete="current-password"
                                placeholder="Untuk konfirmasi"
                                class="text-xs"
                            />
                            <p class="text-[10px] text-muted-color mt-1 flex items-center gap-1">
                                <KeyRound :size="11" />
                                Verifikasi identitas Anda untuk mengganti kata sandi.
                            </p>
                        </div>
                    </template>
                    <p v-else class="text-[11px] text-muted-color">
                        Minimal 8 karakter dengan kombinasi huruf besar, angka, dan simbol.
                    </p>
                </div>
            </form>

            <!-- Footer Modal (Bersih: Teks ESC Dihapus, Tombol Rata Kanan) -->
            <div class="px-6 py-3.5 border-t border-surface-200 dark:border-surface-800 flex items-center justify-end gap-2 bg-surface-50/50 dark:bg-surface-800/30 shrink-0">
                <Button
                    type="button"
                    severity="secondary"
                    outlined
                    size="small"
                    class="font-semibold text-xs"
                    @click="handleClose"
                >
                    Batal
                </Button>
                <Button
                    type="submit"
                    form="profile-form"
                    size="small"
                    class="font-semibold text-xs flex items-center gap-1.5"
                    :loading="saving"
                    :disabled="!isDirty"
                >
                    <Save :size="13" />
                    <span>Simpan Perubahan</span>
                </Button>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Apple-style Materials & Vibrancy Scrim */
.profile-backdrop {
    background-color: rgba(15, 23, 42, 0.32);
    backdrop-filter: blur(16px) saturate(190%);
    -webkit-backdrop-filter: blur(16px) saturate(190%);
}

@keyframes modalScaleIn {
    from {
        opacity: 0;
        transform: scale(0.96) translateY(6px);
    }
    to {
        opacity: 1;
        transform: scale(1) translateY(0);
    }
}

.animate-scale-in {
    animation: modalScaleIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>
