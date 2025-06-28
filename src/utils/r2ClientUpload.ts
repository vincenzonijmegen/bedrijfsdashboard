export function r2ClientUpload(file: File): Promise<string> {
  return Promise.resolve("https://dummy.com/" + file.name);
}
