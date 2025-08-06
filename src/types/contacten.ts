// src/types/contacten.ts

export interface Contactpersoon {
  id?: number;
  naam: string;
  telefoon?: string;
  email?: string;
}

export interface Company {
  id: number;
  naam: string;
  bedrijfsnaam?: string;
  type: string;
  debiteurennummer?: string;
  rubriek?: string;
  telefoon?: string;
  email?: string;
  website?: string;
  opmerking?: string;
  personen: Contactpersoon[];
}


export interface Correspondentie {
  id?: number;
  contact_id?: number;
  datum?: string;
  type?: 'email' | 'telefoon' | 'bezoek';
  omschrijving?: string;
  bijlage_url?: string;
}
