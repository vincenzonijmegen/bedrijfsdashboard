export function r2ClientUpload(file: File): Promise<string> {
  return Promise.resolve("https://dummy.com/" + file.name);
}

// Gebruik in andere bestanden:
// import { r2ClientUpload as uploadAfbeelding } from "@/utils/r2ClientUpload";
