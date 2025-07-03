import { useState, useEffect } from "react";
import { Dialog } from "@headlessui/react";
import { Functie, Medewerker } from "@/types/types";

interface Props {
  open: boolean;
  onClose: () => void;
  medewerker: Medewerker;
  functies: Functie[];
  onSave: (gewijzigd: Medewerker) => void;
}

export default function BewerkMedewerkerModal({ open, onClose, medewerker, functies, onSave }: Props) {
  const [naam, setNaam] = useState("");
  const [email, setEmail] = useState("");
  const [functieId, setFunctieId] = useState<string>("");

  useEffect(() => {
    if (medewerker) {
      setNaam(medewerker.naam);
      setEmail(medewerker.email);
      setFunctieId(medewerker.functie); // kan string of ID zijn
    }
  }, [medewerker]);

  const handleOpslaan = () => {
    const functienaam = functies.find(f => f.id.toString() === functieId)?.naam || "";
    onSave({
      ...medewerker,
      naam,
      email,
      functie: functienaam,
    });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} className="fixed z-50 inset-0 flex items-center justify-center">
      
      <div className="relative bg-white rounded-lg p-6 w-full max-w-md z-50 shadow-lg">
        <Dialog.Title className="text-lg font-semibold mb-4">Bewerk medewerker</Dialog.Title>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Naam</label>
            <input
              type="text"
              value={naam}
              onChange={(e) => setNaam(e.target.value)}
              className="border rounded px-3 py-2 w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border rounded px-3 py-2 w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Functie</label>
            <select
              value={functieId}
              onChange={(e) => setFunctieId(e.target.value)}
              className="border rounded px-3 py-2 w-full"
            >
              <option value="">Kies een functie</option>
              {functies.map((f) => (
                <option key={f.id} value={f.id}>{f.naam}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">Annuleren</button>
          <button onClick={handleOpslaan} className="px-4 py-2 bg-blue-600 text-white rounded">Opslaan</button>
        </div>
      </div>
    </Dialog>
  );
}
