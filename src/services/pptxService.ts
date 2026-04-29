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

// ── Constants (inches) ───────────────────────────────────────

const SLIDE_W = 13.33; // 16:9
const SLIDE_H = 7.5;

const BOX_W = 2.2;
const BOX_H_BASE = 0.5;
const BOX_LINE_H = 0.18;
const BOX_GAP_X = 0.25;
const BOX_GAP_Y = 0.45;
const BOX_INDENT = 0.3;

const LEFT_AREA_W = 5.5;
const RIGHT_X = 6.0;
const RIGHT_W = 6.8;

const COLORS = {
  border: "B0B4BC",
  borderHighlight: "3B7ADE",
  bgHighlight: "E8EFFF",
  bgNormal: "F0F1F3",
  bgStaff: "F0F1F3",
  borderStaff: "555968",
  textPrimary: "1A1C22",
  textSecondary: "555968",
  textAccent: "3B7ADE",
  textMuted: "888C9A",
  line: "B0B4BC",
};

// ── Helpers ──────────────────────────────────────────────────

function getName(node: OrgNode, lang: string, dominantLang: string): string {
  return node.translations[lang]?.name ?? node.translations[dominantLang]?.name ?? node.id;
}

function getPersonNames(node: OrgNode, people: Person[]): string {
  return (node.assignedPeople ?? [])
    .map((uid) => people.find((p) => p.uid === uid))
    .filter(Boolean)
    .map((p) => `${p!.firstName} ${p!.lastName}`.trim())
    .join(", ");
}

function getTagNames(node: OrgNode, settings: ProjectSettings): string {
  return (node.tags ?? [])
    .map((tid) => settings.tags.find((t) => t.id === tid)?.name)
    .filter(Boolean)
    .join(", ");
}

function getT(node: OrgNode, lang: string): TranslationEntry | null {
  return node.translations[lang] ?? null;
}

// ── Estimate box height ──────────────────────────────────────

function estimateBoxH(node: OrgNode, ctx: ExportContext): number {
  let h = BOX_H_BASE; // name line
  const count = (node.assignedPeople?.length ?? 0) > 1 ? ` (${node.assignedPeople.length})` : "";
  if (ctx.showNames) {
    const names = getPersonNames(node, ctx.people);
    if (names) h += BOX_LINE_H;
  }
  const t = getT(node, ctx.activeLanguage);
  if (t?.description) h += BOX_LINE_H;
  const tags = getTagNames(node, ctx.settings);
  if (tags) h += BOX_LINE_H;
  return h;
}

// ── Draw a node box on a slide ───────────────────────────────

function drawNodeBox(
  slide: PptxGenJS.Slide,
  node: OrgNode,
  x: number,
  y: number,
  w: number,
  h: number,
  ctx: ExportContext,
  highlighted: boolean = false,
  isStaff: boolean = false
) {
  const lang = ctx.activeLanguage;
  const dominantLang = ctx.settings.dominantLanguage;

  // Box background
  slide.addShape("rect", {
    x, y, w, h,
    fill: { color: highlighted ? COLORS.bgHighlight : COLORS.bgNormal },
    line: {
      color: highlighted ? COLORS.borderHighlight : isStaff ? COLORS.borderStaff : COLORS.border,
      width: highlighted ? 1.5 : 0.75,
    },
    rectRadius: 0.05,
  });

  // Staff badge
  if (isStaff) {
    slide.addText("STAFF", {
      x: x + w - 0.55, y: y - 0.08, w: 0.5, h: 0.16,
      fontSize: 6, bold: true, color: COLORS.textSecondary,
      align: "center",
    });
  }

  // Text content
  let ty = y + 0.06;
  const name = getName(node, lang, dominantLang);
  const count = (node.assignedPeople?.length ?? 0) > 1 ? ` (${node.assignedPeople.length})` : "";

  // Name
  slide.addText(name + count, {
    x: x + 0.08, y: ty, w: w - 0.16, h: BOX_LINE_H + 0.08,
    fontSize: 9, bold: true, color: COLORS.textPrimary,
    align: "center", valign: "middle",
    shrinkText: true,
  });
  ty += BOX_LINE_H + 0.06;

  // Person names
  if (ctx.showNames) {
    const pnames = getPersonNames(node, ctx.people);
    if (pnames) {
      slide.addText(pnames, {
        x: x + 0.08, y: ty, w: w - 0.16, h: BOX_LINE_H,
        fontSize: 7, color: COLORS.textAccent,
        align: "center", valign: "middle",
        shrinkText: true,
      });
      ty += BOX_LINE_H;
    }
  }

  // Description
  const t = getT(node, lang);
  if (t?.description) {
    slide.addText(t.description, {
      x: x + 0.08, y: ty, w: w - 0.16, h: BOX_LINE_H,
      fontSize: 7, color: COLORS.textSecondary,
      align: "center", valign: "middle",
      shrinkText: true,
    });
    ty += BOX_LINE_H;
  }

  // Tags
  const tags = getTagNames(node, ctx.settings);
  if (tags) {
    slide.addText(tags, {
      x: x + 0.08, y: ty, w: w - 0.16, h: BOX_LINE_H,
      fontSize: 6, italic: true, color: COLORS.textMuted,
      align: "center", valign: "middle",
    });
  }
}

// ── Draw connection line ─────────────────────────────────────

function drawLine(
  slide: PptxGenJS.Slide,
  fromX: number, fromY: number,
  toX: number, toY: number
) {
  const midY = (fromY + toY) / 2;

  // Vertical from source down to mid
  if (Math.abs(fromY - midY) > 0.01) {
    slide.addShape("line", {
      x: fromX, y: fromY, w: 0, h: midY - fromY,
      line: { color: COLORS.line, width: 0.75 },
    });
  }

  // Horizontal at mid
  const lx = Math.min(fromX, toX);
  const rx = Math.max(fromX, toX);
  if (Math.abs(lx - rx) > 0.01) {
    slide.addShape("line", {
      x: lx, y: midY, w: rx - lx, h: 0,
      line: { color: COLORS.line, width: 0.75 },
    });
  }

  // Vertical from mid down to target
  if (Math.abs(midY - toY) > 0.01) {
    slide.addShape("line", {
      x: toX, y: midY, w: 0, h: toY - midY,
      line: { color: COLORS.line, width: 0.75 },
    });
  }
}

// ── Build node slide (left: mini-org, right: role fields) ────

function buildNodeSlide(
  pptx: PptxGenJS,
  node: OrgNode,
  ctx: ExportContext
) {
  const { nodes, people, settings, activeLanguage, showNames } = ctx;
  const dominantLang = settings.dominantLanguage;
  const slide = pptx.addSlide();

  const name = getName(node, activeLanguage, dominantLang);
  const count = (node.assignedPeople?.length ?? 0) > 1 ? ` (${node.assignedPeople.length})` : "";

  // Title
  slide.addText(name + count, {
    x: 0.4, y: 0.2, w: 12, h: 0.45,
    fontSize: 18, bold: true, color: COLORS.textPrimary,
  });

  // Subtitle: person names
  if (showNames) {
    const pnames = getPersonNames(node, people);
    if (pnames) {
      slide.addText(pnames, {
        x: 0.4, y: 0.6, w: 12, h: 0.25,
        fontSize: 10, color: COLORS.textAccent,
      });
    }
  }

  // ── Left: mini-orgchart with native shapes ──

  const parent = node.parentId ? nodes.find((n) => n.id === node.parentId) : null;
  const children = nodes.filter((n) => n.parentId === node.id).sort((a, b) => a.order - b.order);

  const isVertical = node.childrenLayout === "vertical";

  let curY = 1.0;
  const leftX = 0.4;

  // Parent box
  if (parent) {
    const ph = estimateBoxH(parent, ctx);
    drawNodeBox(slide, parent, leftX, curY, BOX_W, ph, ctx, false, parent.isStaff);
    const parentCenterX = leftX + BOX_W / 2;
    const parentBottom = curY + ph;
    curY += ph + BOX_GAP_Y;

    // Line parent → main
    const mainCenterX = leftX + BOX_W / 2;
    drawLine(slide, parentCenterX, parentBottom, mainCenterX, curY);
  }

  // Main (highlighted) box
  const mainH = estimateBoxH(node, ctx);
  drawNodeBox(slide, node, leftX, curY, BOX_W, mainH, ctx, true, node.isStaff);
  const mainCenterX = leftX + BOX_W / 2;
  const mainBottom = curY + mainH;
  curY += mainH + BOX_GAP_Y;

  // Children
  if (children.length > 0) {
    if (isVertical) {
      // Vertical children — stacked with indent
      for (const child of children) {
        const ch = estimateBoxH(child, ctx);
        const childX = leftX + BOX_INDENT;
        drawLine(slide, mainCenterX, mainBottom, childX + BOX_W / 2 - BOX_INDENT, curY);
        drawNodeBox(slide, child, childX, curY, BOX_W - BOX_INDENT, ch, ctx, false, child.isStaff);
        curY += ch + 0.12;
      }
    } else {
      // Horizontal children — side by side
      const childW = Math.min(BOX_W, (LEFT_AREA_W - 0.4) / Math.max(children.length, 1) - BOX_GAP_X);
      const totalChildrenW = children.length * childW + (children.length - 1) * BOX_GAP_X;
      let cx = leftX + (BOX_W - totalChildrenW) / 2;
      if (cx < 0.2) cx = 0.2;

      for (const child of children) {
        const ch = estimateBoxH(child, ctx);
        const childCenterX = cx + childW / 2;
        drawLine(slide, mainCenterX, mainBottom, childCenterX, curY);
        drawNodeBox(slide, child, cx, curY, childW, ch, ctx, false, child.isStaff);
        cx += childW + BOX_GAP_X;
      }
    }
  }

  // ── Right: role fields ──

  const ROLE_FIELDS: { key: keyof TranslationEntry; label: string }[] = [
    { key: "mandate", label: "Mandate" },
    { key: "responsibility", label: "Responsibility" },
    { key: "authority", label: "Authority" },
    { key: "tasks", label: "Tasks" },
    { key: "kpi", label: "KPI" },
  ];

  const t = getT(node, activeLanguage);
  let fieldY = 1.0;

  for (const field of ROLE_FIELDS) {
    const value = (t as any)?.[field.key] as string | undefined;
    if (!value?.trim()) continue;

    // Label
    slide.addText(field.label, {
      x: RIGHT_X, y: fieldY, w: RIGHT_W, h: 0.25,
      fontSize: 10, bold: true, color: COLORS.textAccent,
    });
    fieldY += 0.25;

    // Value — estimate height based on text length
    const charPerLine = 90;
    const lines = value.split("\n").reduce((acc, line) => acc + Math.max(1, Math.ceil(line.length / charPerLine)), 0);
    const textH = Math.max(0.25, lines * 0.18);

    slide.addText(value, {
      x: RIGHT_X, y: fieldY, w: RIGHT_W, h: textH,
      fontSize: 9, color: COLORS.textPrimary,
      valign: "top",
      paraSpaceBefore: 2,
      lineSpacingMultiple: 1.15,
    });
    fieldY += textH + 0.15;
  }

  if (fieldY === 1.0) {
    slide.addText("No role details defined", {
      x: RIGHT_X, y: 2.5, w: RIGHT_W, h: 0.3,
      fontSize: 10, italic: true, color: COLORS.textMuted,
    });
  }
}

// ── Capture canvas for overview slide ────────────────────────

async function captureCanvasLightPng(): Promise<string> {
  const viewport = document.querySelector(".react-flow__viewport") as HTMLElement;
  if (!viewport) throw new Error("Canvas not found");

  const currentTheme = document.documentElement.getAttribute("data-theme");
  document.documentElement.setAttribute("data-theme", "light");
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

  if (currentTheme) document.documentElement.setAttribute("data-theme", currentTheme);
  else document.documentElement.removeAttribute("data-theme");

  return dataUrl;
}

// ── Main export ──────────────────────────────────────────────

export async function exportPptx(
  projectName: string,
  ctx: ExportContext,
  filename: string = "orgchart.pptx"
): Promise<void> {
  const { nodes } = ctx;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";

  // Slide 1: overview PNG
  const overviewSlide = pptx.addSlide();
  overviewSlide.addText(projectName, {
    x: 0.5, y: 0.2, w: 9, h: 0.5,
    fontSize: 20, bold: true, color: COLORS.textPrimary,
  });

  try {
    const fullPng = await captureCanvasLightPng();
    overviewSlide.addImage({
      data: fullPng,
      x: 0.3, y: 0.8, w: 12.5, h: 6.2,
      sizing: { type: "contain", w: 12.5, h: 6.2 },
    });
  } catch {
    overviewSlide.addText("Overview image could not be generated", {
      x: 1, y: 3, w: 8, fontSize: 14, color: COLORS.textMuted,
    });
  }

  // Slides 2+: one per node, sorted by depth
  const sorted = [...nodes].sort((a, b) => {
    const dA = getDepth(nodes, a.id);
    const dB = getDepth(nodes, b.id);
    if (dA !== dB) return dA - dB;
    return a.order - b.order;
  });

  for (const node of sorted) {
    buildNodeSlide(pptx, node, ctx);
  }

  await pptx.writeFile({ fileName: filename });
}

function getDepth(nodes: OrgNode[], nodeId: string): number {
  let d = 0;
  let c = nodes.find((n) => n.id === nodeId);
  while (c?.parentId) { d++; c = nodes.find((n) => n.id === c!.parentId); }
  return d;
}
