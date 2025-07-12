// Bestand: src/app/admin/rapportage/page.tsx
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';

const rapportages = [
  {
    titel: 'Maandomzet per jaar',
    beschrijving: 'Toon de totale omzet per maand en per jaar in een overzicht.',
    link: '/admin/rapportage/maandomzet',
  },
    {
    titel: 'Omzet Feestdagen',
    beschrijving: 'Toon omzet op feestdagen een overzicht.',
    link: '/admin/rapportage/deestdagomzet',
  },
  // Toekomstige rapportages kunnen hier worden toegevoegd
];

export default function RapportageOverzicht() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Rapportages</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rapportages.map((r) => (
          <Link href={r.link} key={r.titel}>
            <Card className="hover:bg-gray-50 cursor-pointer">
              <CardContent className="p-4">
                <h2 className="font-semibold text-lg mb-1">{r.titel}</h2>
                <p className="text-sm text-gray-600">{r.beschrijving}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
