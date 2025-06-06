// app/admin/instructies/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";
import Link from "next/link";

interface Instructie {
  id: string;
  titel: string;
  slug: string;
  status: "concept" | "actief";
}

export default function InstructiesAdminPage() {
  const [instructies, setInstructies] = useState<Instructie[]>([]);

  useEffect(() => {
    fetch("/api/instructies")
      .then((res) => res.json())
      .then((data) => setInstructies(data));
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Instructiebeheer</h1>
        <Link href="/admin/instructies/nieuw">
          <Button className="gap-2">
            <Plus size={16} /> Nieuwe instructie
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {instructies.map((item) => (
          <Card key={item.id} className="hover:shadow-md">
            <CardContent className="p-4 space-y-2">
              <h2 className="text-lg font-semibold">{item.titel}</h2>
              <p className="text-sm text-muted-foreground">Status: {item.status}</p>
              <Link
                href={`/admin/instructies/${item.slug}`}
                className="text-sm text-blue-600 hover:underline"
              >
                Bewerken
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
