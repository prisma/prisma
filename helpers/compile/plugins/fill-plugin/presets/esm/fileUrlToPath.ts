import os from 'os'

const danglingSlashRegex = /^\/([a-zA-Z]:)/;
const posixSlashRegex = /\//g;

// super lightweight shim for fileUrlToPath
export function fileUrlToPath(fileUrl: string) {
    const pathname = fileUrl.slice(7);
    if (os?.platform() == 'win32') {
        return decodeURIComponent(pathname.replace(danglingSlashRegex, '$1').replace(posixSlashRegex, '\\'));
    } else {
        return decodeURIComponent(pathname);
    }
}
