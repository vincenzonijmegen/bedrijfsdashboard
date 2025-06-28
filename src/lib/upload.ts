export async function uploadAfbeelding(file: File): Promise<string> {
  console.warn("⚠️ Dummy uploadAfbeelding actief");
  return Promise.resolve("https://dummy-url.com/" + file.name);
}
