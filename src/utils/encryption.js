const SECRET_KEY = import.meta.env.VITE_ENCRYPTION_SECRET_KEY || 'default-secret-key-32-chars-long!!';

function toBytes(str) {
    return new TextEncoder().encode(str);
}

function fromBytes(bytes) {
    return new TextDecoder().decode(bytes);
}

function xorBytes(data, keyBytes) {
    const out = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i += 1) {
        out[i] = data[i] ^ keyBytes[i % keyBytes.length];
    }
    return out;
}

function bytesToBase64(bytes) {
    let binary = '';
    bytes.forEach((b) => {
        binary += String.fromCharCode(b);
    });
    return btoa(binary);
}

function base64ToBytes(base64) {
    const binary = atob(base64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        out[i] = binary.charCodeAt(i);
    }
    return out;
}

export function encryptData(data) {
    const jsonString = JSON.stringify(data);
    const keyBytes = toBytes(SECRET_KEY);
    const xored = xorBytes(toBytes(jsonString), keyBytes);
    return bytesToBase64(xored);
}

export function decryptData(encryptedData) {
    try {
        const keyBytes = toBytes(SECRET_KEY);
        const xored = base64ToBytes(encryptedData);
        const jsonString = fromBytes(xorBytes(xored, keyBytes));
        return JSON.parse(jsonString);
    } catch {
        throw new Error('Failed to decrypt data - invalid key or corrupted data');
    }
}

export function setEncryptedItem(key, data) {
    try {
        localStorage.setItem(key, encryptData(data));
    } catch (error) {
        console.error(`Error setting encrypted item ${key}:`, error);
    }
}

export function getEncryptedItem(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        return decryptData(raw);
    } catch (error) {
        console.error(`Error getting encrypted item ${key}:`, error);
        localStorage.removeItem(key);
        return null;
    }
}

export function removeEncryptedItem(key) {
    localStorage.removeItem(key);
}
