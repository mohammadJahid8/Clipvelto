export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 3);
  const value = bytes / 1024 ** unit;
  return `${new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(value)} ${["B", "KB", "MB", "GB"][unit]}`;
}
