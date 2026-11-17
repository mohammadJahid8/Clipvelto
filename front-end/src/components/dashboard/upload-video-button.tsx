import { Plus } from "lucide-react";
import Link from "next/link";

export function UploadVideoButton() {
  return (
    <Link href="/dashboard/upload" className="button button-primary">
      <Plus size={17} aria-hidden="true" />
      Upload video
    </Link>
  );
}
