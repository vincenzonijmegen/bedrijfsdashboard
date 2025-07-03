export interface Leverancier {
  id: number;
  naam: string;
}

export interface Product {
  id: number;
  naam: string;
  eenheid: string;
  prijs: number;
  voorraadMinimum: number;
  leveranciersProductnummer?: string;
}

export interface Functie {
  id: number;
  naam: string;
}

export interface Medewerker {
  id: number;
  naam: string;
  email: string;
  functie: string;
}
