<script setup>
import { ref, computed, watch } from 'vue';
import { adminService } from '@/service/adminService';
import { useToast } from 'primevue/usetoast';
import { passwordChecks, passwordProblem } from '@/utils/passwordRules';
import { KeyRound, Check, X } from 'lucide-vue-next';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    user: {
        type: Object,
        default: null
    }
});

const emit = defineEmits(['update:visible', 'saved']);
const toast = useToast();

const newPassword = ref('');
const confirmPassword = ref('');
const saving = ref(false);
const errorMsg = ref('');

const checks = computed(() => passwordChecks(newPassword.value));
const isPasswordValid = computed(() => !passwordProblem(newPassword.value));
const isMatch = computed(() => newPassword.value && newPassword.value === confirmPassword.value);

watch(
    () => props.visible,
    (val) => {
        if (val) {
            newPassword.value = '';
            confirmPassword.value = '';
            errorMsg.value = '';
        }
    }
);

function close() {
    emit('update:visible', false);
}

async function handleReset() {
    errorMsg.value = '';
    const problem = passwordProblem(newPassword.value);
    if (problem) {
        errorMsg.value = problem;
        return;
    }
    if (newPassword.value !== confirmPassword.value) {
        errorMsg.value = 'Konfirmasi kata sandi tidak cocok.';
        return;
    }
    if (!props.user?.uid_user_system) {
        errorMsg.value = 'Data pengguna tidak valid.';
        return;
    }

    saving.value = true;
    try {
        await adminService.updateUser({
            uid_user_system: props.user.uid_user_system,
            password: newPassword.value
        });
        toast.add({
            severity: 'success',
            summary: 'Kata Sandi Diperbarui',
            detail: `Kata sandi untuk ${props.user.nama || props.user.username} berhasil diatur ulang`,
            life: 3000
        });
        emit('saved');
        close();
    } catch (err) {
        errorMsg.value = err.message || 'Gagal mengatur ulang kata sandi';
        toast.add({
            severity: 'error',
            summary: 'Gagal',
            detail: errorMsg.value,
            life: 3000
        });
    } finally {
        saving.value = false;
    }
}
</script>

<template>
    <Dialog
        :visible="visible"
        modal
        header="Atur Ulang Kata Sandi"
        :style="{ width: '420px' }"
        :breakpoints="{ '640px': '92vw' }"
        @update:visible="emit('update:visible', $event)"
    >
        <div class="space-y-4 pt-1 text-xs">
            <p class="text-surface-600 dark:text-surface-400">
                Atur kata sandi baru untuk pengguna
                <strong class="text-surface-900 dark:text-surface-100 font-semibold">
                    {{ user?.nama || user?.username }}
                </strong>
                ({{ user?.namecode || user?.username }}).
            </p>

            <div class="space-y-1.5">
                <label class="block font-medium text-surface-700 dark:text-surface-200">
                    Kata Sandi Baru <span class="text-rose-500">*</span>
                </label>
                <InputText
                    v-model="newPassword"
                    type="password"
                    class="w-full text-xs"
                    placeholder="Masukkan kata sandi baru"
                />
            </div>

            <div class="space-y-1.5">
                <label class="block font-medium text-surface-700 dark:text-surface-200">
                    Konfirmasi Kata Sandi Baru <span class="text-rose-500">*</span>
                </label>
                <InputText
                    v-model="confirmPassword"
                    type="password"
                    class="w-full text-xs"
                    placeholder="Ulangi kata sandi baru"
                />
                <p v-if="confirmPassword && !isMatch" class="text-rose-500 text-[11px]">
                    Konfirmasi kata sandi tidak cocok.
                </p>
            </div>

            <div class="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50 border border-surface-200/60 dark:border-surface-700/60 space-y-1.5">
                <div class="text-[11px] font-semibold text-surface-700 dark:text-surface-300">
                    Syarat Keamanan Kata Sandi:
                </div>
                <div class="grid grid-cols-2 gap-1 text-[11px]">
                    <div
                        v-for="(c, idx) in checks"
                        :key="idx"
                        class="flex items-center gap-1.5"
                        :class="c.ok ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-surface-400 dark:text-surface-500'"
                    >
                        <Check v-if="c.ok" :size="12" class="stroke-[3]" />
                        <X v-else :size="12" />
                        <span>{{ c.label }}</span>
                    </div>
                </div>
            </div>

            <div v-if="errorMsg" class="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs">
                {{ errorMsg }}
            </div>
        </div>

        <template #footer>
            <div class="flex justify-end gap-2 pt-2">
                <Button
                    label="Batal"
                    severity="secondary"
                    size="small"
                    text
                    @click="close"
                />
                <Button
                    label="Simpan Kata Sandi"
                    severity="primary"
                    size="small"
                    class="font-semibold"
                    :loading="saving"
                    :disabled="!isPasswordValid || !isMatch"
                    @click="handleReset"
                />
            </div>
        </template>
    </Dialog>
</template>
