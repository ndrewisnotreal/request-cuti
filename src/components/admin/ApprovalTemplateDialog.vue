<template>
    <Dialog
        :visible="visible"
        modal
        :header="isEditing ? 'Ubah Templat Approval' : 'Buat Templat Approval Baru'"
        :style="{ width: '480px' }"
        :breakpoints="{ '640px': '92vw' }"
        @update:visible="emit('update:visible', $event)"
    >
        <div class="space-y-3.5 pt-2 text-xs">
            <div>
                <label class="block font-medium mb-1">Nama Templat *</label>
                <InputText
                    v-model="form.nm_template"
                    class="w-full text-xs"
                    placeholder="Contoh: SIT Developer"
                />
            </div>

            <div>
                <label class="block font-medium mb-1">Departemen</label>
                <Select
                    v-model="form.kd_dept"
                    :options="[{ kd_dept: null, nm_dept: 'Semua Departemen' }, ...departments]"
                    optionLabel="nm_dept"
                    optionValue="kd_dept"
                    :disabled="Boolean(adminDivision)"
                    placeholder="Pilih Departemen"
                    class="w-full text-xs"
                />
                <p class="text-[11px] text-muted-color mt-1">
                    Menentukan Admin Seksi mana yang melihat templat ini. Karyawan dimasukkan lewat kartu Anggota.
                </p>
            </div>
        </div>

        <template #footer>
            <div class="flex justify-end gap-2 pt-2">
                <Button
                    label="Batal"
                    severity="secondary"
                    size="small"
                    text
                    :disabled="saving"
                    @click="closeDialog"
                />
                <Button
                    label="Simpan Templat"
                    severity="primary"
                    size="small"
                    class="font-bold"
                    :loading="saving"
                    :disabled="saving"
                    @click="handleSave"
                />
            </div>
        </template>
    </Dialog>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import { adminService } from '@/service/adminService';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    isEditing: {
        type: Boolean,
        default: false
    },
    templateData: {
        type: Object,
        default: () => ({ id_template: '', kd_dept: '', nm_template: '', is_active: true })
    },
    departments: {
        type: Array,
        default: () => []
    },
    adminDivision: {
        type: String,
        default: ''
    },
    templates: {
        type: Array,
        default: () => []
    }
});

const emit = defineEmits(['update:visible', 'saved']);
const toast = useToast();

const form = ref({
    id_template: '',
    kd_dept: '',
    nm_template: '',
    is_active: true
});

const saving = ref(false);

watch(
    () => props.templateData,
    (newVal) => {
        if (newVal) {
            form.value = {
                id_template: newVal.id_template || '',
                kd_dept: newVal.kd_dept || '',
                nm_template: newVal.nm_template || '',
                is_active: newVal.is_active ?? true
            };
        }
    },
    { immediate: true, deep: true }
);

function closeDialog() {
    emit('update:visible', false);
}

async function handleSave() {
    const nameTrimmed = form.value.nm_template?.trim();
    if (!nameTrimmed) {
        toast.add({ severity: 'warn', summary: 'Validasi', detail: 'Nama templat wajib diisi', life: 3000 });
        return;
    }

    const dupName = props.templates.find(
        (t) => t.id_template !== form.value.id_template && t.nm_template?.trim().toLowerCase() === nameTrimmed.toLowerCase()
    );
    if (dupName) {
        toast.add({ severity: 'warn', summary: 'Validasi', detail: `Templat dengan nama "${nameTrimmed}" sudah ada`, life: 3000 });
        return;
    }

    saving.value = true;
    try {
        let savedResult;
        if (props.isEditing) {
            savedResult = await adminService.updateApprovalTemplate(form.value);
            toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Templat berhasil diperbarui', life: 3000 });
        } else {
            savedResult = await adminService.createApprovalTemplate(form.value);
            toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Templat baru berhasil dibuat', life: 3000 });
        }
        emit('saved', savedResult);
        closeDialog();
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: err.message || 'Gagal menyimpan template', life: 3000 });
    } finally {
        saving.value = false;
    }
}
</script>
