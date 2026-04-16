import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";

function getViewportElement(): HTMLElement | null {
  return document.querySelector(".react-flow__viewport") as HTMLElement | null;
}

function exportFilter(node: HTMLElement): boolean {
  const className = (node as HTMLElement).className;
  if (typeof className === "string") {
    if (className.includes("react-flow__controls")) return false;
    if (className.includes("react-flow__minimap")) return false;
    if (className.includes("react-flow__background")) return false;
    if (className.includes("org-node__hover-btns")) return false;
  }
  return true;
}

export async function exportPng(filename: string = "orgchart.png"): Promise<void> {
  const viewport = getViewportElement();
  if (!viewport) throw new Error("Canvas not found");

  // Detect theme for background
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";
  const bg = isDark ? "#0f1117" : "#f5f6f8";

  const dataUrl = await toPng(viewport, {
    backgroundColor: bg,
    pixelRatio: 2,
    filter: exportFilter,
  });

  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

export async function exportPdf(filename: string = "orgchart.pdf"): Promise<void> {
  const viewport = getViewportElement();
  if (!viewport) throw new Error("Canvas not found");

  const isDark = document.documentElement.getAttribute("data-theme") !== "light";
  const bg = isDark ? "#0f1117" : "#f5f6f8";

  const dataUrl = await toPng(viewport, {
    backgroundColor: bg,
    pixelRatio: 2,
    filter: exportFilter,
  });

  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const img = new Image();
  await new Promise<void>((resolve) => {
    img.onload = () => resolve();
    img.src = dataUrl;
  });

  const margin = 10;
  const maxW = pageWidth - margin * 2;
  const maxH = pageHeight - margin * 2;
  const ratio = Math.min(maxW / img.width, maxH / img.height);
  const w = img.width * ratio;
  const h = img.height * ratio;
  const x = (pageWidth - w) / 2;
  const y = (pageHeight - h) / 2;

  pdf.addImage(dataUrl, "PNG", x, y, w, h);
  pdf.save(filename);
}
