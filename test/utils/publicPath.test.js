import { afterEach, describe, expect, it, vi } from 'vitest';
import { publicPath } from '@/utils/publicPath';
import { publicAppOrigin, validationUrl } from '@/utils/leaveFormPrint';

describe('aset & tautan mengikuti base URL (deploy di subpath /cuti)', () => {
    afterEach(() => vi.unstubAllEnvs());

    it('base / (lokal & production)', () => {
        expect(publicPath('logo-inalum.png')).toBe('/logo-inalum.png');
        expect(publicPath('/auth/login')).toBe('/auth/login');
        expect(validationUrl('abc')).toBe(`${window.location.origin}/validasi/abc`);
    });

    it('base /cuti/ (development & staging)', () => {
        vi.stubEnv('BASE_URL', '/cuti/');
        expect(publicPath('logo-inalum.png')).toBe('/cuti/logo-inalum.png');
        expect(publicPath('auth/login')).toBe('/cuti/auth/login');
        expect(publicAppOrigin()).toBe(`${window.location.origin}/cuti`);
        expect(validationUrl('abc')).toBe(`${window.location.origin}/cuti/validasi/abc`);
    });
});
