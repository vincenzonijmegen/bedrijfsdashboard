// src/utils/r2ClientUpload.js
export async function uploadAfbeelding(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("https://planner-upload.herman-48b.workers.dev/upload/public/instructies", {
    method: "PUT",
    body: file,
  });

  if (!res.ok) throw new Error("Upload mislukt");

  return `https://vincenzo-uploads.48b3ca960ac98a5b99df6b74d8cf4b3e.r2.dev/public/instructies/${file.name}`;
}
