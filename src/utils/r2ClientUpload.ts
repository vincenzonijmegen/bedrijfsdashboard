export function uploadAfbeelding(file: File): Promise<string> {
  return Promise.resolve("https://dummy.com/" + file.name);
}

// Gebruik in andere bestanden:
// import { uploadAfbeelding } from "@/utils/r2ClientUpload";
