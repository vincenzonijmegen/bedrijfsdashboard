// src/app/api/contacten/correspondentie/upload/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import { mkdirSync, existsSync } from 'fs';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File;
  const contactId = formData.get('contact_id');

  if (!file || typeof contactId !== 'string') {
    return NextResponse.json({ error: 'Ongeldige invoer' }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const uploadDir = path.join(process.cwd(), 'public/uploads/correspondentie');
  if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });

  const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '')}`;
  const filepath = path.join(uploadDir, filename);

  await writeFile(filepath, buffer);

  const url = `/uploads/correspondentie/${filename}`;
  return NextResponse.json({ url });
}
