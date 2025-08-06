// src/components/ScrollToTopButton.tsx
"use client";

import { ChevronUp } from "lucide-react";

export default function ScrollToTopButton() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="fixed bottom-6 left-6 z-50">
      <button
        onClick={scrollToTop}
        className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-2 rounded-full shadow-lg hover:from-blue-600 hover:to-purple-700"
      >
        <ChevronUp className="w-5 h-5" />
      </button>
    </div>
  );
}
