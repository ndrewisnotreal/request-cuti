import { ref, computed, nextTick } from 'vue';

const STORAGE_KEYS = {
    DARK_THEME: 'sicuti_dark_theme',
    SIDEBAR_COLLAPSED: 'sicuti_sidebar_collapsed',
    PRIMARY_COLOR: 'sicuti_primary_color'
};

const colors = {
    inalum: { 500: '#0077b8', 600: '#00649b' },
    emerald: { 500: '#10b981', 600: '#059669' },
    indigo: { 500: '#6366f1', 600: '#4f46e5' },
    amber: { 500: '#f59e0b', 600: '#d97706' },
    cyan: { 500: '#06b6d4', 600: '#0891b2' },
    rose: { 500: '#f43f5e', 600: '#e11d48' }
};

function getStoredBoolean(key, defaultValue = false) {
    try {
        if (typeof localStorage !== 'undefined') {
            const val = localStorage.getItem(key);
            if (val !== null) return val === 'true';
        }
    } catch {}
    return defaultValue;
}

function getStoredString(key, defaultValue = '') {
    try {
        if (typeof localStorage !== 'undefined') {
            return localStorage.getItem(key) || defaultValue;
        }
    } catch {}
    return defaultValue;
}

function applyPrimaryColorCss(colorKey) {
    if (typeof document === 'undefined') return;
    const selected = colors[colorKey] || colors.inalum;
    document.documentElement.style.setProperty('--p-primary-500', selected[500]);
    document.documentElement.style.setProperty('--p-primary-color', selected[500]);
    document.documentElement.style.setProperty('--p-primary-hover-color', selected[600]);
}

const isDarkTheme = ref(getStoredBoolean(STORAGE_KEYS.DARK_THEME, false));
const mobileMenuOpen = ref(false);
const isSidebarCollapsed = ref(getStoredBoolean(STORAGE_KEYS.SIDEBAR_COLLAPSED, false));
const configSidebarVisible = ref(false);
const currentPrimaryColor = ref(getStoredString(STORAGE_KEYS.PRIMARY_COLOR, 'inalum'));

// Sync initial dark class immediately
if (typeof document !== 'undefined') {
    if (isDarkTheme.value) {
        document.documentElement.classList.add('app-dark');
    } else {
        document.documentElement.classList.remove('app-dark');
    }
}

// Sync initial primary color immediately
if (currentPrimaryColor.value) {
    applyPrimaryColorCss(currentPrimaryColor.value);
}

export function useLayout() {
    const toggleDarkMode = (event) => {
        const isAppearanceTransition =
            typeof document !== 'undefined' &&
            Boolean(document.startViewTransition);

        // Fallback for browsers without View Transitions
        if (!isAppearanceTransition) {
            if (typeof document !== 'undefined') {
                document.documentElement.classList.add('theme-transitioning');
            }
            isDarkTheme.value = !isDarkTheme.value;
            if (typeof document !== 'undefined') {
                document.documentElement.classList.toggle('app-dark', isDarkTheme.value);
                setTimeout(() => {
                    document.documentElement.classList.remove('theme-transitioning');
                }, 350);
            }
            try {
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem(STORAGE_KEYS.DARK_THEME, String(isDarkTheme.value));
                }
            } catch {}
            return;
        }

        // Get coordinates from event or button bounding rect
        let x = event?.clientX;
        let y = event?.clientY;
        if (x === undefined || y === undefined || (x === 0 && y === 0)) {
            const btn = document.querySelector('button[title*="Mode Gelap"]') || event?.currentTarget;
            if (btn) {
                const rect = btn.getBoundingClientRect();
                x = rect.left + rect.width / 2;
                y = rect.top + rect.height / 2;
            } else {
                x = window.innerWidth - 60;
                y = 32;
            }
        }

        const endRadius = Math.hypot(
            Math.max(x, window.innerWidth - x),
            Math.max(y, window.innerHeight - y)
        );

        const transition = document.startViewTransition(async () => {
            isDarkTheme.value = !isDarkTheme.value;
            document.documentElement.classList.toggle('app-dark', isDarkTheme.value);
            try {
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem(STORAGE_KEYS.DARK_THEME, String(isDarkTheme.value));
                }
            } catch {}
            await nextTick();
        });

        transition.ready.then(() => {
            const clipPath = [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${endRadius}px at ${x}px ${y}px)`
            ];
            document.documentElement.animate(
                {
                    clipPath
                },
                {
                    duration: 450,
                    easing: 'ease-in-out',
                    pseudoElement: '::view-transition-new(root)'
                }
            );
        });
    };

    const toggleMobileMenu = () => {
        mobileMenuOpen.value = !mobileMenuOpen.value;
    };

    const closeMobileMenu = () => {
        mobileMenuOpen.value = false;
    };

    const toggleSidebarCollapse = () => {
        isSidebarCollapsed.value = !isSidebarCollapsed.value;
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, String(isSidebarCollapsed.value));
            }
        } catch {}
    };

    const setSidebarCollapsed = (collapsed) => {
        isSidebarCollapsed.value = !!collapsed;
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, String(isSidebarCollapsed.value));
            }
        } catch {}
    };

    const toggleConfigSidebar = () => {
        configSidebarVisible.value = !configSidebarVisible.value;
    };

    const setPrimaryColor = (colorKey) => {
        currentPrimaryColor.value = colorKey;
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(STORAGE_KEYS.PRIMARY_COLOR, colorKey);
            }
        } catch {}
        applyPrimaryColorCss(colorKey);
    };

    return {
        isDarkTheme: computed(() => isDarkTheme.value),
        mobileMenuOpen,
        isSidebarCollapsed,
        configSidebarVisible,
        currentPrimaryColor,
        toggleDarkMode,
        toggleMobileMenu,
        closeMobileMenu,
        toggleSidebarCollapse,
        setSidebarCollapsed,
        toggleConfigSidebar,
        setPrimaryColor
    };
}

