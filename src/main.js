import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { syncFromBackend } from '@/service/sicutiService';

import Aura from '@primeuix/themes/aura';
import { definePreset } from '@primeuix/themes';
import PrimeVue from 'primevue/config';
import ConfirmationService from 'primevue/confirmationservice';
import ToastService from 'primevue/toastservice';
import Tooltip from 'primevue/tooltip';

import '@/assets/tailwind.css';
import '@/assets/styles.scss';

const InalumPreset = definePreset(Aura, {
    semantic: {
        primary: {
            50: '#eff8ff',
            100: '#dceeff',
            200: '#b9ddff',
            300: '#82c5f5',
            400: '#3ea7df',
            500: '#0077b8',
            600: '#00649b',
            700: '#004f7d',
            800: '#003b5c',
            900: '#00283f',
            950: '#001a2c'
        },
        colorScheme: {
            light: {
                primary: {
                    color: '#0077b8',
                    inverseColor: '#ffffff',
                    hoverColor: '#00649b',
                    activeColor: '#004f7d'
                },
                highlight: {
                    background: '#f1f5f9',
                    focusBackground: '#e2e8f0',
                    color: '#0f172a',
                    focusColor: '#0f172a'
                }
            },
            dark: {
                primary: {
                    color: '#3ea7df',
                    inverseColor: '#00283f',
                    hoverColor: '#82c5f5',
                    activeColor: '#b9ddff'
                },
                highlight: {
                    background: 'rgba(255, 255, 255, 0.08)',
                    focusBackground: 'rgba(255, 255, 255, 0.12)',
                    color: '#f8fafc',
                    focusColor: '#ffffff'
                }
            }
        }
    }
});

const app = createApp(App);

app.use(router);
app.use(PrimeVue, {
    theme: {
        preset: InalumPreset,
        options: {
            darkModeSelector: '.app-dark',
            cssLayer: {
                name: 'primevue',
                order: 'theme, base, primevue'
            }
        }
    },
    locale: {
        firstDayOfWeek: 0,
        dayNames: ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'],
        dayNamesShort: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'],
        dayNamesMin: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'],
        monthNames: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'],
        monthNamesShort: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
        today: 'Hari Ini',
        clear: 'Hapus'
    }
});
app.use(ToastService);
app.use(ConfirmationService);
app.directive('tooltip', Tooltip);

app.mount('#app');
syncFromBackend();
