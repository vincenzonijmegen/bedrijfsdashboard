export async function r2ClientUpload(file: File): Promise<string> {
  console.warn("⚠️ Dummy r2ClientUpload actief");
  return Promise.resolve("https://dummy-r2.com/" + file.name);
}
