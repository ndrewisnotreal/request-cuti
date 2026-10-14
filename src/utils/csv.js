/**
 * Susun teks CSV (dipisah koma, baris CRLF, diawali BOM agar Excel membaca UTF-8).
 * `columns`: [{ header, value: (row) => any, text?: true }]. `text` menjaga nilai seperti
 * NIK berawalan nol tetap teks di Excel.
 */
export function buildCsv(columns, rows) {
    const cell = (v, asText) => {
        if (v === null || v === undefined) return '';
        const s = String(v);
        if (asText) return `="${s.replace(/"/g, '""')}"`;
        return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [columns.map((c) => cell(c.header)).join(',')];
    for (const row of rows) lines.push(columns.map((c) => cell(c.value(row), c.text)).join(','));
    return `﻿${lines.join('\r\n')}`;
}

/** Unduh teks CSV sebagai berkas. */
export function downloadCsv(filename, csv) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
