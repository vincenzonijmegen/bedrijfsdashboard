// src/app/admin/contacten/CollapsibleGroup.tsx
"use client";

import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface Props {
  title: string;
  colorClass: string;
  children: React.ReactNode;
}

export default function CollapsibleGroup({ title, colorClass, children }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border rounded">
      <button
        onClick={() => setOpen(o => !o)}
        className={`${colorClass} w-full text-left px-4 py-2 text-white flex justify-between items-center`}
      >
        <span>{title}</span>
        {open ? <ChevronDown /> : <ChevronRight />}
      </button>
      {open && <div className="p-4 bg-white">{children}</div>}
    </div>
  );
}
