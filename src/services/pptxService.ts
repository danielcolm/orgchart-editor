import PptxGenJS from "pptxgenjs";
import { toPng } from "html-to-image";
import type { OrgNode, Relation, Person, ProjectSettings, TranslationEntry } from "@/types/project";

// ── Types ────────────────────────────────────────────────────

interface ExportContext {
  nodes: OrgNode[];
  relations: Relation[];
  people: Person[];
  settings: ProjectSettings;
  activeLanguage: string;
  showNames: boolean;
}

// ── Helpers ──────────────────────────────────────────────────

function getNodeName(node: OrgNode, lang: string, dominantLang: string): string {
  return node.translations[lang]?.name ?? node.translations[dominantLang]?.name ?? node.id;
}

function getPersonNames(node: OrgNode, people: Person[]): string {
  return (node.assignedPeople ?? [])
    .map((uid) => people.find((p) => p.uid === uid))
    .filter(Boolean)
    .map((p) => `${p!.firstName} ${p!.lastName}`.trim())
    .join(", ");
}

function getTranslation(node: OrgNode, lang: string): TranslationEntry | null {
  return node.translations[lang] ?? null;
}

// ── Capture full canvas as PNG (light theme) ─────────────────

async function captureCanvasAsLightPng(): Promise<string> {
  const viewport = document.querySelector(".react-flow__viewport") as HTMLElement;
  if (!viewport) throw new Error("Canvas not found");

  // Temporarily switch to light theme
  const currentTheme = document.documentElement.getAttribute("data-theme");
  document.documentElement.setAttribute("data-theme", "light");

  // Wait for repaint
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  const dataUrl = await toPng(viewport, {
    backgroundColor: "transparent",
    pixelRatio: 2,
    filter: (node) => {
      const cn = (node as HTMLElement).className;
      if (typeof cn === "string") {
        if (cn.includes("react-flow__controls")) return false;
        if (cn.includes("react-flow__minimap")) return false;
        if (cn.includes("react-flow__background")) return false;
        if (cn.includes("org-node__hover-btns")) return false;
      }
      return true;
    },
  });

  // Restore theme
  if (currentTheme) document.documentElement.setAttribute("data-theme", currentTheme);
  else document.documentElement.removeAttribute("data-theme");

  return dataUrl;
}

// ── Build mini-orgchart as canvas and export PNG ─────────────

function buildMiniOrgchartSvg(
  node: OrgNode,
  ctx: ExportContext
): string {
  const { nodes, people, activeLanguage, settings, showNames } = ctx;
  const dominantLang = settings.dominantLanguage;

  const parent = node.parentId ? nodes.find((n) => n.id === node.parentId) : null;
  const children = nodes.filter((n) => n.parentId === node.id).sort((a, b) => a.order - b.order);
  const staffChildren = children.filter((c) => c.isStaff);
  const regularChildren = children.filter((c) => !c.isStaff);

  const BOX_W = 160;
  const BOX_H_BASE = 36;
  const LINE_H = 14;
  const GAP_X = 12;
  const GAP_Y = 40;
  const PADDING = 20;

  function estimateBoxHeight(n: OrgNode): number {
    let h = BOX_H_BASE;
    if (showNames) {
      const names = getPersonNames(n, people);
      if (names) h += LINE_H;
    }
    const t = getTranslation(n, activeLanguage);
    if (t?.description) h += LINE_H;
    return h;
  }

  // Determine layout
  const isVerticalChildren = node.childrenLayout === "vertical";
  const isVerticalStaff = node.staffLayout === "vertical";

  // Collect all visible child nodes
  const allChildren = [...staffChildren, ...regularChildren];

  // Calculate positions
  interface BoxInfo {
    node: OrgNode;
    x: number;
    y: number;
    w: number;
    h: number;
    isHighlighted: boolean;
    isStaff: boolean;
  }

  const boxes: BoxInfo[] = [];
  let totalW = 0;
  let totalH = 0;

  // Parent box
  let parentBox: BoxInfo | null = null;
  let nodeY = PADDING;

  if (parent) {
    const ph = estimateBoxHeight(parent);
    parentBox = {
      node: parent, x: 0, y: nodeY, w: BOX_W, h: ph,
      isHighlighted: false, isStaff: false,
    };
    nodeY += ph + GAP_Y;
  }

  // Main node
  const mainH = estimateBoxHeight(node);
  const mainBox: BoxInfo = {
    node, x: 0, y: nodeY, w: BOX_W, h: mainH,
    isHighlighted: true, isStaff: false,
  };
  boxes.push(mainBox);
  nodeY += mainH + GAP_Y;

  // Children
  const childBoxes: BoxInfo[] = [];
  if (allChildren.length > 0) {
    if (isVerticalChildren && isVerticalStaff || (!isVerticalChildren && !isVerticalStaff)) {
      // All same layout
      const isVert = isVerticalChildren;
      if (isVert) {
        let cy = nodeY;
        for (const child of allChildren) {
          const ch = estimateBoxHeight(child);
          childBoxes.push({
            node: child, x: PADDING, y: cy, w: BOX_W - 20, h: ch,
            isHighlighted: false, isStaff: child.isStaff,
          });
          cy += ch + 8;
        }
        nodeY = cy;
      } else {
        // Horizontal
        const rowW = allChildren.length * (BOX_W + GAP_X) - GAP_X;
        let cx = -(rowW / 2) + BOX_W / 2;
        for (const child of allChildren) {
          const ch = estimateBoxHeight(child);
          childBoxes.push({
            node: child, x: cx, y: nodeY, w: BOX_W, h: ch,
            isHighlighted: false, isStaff: child.isStaff,
          });
          cx += BOX_W + GAP_X;
        }
        nodeY += Math.max(...childBoxes.map((b) => b.h)) + GAP_Y;
      }
    } else {
      // Mixed: staff one way, regular another
      let cy = nodeY;
      const vertGroup = isVerticalStaff ? staffChildren : regularChildren;
      const horizGroup = isVerticalStaff ? regularChildren : staffChildren;

      if (vertGroup.length > 0) {
        for (const child of vertGroup) {
          const ch = estimateBoxHeight(child);
          childBoxes.push({
            node: child, x: -(BOX_W / 2 + GAP_X / 2), y: cy, w: BOX_W - 20, h: ch,
            isHighlighted: false, isStaff: child.isStaff,
          });
          cy += ch + 8;
        }
      }

      if (horizGroup.length > 0) {
        const rowW = horizGroup.length * (BOX_W + GAP_X) - GAP_X;
        let cx = BOX_W / 2 + GAP_X;
        const horizY = nodeY;
        for (const child of horizGroup) {
          const ch = estimateBoxHeight(child);
          childBoxes.push({
            node: child, x: cx, y: horizY, w: BOX_W, h: ch,
            isHighlighted: false, isStaff: child.isStaff,
          });
          cx += BOX_W + GAP_X;
        }
        cy = Math.max(cy, horizY + Math.max(...horizGroup.map((c) => estimateBoxHeight(c))) + GAP_Y);
      }
      nodeY = cy;
    }
  }

  // Calculate bounds
  const allBoxes = [parentBox, mainBox, ...childBoxes].filter(Boolean) as BoxInfo[];
  const minX = Math.min(...allBoxes.map((b) => b.x - b.w / 2)) - PADDING;
  const maxX = Math.max(...allBoxes.map((b) => b.x + b.w / 2)) + PADDING;
  const minY = Math.min(...allBoxes.map((b) => b.y)) - PADDING;
  const maxY = Math.max(...allBoxes.map((b) => b.y + b.h)) + PADDING;
  totalW = maxX - minX;
  totalH = maxY - minY;

  // Offset all boxes so minX = 0
  const offsetX = -minX;
  const offsetY = -minY;

  // Build SVG
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}">`;
  svg += `<style>
    text { font-family: "Segoe UI", system-ui, sans-serif; fill: #1a1c22; }
    .box { fill: #f0f1f3; stroke: #d1d3d9; stroke-width: 1; rx: 6; }
    .box-hl { fill: #e8efff; stroke: #3b7ade; stroke-width: 2; rx: 6; }
    .box-staff { fill: #f0f1f3; stroke: #555968; stroke-width: 1; rx: 6; }
    .name { font-size: 11px; font-weight: 600; }
    .person { font-size: 9px; fill: #3b7ade; }
    .desc { font-size: 9px; fill: #555968; }
    .staff-badge { font-size: 7px; fill: #555968; font-weight: 700; text-transform: uppercase; }
    .line { stroke: #d1d3d9; stroke-width: 1; fill: none; }
  </style>`;

  function renderBox(b: BoxInfo) {
    const bx = b.x + offsetX - b.w / 2;
    const by = b.y + offsetY;
    const cls = b.isHighlighted ? "box-hl" : b.isStaff ? "box-staff" : "box";
    svg += `<rect class="${cls}" x="${bx}" y="${by}" width="${b.w}" height="${b.h}" />`;

    let ty = by + 16;
    const name = getNodeName(b.node, activeLanguage, dominantLang);
    const count = (b.node.assignedPeople?.length ?? 0) > 1 ? ` (${b.node.assignedPeople.length})` : "";
    svg += `<text class="name" x="${bx + b.w / 2}" y="${ty}" text-anchor="middle">${escXml(name)}${count}</text>`;
    ty += LINE_H;

    if (showNames) {
      const pnames = getPersonNames(b.node, people);
      if (pnames) {
        svg += `<text class="person" x="${bx + b.w / 2}" y="${ty}" text-anchor="middle">${escXml(pnames.length > 30 ? pnames.substring(0, 28) + "..." : pnames)}</text>`;
        ty += LINE_H;
      }
    }

    const t = getTranslation(b.node, activeLanguage);
    if (t?.description) {
      svg += `<text class="desc" x="${bx + b.w / 2}" y="${ty}" text-anchor="middle">${escXml(t.description.length > 30 ? t.description.substring(0, 28) + "..." : t.description)}</text>`;
    }

    if (b.isStaff) {
      svg += `<text class="staff-badge" x="${bx + b.w - 4}" y="${by + 10}" text-anchor="end">STAFF</text>`;
    }
  }

  // Draw connection lines
  function drawLine(fromX: number, fromY: number, toX: number, toY: number) {
    const midY = (fromY + toY) / 2;
    svg += `<path class="line" d="M ${fromX + offsetX} ${fromY + offsetY} L ${fromX + offsetX} ${midY + offsetY} L ${toX + offsetX} ${midY + offsetY} L ${toX + offsetX} ${toY + offsetY}" />`;
  }

  // Parent → main
  if (parentBox) {
    renderBox(parentBox);
    drawLine(parentBox.x, parentBox.y + parentBox.h, mainBox.x, mainBox.y);
  }

  // Main
  renderBox(mainBox);

  // Main → children
  for (const cb of childBoxes) {
    renderBox(cb);
    drawLine(mainBox.x, mainBox.y + mainBox.h, cb.x, cb.y);
  }

  svg += `</svg>`;
  return svg;
}

function escXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Convert SVG to PNG data URL ──────────────────────────────

async function svgToDataUrl(svgStr: string, scale: number = 2): Promise<string> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgStr], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx2d = canvas.getContext("2d")!;
      ctx2d.scale(scale, scale);
      ctx2d.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("SVG render failed")); };
    img.src = url;
  });
}

// ── Main export function ─────────────────────────────────────

export async function exportPptx(
  projectName: string,
  ctx: ExportContext,
  filename: string = "orgchart.pptx"
): Promise<void> {
  const { nodes, people, settings, activeLanguage, showNames } = ctx;
  const dominantLang = settings.dominantLanguage;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 16:9

  // ── Slide 1: Full orgchart overview ──
  const overviewSlide = pptx.addSlide();
  overviewSlide.addText(projectName, {
    x: 0.5, y: 0.2, w: 9, h: 0.5,
    fontSize: 20, bold: true, color: "1a1c22",
  });

  try {
    const fullPng = await captureCanvasAsLightPng();
    overviewSlide.addImage({
      data: fullPng,
      x: 0.3, y: 0.8, w: 12.5, h: 6.2,
      sizing: { type: "contain", w: 12.5, h: 6.2 },
    });
  } catch (err) {
    overviewSlide.addText("Overview image could not be generated", {
      x: 1, y: 3, w: 8, fontSize: 14, color: "888888",
    });
  }

  // ── Slides 2+: One per node ──
  // Sort nodes by depth (root first)
  const sortedNodes = [...nodes].sort((a, b) => {
    const dA = getDepth(nodes, a.id);
    const dB = getDepth(nodes, b.id);
    if (dA !== dB) return dA - dB;
    return a.order - b.order;
  });

  for (const node of sortedNodes) {
    const slide = pptx.addSlide();
    const name = getNodeName(node, activeLanguage, dominantLang);
    const t = getTranslation(node, activeLanguage);
    const count = (node.assignedPeople?.length ?? 0) > 1 ? ` (${node.assignedPeople.length})` : "";

    // Title
    slide.addText(name + count, {
      x: 0.5, y: 0.2, w: 12, h: 0.5,
      fontSize: 18, bold: true, color: "1a1c22",
    });

    // Subtitle: person names if showNames
    if (showNames) {
      const personNames = getPersonNames(node, people);
      if (personNames) {
        slide.addText(personNames, {
          x: 0.5, y: 0.6, w: 12, h: 0.3,
          fontSize: 11, color: "3b7ade",
        });
      }
    }

    // Left: mini-orgchart as SVG → PNG
    try {
      const svgStr = buildMiniOrgchartSvg(node, ctx);
      const miniPng = await svgToDataUrl(svgStr);
      slide.addImage({
        data: miniPng,
        x: 0.3, y: 1.0, w: 5.5, h: 5.8,
        sizing: { type: "contain", w: 5.5, h: 5.8 },
      });
    } catch (err) {
      slide.addText("Mini chart could not be generated", {
        x: 0.5, y: 3, w: 5, fontSize: 10, color: "888888",
      });
    }

    // Right: role fields
    const ROLE_FIELDS: { key: keyof TranslationEntry; label: string }[] = [
      { key: "mandate", label: "Mandate" },
      { key: "responsibility", label: "Responsibility" },
      { key: "authority", label: "Authority" },
      { key: "tasks", label: "Tasks" },
      { key: "kpi", label: "KPI" },
    ];

    let fieldY = 1.0;
    for (const field of ROLE_FIELDS) {
      const value = (t as any)?.[field.key] as string | undefined;
      if (!value?.trim()) continue;

      // Field label
      slide.addText(field.label, {
        x: 6.2, y: fieldY, w: 6.5, h: 0.3,
        fontSize: 10, bold: true, color: "3b7ade",
      });
      fieldY += 0.3;

      // Field value
      const lines = Math.ceil(value.length / 80);
      const textH = Math.max(0.3, lines * 0.22);
      slide.addText(value, {
        x: 6.2, y: fieldY, w: 6.5, h: textH,
        fontSize: 10, color: "1a1c22",
        valign: "top",
      });
      fieldY += textH + 0.15;
    }

    // If no fields, show a note
    if (fieldY === 1.0) {
      slide.addText("No role details defined", {
        x: 6.2, y: 2, w: 6, fontSize: 10, color: "888888", italic: true,
      });
    }
  }

  // Save
  await pptx.writeFile({ fileName: filename });
}

function getDepth(nodes: OrgNode[], nodeId: string): number {
  let depth = 0;
  let current = nodes.find((n) => n.id === nodeId);
  while (current?.parentId) {
    depth++;
    current = nodes.find((n) => n.id === current!.parentId);
  }
  return depth;
}
