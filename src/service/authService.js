import { ref } from 'vue';
import { getEncryptedItem, setEncryptedItem } from '@/utils/encryption';
import api, { clearAuth } from './api.js';

const AUTH_STORAGE_KEY = 'sicuti_auth';
const MENUS_STORAGE_KEY = 'sicuti_user_menus';

function loadStoredList(key) {
    const list = getEncryptedItem(key);
    return Array.isArray(list) ? list : [];
}

export const userMenus = ref(loadStoredList(MENUS_STORAGE_KEY));

// Permission fungsional prototype ("module.action"), dari /auth/authorize & /auth/menu
const ABILITIES_STORAGE_KEY = 'sicuti_abilities';

export const userAbilities = ref(loadStoredList(ABILITIES_STORAGE_KEY));

function setAbilities(list) {
    userAbilities.value = Array.isArray(list) ? list : [];
    setEncryptedItem(ABILITIES_STORAGE_KEY, userAbilities.value);
}

/** Punya salah satu permission "module.action"? */
export function can(...keys) {
    const owned = userAbilities.value || [];
    return keys.flat().some((k) => owned.includes(k));
}

export const authService = {
    async login(username, password) {
        const payload = {
            username: username.trim(),
            password: password.trim()
        };
        // Backend memasang cookie httpOnly berisi token; access_token di respons hanya untuk Swagger
        const res = await api.post('/auth/authorize', payload);
        const data = res?.data || res;
        setAbilities(data?.abilities);
        if (data?.user) {
            setEncryptedItem(AUTH_STORAGE_KEY, data.user);
        }

        const payloadMenu = Array.isArray(data?.menu)
            ? data.menu
            : Array.isArray(data?.build_menu)
            ? data.build_menu
            : [];
        if (payloadMenu.length > 0) {
            userMenus.value = payloadMenu;
            setEncryptedItem(MENUS_STORAGE_KEY, payloadMenu);
        } else {
            await this.getMenu().catch(() => {});
        }

        return data;
    },

    async logout() {
        try {
            await api.post('/auth/logout');
        } catch {
            // Ignore backend error during logout
        } finally {
            clearAuth();
            userMenus.value = [];
            userAbilities.value = [];
        }
    },

    getProfile() {
        const user = getEncryptedItem(AUTH_STORAGE_KEY);
        if (user && userMenus.value.length === 0) {
            this.getMenu().catch(() => {});
        }
        return user;
    },

    async getMenu() {
        if (!this.isAuthenticated()) {
            userMenus.value = [];
            return { build_menu: [], menu: [] };
        }
        const res = await api.get('/auth/menu');
        const data = res?.data || res;
        if (Array.isArray(data?.abilities)) setAbilities(data.abilities);
        const list = Array.isArray(data?.menu)
            ? data.menu
            : Array.isArray(data?.build_menu)
            ? data.build_menu
            : Array.isArray(data)
            ? data
            : [];
        userMenus.value = list;
        setEncryptedItem(MENUS_STORAGE_KEY, list);
        return data;
    },

    /** Sesi lokal ada; bila cookie login sudah habis, request berikutnya dapat 401 dan sesi dibersihkan. */
    isAuthenticated() {
        return Boolean(getEncryptedItem(AUTH_STORAGE_KEY));
    },

    async changePassword(payload) {
        const res = await api.put('/auth/password', payload);
        return res?.data || res;
    }
};

export default authService;
