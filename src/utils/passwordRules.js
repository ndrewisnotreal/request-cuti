// Syarat password sama dengan backend (common/password.util.ts → assertPasswordStrength)
export const PASSWORD_SYMBOL_RE = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;

export function passwordChecks(pw = '') {
    return [
        { label: 'Minimal 8 karakter', ok: pw.length >= 8 },
        { label: 'Huruf besar dan kecil', ok: /[A-Z]/.test(pw) && /[a-z]/.test(pw) },
        { label: 'Angka', ok: /\d/.test(pw) },
        { label: 'Simbol, mis. ! @ #', ok: PASSWORD_SYMBOL_RE.test(pw) }
    ];
}

/** Pesan syarat pertama yang belum terpenuhi, atau null bila password sudah kuat. */
export function passwordProblem(pw = '') {
    const failed = passwordChecks(pw).find((c) => !c.ok);
    return failed ? `Password baru belum memenuhi syarat: ${failed.label.toLowerCase()}.` : null;
}
