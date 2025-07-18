// src/app/admin/dashboard/head.tsx
import React from 'react';

export default function Head() {
  return (
    <>
      <title>Dashboard – Vincenzo</title>
      {/* Specifiek iPhone‐icoon voor deze subdir */}
      <link
        rel="apple-touch-icon"
        sizes="180x180"
        href="/icons/dashboard-apple-touch-icon.png"
      />
      {/* Optioneel eigen favicon voor deze subdir */}
      <link rel="icon" href="/icons/dashboard-favicon.ico" />
    </>
  );
}
