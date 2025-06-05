export async function uploadAfbeelding(file) {
  const bestandsnaam = encodeURIComponent(file.name);

  // Optioneel: voeg hier ?key=SECRET toe als je R2 Worker dat vereist
  const uploadURL = `https://planner-upload.herman-48b.workers.dev/upload/public/instructies/${bestandsnaam}`;
  const downloadURL = `https://vincenzo-uploads.48b3ca960ac98a5b99df6b74d8cf4b3e.r2.dev/public/instructies/${bestandsnaam}`;

  const res = await fetch(uploadURL, {
    method: "PUT",
    body: file,
    // headers: { "Authorization": "Bearer YOUR_SECRET" } // indien nodig
  });

  if (!res.ok) {
    console.error("❌ Upload response:", await res.text());
    throw new Error("Upload mislukt");
  }

  return downloadURL;
}
