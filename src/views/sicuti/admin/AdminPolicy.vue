<script setup>
import { ref, computed, onMounted } from 'vue';
import { adminService } from '@/service/adminService';
import { isSuperAdmin, can, syncFromBackend } from '@/service/sicutiService';
import { useToast } from 'primevue/usetoast';
import { Settings2, Save, Lock } from 'lucide-vue-next';
import ReadOnlyNotice from '../shared/ReadOnlyNotice.vue';

const toast = useToast();
const loading = ref(false);
const saving = ref(false);
const saved = ref(null);
const form = ref({ annual_quota: null, max_carry_over: null, carry_over_expiry_months: null, description: '' });

// Prototype: Admin Seksi hanya melihat, kecuali diberi izin manage_policy
const canManage = computed(() => isSuperAdmin() || can('master_data.manage_policy'));
const isDirty = computed(() => saved.value !== null && JSON.stringify(form.value) !== JSON.stringify(saved.value));

function fromPolicy(p) {
    return {
        annual_quota: p?.annual_quota == null ? null : Number(p.annual_quota),
        max_carry_over: p?.max_carry_over == null ? null : Number(p.max_carry_over),
        carry_over_expiry_months: p?.carry_over_expiry_months == null ? null : Number(p.carry_over_expiry_months),
        description: p?.description || ''
    };
}

async function load() {
    loading.value = true;
    try {
        const res = await adminService.getPolicy();
        form.value = fromPolicy(res?.data ?? res);
        saved.value = { ...form.value };
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Kebijakan gagal dimuat', detail: err.message, life: 4000 });
    } finally {
        loading.value = false;
    }
}

async function save() {
    saving.value = true;
    try {
        const res = await adminService.updatePolicy({ ...form.value });
        form.value = fromPolicy(res?.data ?? res);
        saved.value = { ...form.value };
        await syncFromBackend();
        toast.add({ severity: 'success', summary: 'Kebijakan disimpan', detail: 'Kebijakan cuti sudah diperbarui.', life: 3000 });
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Kebijakan gagal disimpan', detail: err.message, life: 4000 });
    } finally {
        saving.value = false;
    }
}

onMounted(load);
</script>

<template>
    <div class="space-y-6 max-w-3xl">
        <ReadOnlyNotice v-if="!canManage" module="kebijakan cuti" />
        <div>
            <h2 class="text-xl font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                <Settings2 class="text-primary w-5 h-5" />
                <span>Master Kebijakan Cuti</span>
            </h2>
            <p class="text-xs text-muted-color">Kuota tahunan dan aturan carry over yang berlaku untuk semua karyawan.</p>
        </div>

        <form class="card !p-0 border border-surface-200 dark:border-surface-700 rounded-xl bg-surface-0 dark:bg-surface-900 shadow-sm" @submit.prevent="save">
            <div
                v-if="!canManage"
                class="flex items-center gap-2 px-6 py-3 border-b border-surface-200 dark:border-surface-700 text-sm text-surface-600 dark:text-surface-300 bg-surface-50 dark:bg-surface-800/50 rounded-t-xl"
            >
                <Lock :size="15" class="shrink-0" />
                Anda hanya dapat melihat kebijakan. Perubahan dilakukan oleh Admin Super App.
            </div>

            <div class="p-6 grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div>
                    <label for="policy-quota" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Kuota tahunan</label>
                    <InputGroup>
                        <InputNumber v-model="form.annual_quota" inputId="policy-quota" :min="1" :max="365" :disabled="!canManage || loading" fluid />
                        <InputGroupAddon>hari</InputGroupAddon>
                    </InputGroup>
                </div>
                <div>
                    <label for="policy-carry" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Maks carry over</label>
                    <InputGroup>
                        <InputNumber v-model="form.max_carry_over" inputId="policy-carry" :min="0" :max="365" :disabled="!canManage || loading" fluid />
                        <InputGroupAddon>hari</InputGroupAddon>
                    </InputGroup>
                </div>
                <div>
                    <label for="policy-expiry" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Masa berlaku carry over</label>
                    <InputGroup>
                        <InputNumber v-model="form.carry_over_expiry_months" inputId="policy-expiry" :min="0" :max="24" :disabled="!canManage || loading" fluid />
                        <InputGroupAddon>bulan</InputGroupAddon>
                    </InputGroup>
                </div>
                <div class="sm:col-span-3">
                    <label for="policy-desc" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Deskripsi</label>
                    <Textarea id="policy-desc" v-model="form.description" rows="3" autoResize class="w-full" :disabled="!canManage || loading" />
                </div>
            </div>

            <div v-if="canManage" class="px-6 py-4 flex items-center justify-end gap-3 border-t border-surface-100 dark:border-surface-800 bg-surface-50/60 dark:bg-surface-800/30 rounded-b-xl">
                <span v-if="isDirty" class="text-xs text-muted-color">Ada perubahan yang belum disimpan</span>
                <Button type="submit" size="small" class="font-semibold flex items-center gap-1.5" :loading="saving" :disabled="!isDirty">
                    <Save :size="15" />
                    <span>Simpan Perubahan</span>
                </Button>
            </div>
        </form>
    </div>
</template>
