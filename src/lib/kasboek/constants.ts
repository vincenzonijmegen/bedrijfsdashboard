export type KasCategorie = {
  key: string;
  label: string;
  type: 'ontvangst' | 'uitgave' | 'overig';
  btw?: 0 | 9 | 21 | '-';
};

export const CATEGORIEEN: KasCategorie[] = [
  { key: 'verkopen_laag',        label: 'Verkopen (laag tarief)', type: 'ontvangst', btw: 9 },
  { key: 'verkoop_kadobonnen',   label: 'Verkoop cadeaubonnen',   type: 'ontvangst', btw: 9 },
  { key: 'wisselgeld_van_bank',  label: 'Wisselgeld van bank',    type: 'ontvangst', btw: '-' },
  { key: 'prive_opname_herman',  label: 'Privé opname Herman',    type: 'uitgave',   btw: '-' },
  { key: 'prive_opname_erik',    label: 'Privé opname Erik',      type: 'uitgave',   btw: '-' },
  { key: 'ingenomen_kadobon',    label: 'Ingenomen cadeaubon',    type: 'uitgave',    btw: 9 },
  { key: 'naar_bank_afgestort',  label: 'Naar bank afgestort',    type: 'uitgave',   btw: '-' },
  { key: 'kasverschil',          label: 'Kasverschil',            type: 'uitgave',    btw: '-' },
];

// Handige helper
export const getCategorie = (key: string) => CATEGORIEEN.find(c => c.key === key);
