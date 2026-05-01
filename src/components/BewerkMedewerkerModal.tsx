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

function formatDateInput(value: string | null | undefined) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

export default function BewerkMedewerkerModal({
  open,
  onClose,
  medewerker,
  functies,
  onSave,
}: Props) {
  const [naam, setNaam] = useState("");
  const [email, setEmail] = useState("");
  const [functie, setFunctie] = useState("");
  const [geboortedatum, setGeboortedatum] = useState("");

  useEffect(() => {
    if (medewerker) {
      setNaam(medewerker.naam || "");
      setEmail(medewerker.email || "");
      setFunctie(medewerker.functie || "");
      setGeboortedatum(formatDateInput(medewerker.geboortedatum));
    }
  }, [medewerker]);

  const handleOpslaan = () => {
    onSave({
      ...medewerker,
      naam,
      email,
      functie,
      geboortedatum: geboortedatum || null,
    });

    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div className="relative z-50 w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <Dialog.Title className="mb-4 text-lg font-semibold">
          Bewerk medewerker
        </Dialog.Title>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Naam</label>
            <input
              type="text"
              value={naam}
              onChange={(e) => setNaam(e.target.value)}
              className="w-full rounded border px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Geboortedatum</label>
            <input
              type="date"
              value={geboortedatum}
              onChange={(e) => setGeboortedatum(e.target.value)}
              className="w-full rounded border px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Functie</label>
            <select
              value={functie}
              onChange={(e) => setFunctie(e.target.value)}
              className="w-full rounded border px-3 py-2"
            >
              <option value="">Kies een functie</option>
              {functies.map((f) => (
                <option key={f.id} value={f.naam}>
                  {f.naam}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button onClick={onClose} className="rounded bg-gray-200 px-4 py-2">
            Annuleren
          </button>
          <button
            onClick={handleOpslaan}
            className="rounded bg-blue-600 px-4 py-2 text-white"
          >
            Opslaan
          </button>
        </div>
      </div>
    </Dialog>
  );
}