/** Client-side download: nothing leaves the browser (no endpoint involved). */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  // Revoke after the browser has started the download
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** A file-system-safe base name: "Asset Classes (Core)" → "asset-classes-core". */
export function safeFileName(name: string, fallback = 'export'): string {
  const base = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base || fallback;
}
