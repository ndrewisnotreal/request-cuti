export function publicPath(file) {
    return `${import.meta.env.BASE_URL}${String(file).replace(/^\/+/, '')}`;
}
