"use client";

import dynamic from "next/dynamic";
import React from "react";

const Editor = dynamic(() => import("../instructie"), {
  ssr: false,
  loading: () => (
    <div className="animate-pulse text-sm text-gray-500">Editor laden…</div>
  ),
});

export default Editor;
