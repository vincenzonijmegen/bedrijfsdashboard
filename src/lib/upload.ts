export async function uploadAfbeelding(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error("Upload mislukt");
  }

  const data = await res.json();
  return data.url; // verwacht een object met `{ url: "https://..." }`
}
