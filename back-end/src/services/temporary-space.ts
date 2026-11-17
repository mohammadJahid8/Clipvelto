import { statfs } from "node:fs/promises";
import { UploadError } from "../modules/uploads/upload-error.js";

export async function requireTemporarySpace(directory: string, bytes: number) {
  const disk = await statfs(directory);
  const available = disk.bavail * disk.bsize;
  if (
    !Number.isFinite(bytes) ||
    bytes < 0 ||
    available - bytes < Math.max(1024 ** 3, disk.blocks * disk.bsize * 0.05)
  )
    throw new UploadError(
      503,
      "MEDIA_CAPACITY",
      "The processing server needs more temporary space for this recording. Try again later or contact support. No processing credits were charged.",
    );
}
