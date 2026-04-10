"use client";

import { useMemo, useState } from "react";

type Ingredient = {
  naam: string;
  gewicht: string;
};

type Props = {
  basisLiters: number | null;
  ingredienten: Ingredient[];
};

function formatNumber(value: number, decimals = 2) {
  const rounded = Number(value.toFixed(decimals));
  return String(rounded).replace(".", ",");
}

function parseFraction(value: string) {
  const match = value.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!match) return null;

  const teller = Number(match[1]);
  const noemer = Number(match[2]);

  if (!noemer) return null;
  return teller / noemer;
}

function parseLeadingAmount(input: string) {
  const trimmed = input.trim().replace(",", ".");

  const fractionMatch = trimmed.match(/^(\d+\s*\/\s*\d+)/);
  if (fractionMatch) {
    const fractionValue = parseFraction(fractionMatch[1]);
    if (fractionValue !== null) {
      return {
        value: fractionValue,
        raw: fractionMatch[1],
        rest: trimmed.slice(fractionMatch[1].length).trim(),
      };
    }
  }

  const numberMatch = trimmed.match(/^(\d+(?:\.\d+)?)/);
  if (!numberMatch) return null;

  return {
    value: Number(numberMatch[1]),
    raw: numberMatch[1],
    rest: trimmed.slice(numberMatch[1].length).trim(),
  };
}

function scaleAmountText(text: string, factor: number) {
  const parsed = parseLeadingAmount(text);

  if (!parsed) {
    return {
      text,
      scaled: false,
    };
  }

  const unit = parsed.rest.toLowerCase();
  const scaledValue = parsed.value * factor;

  if (unit.includes("gram")) {
    return {
      text: `${Math.round(scaledValue)} gram`,
      scaled: true,
    };
  }

  if (unit.includes("cl")) {
  return {
    text: `${Math.round(scaledValue)} cl`,
    scaled: true,
  };
}

  if (unit.includes("cc")) {
  return {
    text: `${Math.round(scaledValue)} cc`,
    scaled: true,
  };
}


  if (unit.includes("kg")) {
    return {
      text: `${formatNumber(scaledValue, 2)} kg`,
      scaled: true,
    };
  }

  if (unit.includes("liter")) {
    return {
      text: `${formatNumber(scaledValue, 2)} liter`,
      scaled: true,
    };
  }

  if (unit === "l") {
    return {
      text: `${formatNumber(scaledValue, 2)} l`,
      scaled: true,
    };
  }

  if (unit.includes("ml")) {
    return {
      text: `${Math.round(scaledValue)} ml`,
      scaled: true,
    };
  }

  if (unit.includes("theelepel")) {
    const rounded = Math.round(scaledValue * 2) / 2;
    return {
      text: `${formatNumber(rounded, 1)} theelepel`,
      scaled: true,
    };
  }

  if (unit.includes("eetlepel")) {
    const rounded = Math.round(scaledValue * 2) / 2;
    return {
      text: `${formatNumber(rounded, 1)} eetlepel`,
      scaled: true,
    };
  }

  if (unit.includes("blik")) {
    return {
      text: `${formatNumber(scaledValue, 2)} blik`,
      scaled: true,
    };
  }

  if (unit.includes("stuk")) {
    return {
      text: `${formatNumber(scaledValue, 1)} stuk`,
      scaled: true,
    };
  }

  if (unit.includes("potje")) {
    return {
      text: `${formatNumber(scaledValue, 1)} potje`,
      scaled: true,
    };
  }

  return {
    text,
    scaled: false,
  };
}

function getBatchOptions(basisLiters: number) {
  const all = [3, 3.5, 4, 4.5, 5];
  const withBasis = Array.from(new Set([...all, basisLiters])).sort((a, b) => a - b);
  return withBasis.filter((v) => v <= basisLiters);
}

export default function ReceptSchaalClient({
  basisLiters,
  ingredienten,
}: Props) {
  const [gekozenLiters, setGekozenLiters] = useState<number | null>(basisLiters);

  const factor = useMemo(() => {
    if (!basisLiters || !gekozenLiters) return 1;
    return gekozenLiters / basisLiters;
  }, [basisLiters, gekozenLiters]);

  const opties = useMemo(() => {
    if (!basisLiters) return [];
    return getBatchOptions(basisLiters);
  }, [basisLiters]);

  const scaledIngredienten = useMemo(() => {
    return ingredienten.map((ing) => {
      if (!basisLiters || !gekozenLiters || gekozenLiters === basisLiters) {
        return {
          ...ing,
          gewichtWeergave: ing.gewicht,
          scaled: false,
        };
      }

      const result = scaleAmountText(ing.gewicht, factor);

      return {
        ...ing,
        gewichtWeergave: result.text,
        scaled: result.scaled,
      };
    });
  }, [ingredienten, basisLiters, gekozenLiters, factor]);

  return (
    <section className="rounded-3xl bg-slate-50 p-5 md:p-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Benodigdheden</h2>

          {basisLiters && opties.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2 md:gap-3">
            {opties.map((liters) => {
              const actief = liters === gekozenLiters;

              return (
                <button
                  key={liters}
                  type="button"
                  onClick={() => setGekozenLiters(liters)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    actief
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {String(liters).replace(".", ",")}L
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {basisLiters ? (
        <p className="mt-3 text-sm text-slate-500">
          Uitgangspunt: {String(basisLiters).replace(".", ",")} liter mix
        </p>
      ) : null}

      {ingredienten.length === 0 ? (
        <p className="mt-4 text-base italic text-slate-400">
          Geen benodigdheden ingevuld.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {scaledIngredienten.map((ing, index) => (
            <li
              key={`${ing.naam}-${index}`}
              className="flex items-start justify-between gap-4 rounded-2xl bg-white px-4 py-4 text-lg shadow-sm"
            >
              <span className="font-medium text-slate-800">{ing.naam}</span>

              <div className="flex flex-col items-end">
                <span className="whitespace-nowrap font-semibold text-slate-900">
                  {ing.gewichtWeergave}
                </span>

                {!ing.scaled && basisLiters && gekozenLiters !== basisLiters ? (
                  <span className="mt-1 text-xs text-slate-400">origineel</span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}