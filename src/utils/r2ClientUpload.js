// src/utils/r2ClientUpload.js
export async function uploadAfbeelding(file) {
  const url = `https://planner-upload.herman-48b.workers.dev/upload/public/instructies/${encodeURIComponent(file.name)}`;

  const res = await fetch(url, {
    method: "PUT",
    body: file,
  });

  if (!res.ok) throw new Error("Upload mislukt");

  return `https://vincenzo-uploads.48b3ca960ac98a5b99df6b74d8cf4b3e.r2.dev/public/instructies/${encodeURIComponent(file.name)}`;
}
