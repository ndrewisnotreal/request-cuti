<script setup>
import { publicPath } from '@/utils/publicPath';
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useLayout } from '@/layout/composables/layout';
import { currentUser } from '@/service/sicutiService';

const emit = defineEmits(['complete']);

const route = useRoute();
const { isDarkTheme } = useLayout();

const isBlurLoading = ref(false);
const loggedInUser = ref(null);
const loadingStepText = ref('Menyiapkan ruang kerja...');
const progressWidth = ref('25%');

onMounted(() => {
    const justLoggedIn = sessionStorage.getItem('sct_just_logged_in');
    const isPreview = route?.query?.preview_blur === '1';

    if (justLoggedIn === 'true' || isPreview) {
        sessionStorage.removeItem('sct_just_logged_in');
        try {
            const rawUser = sessionStorage.getItem('sct_login_user');
            if (rawUser) {
                loggedInUser.value = JSON.parse(rawUser);
                sessionStorage.removeItem('sct_login_user');
            }
        } catch {}

        if (!loggedInUser.value) {
            loggedInUser.value = currentUser.value;
        }

        startBlurSequence();
    }
});

async function startBlurSequence() {
    isBlurLoading.value = true;
    loadingStepText.value = 'Memvalidasi sesi & hak akses...';
    progressWidth.value = '35%';

    await new Promise((r) => setTimeout(r, 280));
    progressWidth.value = '75%';
    loadingStepText.value = 'Menyiapkan ruang kerja Anda...';

    await new Promise((r) => setTimeout(r, 380));
    progressWidth.value = '100%';

    await new Promise((r) => setTimeout(r, 220));
    isBlurLoading.value = false;
    emit('complete');
}
</script>

<template>
    <Transition name="fade-blur">
        <div
            v-if="isBlurLoading"
            :class="[
                'fixed inset-0 z-50 flex flex-col items-center justify-center p-6 backdrop-blur-[6px] select-none transition-colors duration-500',
                isDarkTheme ? 'bg-surface-950/50 text-white' : 'bg-white/60 text-surface-900'
            ]"
        >
            <div class="flex flex-col items-center max-w-sm text-center">
                <div class="relative w-16 h-16 mb-5 flex items-center justify-center">
                    <div
                        :class="[
                            'absolute inset-0 rounded-full border-2 transition-colors duration-300',
                            isDarkTheme ? 'border-white/10' : 'border-surface-200'
                        ]"
                    ></div>
                    <div class="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
                    <div
                        :class="[
                            'w-10 h-10 rounded-full flex items-center justify-center p-1.5 transition-colors duration-300',
                            isDarkTheme ? 'bg-surface-900/90 border border-white/10' : 'bg-white/95 border border-surface-200/90 shadow-xs'
                        ]"
                    >
                        <img :src="publicPath('logo-inalum.png')" alt="Logo PT INALUM" class="w-full h-full object-contain" />
                    </div>
                </div>

                <h2
                    :class="[
                        'text-xl font-bold tracking-tight transition-colors duration-300',
                        isDarkTheme ? 'text-white' : 'text-surface-900'
                    ]"
                >
                    {{ loggedInUser?.name ? `Selamat Datang, ${loggedInUser.name}` : 'Menyiapkan Dashboard' }}
                </h2>
                <p
                    :class="[
                        'text-xs mt-2 font-medium tracking-wide transition-all duration-300',
                        isDarkTheme ? 'text-surface-300' : 'text-surface-600'
                    ]"
                >
                    {{ loadingStepText }}
                </p>

                <div
                    :class="[
                        'w-48 h-1 rounded-full mt-5 overflow-hidden transition-colors duration-300',
                        isDarkTheme ? 'bg-white/15' : 'bg-surface-200'
                    ]"
                >
                    <div
                        class="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                        :style="{ width: progressWidth }"
                    ></div>
                </div>
            </div>
        </div>
    </Transition>
</template>

<style scoped>
.fade-blur-enter-active,
.fade-blur-leave-active {
    transition: opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1), backdrop-filter 0.45s cubic-bezier(0.16, 1, 0.3, 1);
}

.fade-blur-enter-from,
.fade-blur-leave-to {
    opacity: 0;
    backdrop-filter: blur(0px);
}
</style>
