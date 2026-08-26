/**
 * Client-side PDF text extraction using pdf.js.
 * Extracts all text from a PDF file and returns it as a plain string
 * suitable for Cadence's ingestion pipeline.
 */

import * as pdfjsLib from "pdfjs-dist";

// Set worker source to CDN (avoids bundling the worker)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

/**
 * Extract text from a PDF File object.
 * Returns the full text content of all pages, concatenated.
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const textParts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    // Group text items by their y-position to reconstruct lines
    const lines: string[] = [];
    let currentLine = "";
    let lastY = -1;

    for (const item of content.items) {
      if ("str" in item) {
        const y = item.transform[5];
        // New line if y-position changes significantly
        if (lastY !== -1 && Math.abs(y - lastY) > 2) {
          if (currentLine.trim()) lines.push(currentLine.trim());
          currentLine = "";
        }
        currentLine += item.str;
        lastY = y;
      }
    }
    if (currentLine.trim()) lines.push(currentLine.trim());

    textParts.push(lines.join("\n"));
  }

  return textParts.join("\n\n");
}

/**
 * Validate that a file is a PDF.
 */
export function isPDF(file: File): boolean {
  return (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}
