"use client";

import { useEffect } from "react";

export default function PrintHelper() {
  useEffect(() => {
    // Wait a tiny bit for fonts to load, then open the print dialog
    setTimeout(() => {
      window.print();
    }, 500);
  }, []);

  return null; // This component doesn't render anything visible
}
