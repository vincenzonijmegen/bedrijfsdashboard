'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import {
  format,
  eachDayOfInterval,
  parseISO,
  startOfMonth,
  endOfMonth,
} from 'date-fns';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function KasboekPage() {
  return <div className="p-4">Kasboek werkt 🎉</div>;
}
