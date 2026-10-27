<script setup>
import { ref } from 'vue';
import { Camera, Trash2 } from 'lucide-vue-next';
import { useToast } from 'primevue/usetoast';

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

const props = defineProps({
    name: {
        type: String,
        default: '-'
    },
    roleName: {
        type: String,
        default: '-'
    },
    deptName: {
        type: String,
        default: ''
    },
    deptCode: {
        type: String,
        default: '-'
    },
    nip: {
        type: String,
        default: '-'
    },
    photoUrl: {
        type: String,
        default: ''
    },
    hasSavedPhoto: {
        type: Boolean,
        default: false
    },
    isPendingPhoto: {
        type: Boolean,
        default: false
    },
    userInitials: {
        type: String,
        default: 'U'
    }
});

const emit = defineEmits(['photo-selected', 'remove-photo', 'cancel-photo']);
const toast = useToast();
const photoInput = ref(null);

function pickPhoto() {
    photoInput.value?.click();
}

function onPhotoSelected(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) {
        toast.add({
            severity: 'warn',
            summary: 'Format foto tidak didukung',
            detail: 'Pilih foto JPG, PNG, atau WEBP.',
            life: 3500
        });
        return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
        toast.add({
            severity: 'warn',
            summary: 'Foto terlalu besar',
            detail: 'Ukuran foto maksimal 2 MB.',
            life: 3500
        });
        return;
    }
    emit('photo-selected', file);
}
</script>

<template>
    <div>
        <input
            id="unggah-foto-profil"
            ref="photoInput"
            name="foto_profil"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="hidden"
            @change="onPhotoSelected"
        />

        <div class="p-4 rounded-xl bg-surface-50 dark:bg-surface-800/40 border border-surface-200 dark:border-surface-700 flex items-center gap-4">
            <div class="relative rounded-2xl bg-surface-100 dark:bg-surface-800 p-1 border border-surface-200 dark:border-surface-700 shadow-sm flex items-center justify-center shrink-0 size-16">
                <img v-if="photoUrl" :src="photoUrl" :alt="`Foto profil ${name}`" class="size-full rounded-xl object-cover" />
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

            <div class="min-w-0 flex-1">
                <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    <span class="text-base font-bold text-surface-900 dark:text-surface-0 leading-snug break-words">{{ name }}</span>
                    <span class="self-start sm:self-auto px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 shrink-0">
                        {{ roleName || 'Staff IT' }}
                    </span>
                </div>
                <p class="text-xs text-muted-color mt-0.5 truncate">
                    {{ deptName || 'Smelter Information Technology' }} &bull; Seksi {{ deptCode || 'SIT' }}
                </p>
                <div class="flex items-center gap-3 mt-1.5 text-[11px] text-muted-color">
                    <span>NIP: <strong class="font-mono text-surface-800 dark:text-surface-200">{{ nip }}</strong></span>
                </div>

                <div v-if="photoUrl" class="mt-1.5">
                    <button
                        type="button"
                        class="text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:underline inline-flex items-center gap-1 cursor-pointer transition-colors"
                        @click="isPendingPhoto ? emit('cancel-photo') : emit('remove-photo')"
                    >
                        <Trash2 :size="12" />
                        <span>{{ isPendingPhoto ? 'Batalkan foto baru' : 'Hapus foto profil' }}</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
