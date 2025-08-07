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

// ... rest blijft ongewijzigd (dit is alleen de typefix)
