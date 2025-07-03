export interface Leverancier {
  id: number;
  naam: string;
}

export interface Product {
  actief?: boolean;
  minimum_voorraad?: number;
  id: number;
  naam: string;
  bestelnummer?: string;
  besteleenheid?: number;
  huidige_prijs?: number;
  volgorde?: number;
}

export interface Functie {
  id: number;
  naam: string;
  omschrijving?: string;
}

export interface Medewerker {
  id: number;
  naam: string;
  email: string;
  functie_id: number;
  functie?: string;
}
