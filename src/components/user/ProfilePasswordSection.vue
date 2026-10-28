<script setup>
import { computed } from 'vue';
import { Lock, Check, Circle, KeyRound } from 'lucide-vue-next';
import { passwordChecks as checkPassword } from '@/utils/passwordRules';

const props = defineProps({
    modelValue: {
        type: Object,
        required: true,
        default: () => ({
            newPassword: '',
            confirmPassword: '',
            currentPassword: ''
        })
    }
});

const emit = defineEmits(['update:modelValue']);

const newPassword = computed({
    get: () => props.modelValue.newPassword || '',
    set: (val) => emit('update:modelValue', { ...props.modelValue, newPassword: val })
});

const confirmPassword = computed({
    get: () => props.modelValue.confirmPassword || '',
    set: (val) => emit('update:modelValue', { ...props.modelValue, confirmPassword: val })
});

const currentPassword = computed({
    get: () => props.modelValue.currentPassword || '',
    set: (val) => emit('update:modelValue', { ...props.modelValue, currentPassword: val })
});

const passwordChecks = computed(() => checkPassword(newPassword.value));
const passwordStarted = computed(() => Boolean(newPassword.value || confirmPassword.value));
const passwordMismatch = computed(() => Boolean(confirmPassword.value) && confirmPassword.value !== newPassword.value);
</script>

<template>
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
                    v-model="newPassword"
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
                    v-model="confirmPassword"
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
                    v-model="currentPassword"
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
</template>
