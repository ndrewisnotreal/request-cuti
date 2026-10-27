<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { currentUser, persistCurrentUser } from '@/service/sicutiService';
import { authService } from '@/service/authService';
import api, { assetUrl } from '@/service/api';
import { useToast } from 'primevue/usetoast';
import { Mail, Save, X } from 'lucide-vue-next';
import { passwordChecks as checkPassword } from '@/utils/passwordRules';
import ProfileAvatarSection from '@/components/user/ProfileAvatarSection.vue';
import ProfilePasswordSection from '@/components/user/ProfilePasswordSection.vue';
const router = useRouter();
const toast = useToast();
const profile = ref(null);
const saving = ref(false);

const form = ref({
    email: '',
    phone: '',
    newPassword: '',
    confirmPassword: '',
    currentPassword: ''
});

const pendingPhoto = ref(null);
const pendingPreview = ref('');
const removePhoto = ref(false);

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

const passwordChecks = computed(() => checkPassword(form.value.newPassword));

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

function onPhotoSelected(file) {
    clearPendingPhoto();
    pendingPhoto.value = file;
    pendingPreview.value = URL.createObjectURL(file);
    removePhoto.value = false;
}

function onCancelPhoto() {
    clearPendingPhoto();
}

function onRemovePhoto() {
    clearPendingPhoto();
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
    if (saving.value) return;
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
    <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto profile-backdrop"
        @click.self="handleClose"
    >

        <div
            class="relative w-full max-w-[580px] max-h-[90vh] flex flex-col rounded-2xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-900 shadow-2xl overflow-hidden text-surface-900 dark:text-surface-0 my-auto animate-scale-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-dialog-title"
        >
            <div class="px-6 py-4 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between bg-surface-50/50 dark:bg-surface-800/30 shrink-0">
                <div>
                    <h1 id="profile-dialog-title" class="text-base font-bold tracking-tight text-surface-900 dark:text-surface-0">
                        Profil &amp; Pengaturan Akun
                    </h1>
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

            <form id="profile-form" class="p-6 overflow-y-auto space-y-5 text-xs flex-1" @submit.prevent="saveChanges">
                <ProfileAvatarSection
                    :name="view.name"
                    :role-name="view.roleName || view.position"
                    :dept-name="view.deptName"
                    :dept-code="view.deptCode"
                    :nip="view.nip"
                    :photo-url="view.photo"
                    :has-saved-photo="view.hasSavedPhoto"
                    :is-pending-photo="Boolean(pendingPhoto)"
                    :user-initials="userInitials"
                    @photo-selected="onPhotoSelected"
                    @remove-photo="onRemovePhoto"
                    @cancel-photo="onCancelPhoto"
                />

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

                <ProfilePasswordSection v-model="form" />
            </form>

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
                    :title="isDirty ? undefined : 'Belum ada perubahan untuk disimpan'"
                >
                    <Save :size="13" />
                    <span>Simpan Perubahan</span>
                </Button>
            </div>
        </div>
    </div>
</template>

<style scoped>
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
