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


/**
 * Correspondentie represents a single correspondence entry linked to a contact.
 */
export interface Correspondentie {
  /** Unique identifier */
  id?: number;
  /** ID of the contact this correspondence belongs to */
  contact_id?: number;
  /** ISO date string of the correspondence */
  datum?: string;
  /** Type of correspondence: e-mail, telefoon, bezoek */
  type?: 'email' | 'telefoon' | 'bezoek';
  /** Description or notes */
  omschrijving?: string;
  /** URL to an uploaded PDF attachment */
  bijlage_url?: string;
}
