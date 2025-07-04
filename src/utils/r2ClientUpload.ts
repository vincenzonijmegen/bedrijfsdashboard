import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const client = new S3Client({
  region: "auto",
  endpoint: "https://196f01e78cb54b88b85122140a9c359d.r2.cloudflarestorage.com",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY || "",
    secretAccessKey: process.env.R2_SECRET_KEY || "",
  },
});

/**
 * Uploadt een afbeelding naar R2 en retourneert de publieke URL
 */
export async function uploadAfbeelding(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";

  const cleanName = file.name
    .toLowerCase()
    .replace(/\s+/g, "_")           // spaties → underscores
    .replace(/[^a-z0-9_.-]/g, "")    // vreemde tekens eruit
    .replace(/\.+$/, "");            // eindpunt weghalen

  const fileName = `${Date.now()}_${cleanName}`;
  const key = `public/instructies/${fileName}`;

  const command = new PutObjectCommand({
    Bucket: "instructieplatform",
    Key: key,
    Body: buffer,
    ContentType: file.type,
  });

  await client.send(command);

  return `https://pub-196f01e78cb54b88b85122140a9c359d.r2.dev/${key}`;
}
