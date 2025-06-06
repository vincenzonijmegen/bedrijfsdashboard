export async function uploadAfbeelding(file) {
  const bestandsnaam = encodeURIComponent(file.name);
  const UPLOAD_KEY = "instructie123x67%A"; // jouw geheime sleutel

  const uploadURL = `https://upload-instructies.herman-48b.workers.dev/upload/public/instructies/${bestandsnaam}?key=${UPLOAD_KEY}`;
  const downloadURL = `https://pub-196f01e78cb54b88b85122140a9c359d.r2.dev/public/instructies/${bestandsnaam}`;

  const res = await fetch(uploadURL, {
    method: "PUT",
    body: file,
  });

  if (!res.ok) {
    console.error("❌ Upload response:", await res.text());
    throw new Error("Upload mislukt");
  }

  return downloadURL;
}
