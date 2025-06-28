// src/utils/r2ClientUpload.ts
export async function r2ClientUpload(file: File): Promise<string> {
  console.warn("⚠️ Dummy uploadfunctie actief: r2ClientUpload");
  return Promise.resolve("https://dummy-url.com/" + file.name);
}
