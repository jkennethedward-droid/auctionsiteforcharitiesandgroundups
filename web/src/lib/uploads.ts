"use client";

import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getFirebaseStorage } from "@/lib/firebase/client";

export type ImageValidationResult =
  | { ok: true }
  | { ok: false; error: string };

export async function validateSquareImageFile(file: File): Promise<ImageValidationResult> {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) {
    return { ok: false, error: "Only JPEG, PNG, or WEBP images are allowed." };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { ok: false, error: "Max file size is 2MB per image." };
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Failed to read image."));
      i.src = url;
    });

    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return { ok: false, error: "Could not read image dimensions." };

    // Accept near-square within 5% tolerance.
    const ratio = w / h;
    if (ratio < 0.95 || ratio > 1.05) {
      return { ok: false, error: "Image must be 1:1 (square)." };
    }

    return { ok: true };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function uploadItemImage(args: {
  uploaderUid: string;
  itemId: string;
  index: number;
  file: File;
}): Promise<string> {
  const { uploaderUid, itemId, index, file } = args;
  const storage = getFirebaseStorage();
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `items/${itemId}/${uploaderUid}_${index}.${ext}`;

  const r = ref(storage, path);
  await uploadBytes(r, file, { contentType: file.type });
  return await getDownloadURL(r);
}

export async function uploadBrandAsset(args: {
  kind: "logo" | "favicon";
  file: File;
}): Promise<string> {
  const { kind, file } = args;
  const storage = getFirebaseStorage();

  // Allow favicon ICO too.
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/x-icon", "image/vnd.microsoft.icon"];
  if (!allowed.includes(file.type)) {
    throw new Error("Only JPEG, PNG, WEBP, or ICO files are allowed.");
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("Max file size is 2MB.");
  }

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "image/x-icon" || file.type === "image/vnd.microsoft.icon"
          ? "ico"
          : "jpg";

  // Cache-bust by timestamp so clients pick up changes quickly.
  const path = `brand/${kind}_${Date.now()}.${ext}`;
  const r = ref(storage, path);
  await uploadBytes(r, file, { contentType: file.type });
  return await getDownloadURL(r);
}

