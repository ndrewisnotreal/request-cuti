import { ref } from 'vue';

const PREFIX = 'lebur_tour_seen';

export const tourSeenTick = ref(0);

const keyOf = (uid, tourId) => `${PREFIX}:${uid ?? 'anon'}:${tourId}`;

export function hasSeenTour(uid, tour) {
    try {
        return localStorage.getItem(keyOf(uid, tour.id)) === String(tour.version);
    } catch {
        return false;
    }
}

export function markTourSeen(uid, tour) {
    try {
        localStorage.setItem(keyOf(uid, tour.id), String(tour.version));
    } catch {}
    tourSeenTick.value++;
}
