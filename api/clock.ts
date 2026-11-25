import fs from "node:fs";
import path from "node:path";
import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Grand Complication Haute Horlogerie — Sousou no Frieren x Ubel Celestial Astrolabe Clock SVG
 * Live URL: https://fitzzxyz.vercel.app/api/clock?tz=Asia/Jakarta
 */

interface ZonedParts {
  h: number;
  m: number;
  s: number;
  weekday: string;
  day: string;
  month: string;
  year: string;
}

function loadFontB64(name: string): string {
  try {
    const p = path.join(process.cwd(), "assets", "fonts", name);
    return fs.readFileSync(p).toString("base64");
  } catch {
    return "";
  }
}

const CINZEL_600 = loadFontB64("cinzel-600.woff");
const CINZEL_800 = loadFontB64("cinzel-800.woff");
const CORMORANT_600 = loadFontB64("cormorant-600.woff");
const CORMORANT_500I = loadFontB64("cormorant-italic-500.woff");

const FONT_FACE_CSS = [
  CINZEL_600 && `@font-face{font-family:'Cinzel';font-style:normal;font-weight:600;src:url("data:font/woff;base64,${CINZEL_600}") format("woff");}`,
  CINZEL_800 && `@font-face{font-family:'Cinzel';font-style:normal;font-weight:800;src:url("data:font/woff;base64,${CINZEL_800}") format("woff");}`,
  CORMORANT_600 && `@font-face{font-family:'Cormorant';font-style:normal;font-weight:600;src:url("data:font/woff;base64,${CORMORANT_600}") format("woff");}`,
  CORMORANT_500I && `@font-face{font-family:'CormorantItalic';font-style:italic;font-weight:500;src:url("data:font/woff;base64,${CORMORANT_500I}") format("woff");}`,
]
  .filter(Boolean)
  .join("\n      ");

function getZonedParts(timeZone: string): ZonedParts {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(now)) {
    map[p.type] = p.value;
  }
  return {
    h: parseInt(map.hour ?? "0", 10) % 24,
    m: parseInt(map.minute ?? "0", 10),
    s: parseInt(map.second ?? "0", 10),
    weekday: map.weekday ?? "Monday",
    day: map.day ?? "01",
    month: map.month ?? "January",
    year: map.year ?? "2026",
  };
}

function discreteDigitGroup(
  x: number,
  y: number,
  count: number,
  durSec: number,
  offsetSec: number,
  cssClass: string,
  fill: string
): string {
  const keyTimes = Array.from({ length: count }, (_, k) => (k / count).toFixed(6)).join(";");
  let out = "";
  for (let d = 0; d < count; d++) {
    const vals = Array.from({ length: count }, (_, k) => (k === d ? "1" : "0")).join(";");
    out += `<text x="${x}" y="${y}" text-anchor="middle" class="${cssClass}" fill="${fill}" opacity="0">${d}<animate attributeName="opacity" values="${vals}" keyTimes="${keyTimes}" calcMode="discrete" dur="${durSec}s" begin="-${offsetSec}s" repeatCount="indefinite"/></text>`;
  }
  return out;
}

function discreteHourGroup(
  x1: number,
  x2: number,
  y: number,
  elapsedDaySec: number,
  cssClass: string,
  fill: string
): string {
  const keyTimes = Array.from({ length: 24 }, (_, k) => (k / 24).toFixed(6)).join(";");
  let out = "";
  for (let hr = 0; hr < 24; hr++) {
    const vals = Array.from({ length: 24 }, (_, k) => (k === hr ? "1" : "0")).join(";");
    const d1 = Math.floor(hr / 10);
    const d2 = hr % 10;
    out += `<g opacity="0"><text x="${x1}" y="${y}" text-anchor="middle" class="${cssClass}" fill="${fill}">${d1}</text><text x="${x2}" y="${y}" text-anchor="middle" class="${cssClass}" fill="${fill}">${d2}</text><animate attributeName="opacity" values="${vals}" keyTimes="${keyTimes}" calcMode="discrete" dur="86400s" begin="-${elapsedDaySec}s" repeatCount="indefinite"/></g>`;
  }
  return out;
}

export function buildClockSvg(tz = "Asia/Jakarta"): string {
  let parts: ZonedParts;
  let safeTz = tz;
  try {
    parts = getZonedParts(tz);
  } catch {
    safeTz = "Asia/Jakarta";
    parts = getZonedParts(safeTz);
  }

  const { h, m, s, weekday, day, month, year } = parts;
  const elapsedDay = h * 3600 + m * 60 + s;
  const elapsedHour = m * 60 + s;
  const elapsed10Min = (m % 10) * 60 + s;

  const secDeg = s * 6;
  const minDeg = m * 6 + s * 0.1;
  const hourDeg = (h % 12) * 30 + m * 0.5 + s * (0.5 / 60);

  const isDay = h >= 6 && h < 18;
  let phase = "Nocturnal Grimoire Study";
  let phaseCol = "#B399EE";
  if (h >= 5 && h < 11) {
    phase = "Dawn Expedition Watch";
    phaseCol = "#9CC084";
  } else if (h >= 11 && h < 15) {
    phase = "High Sun Meridian";
    phaseCol = "#E5C068";
  } else if (h >= 15 && h < 19) {
    phase = "Aureole Dusk Horizon";
    phaseCol = "#D4A843";
  }

  const cx = 112;
  const cy = 94;
  let dialTicks = "";
  for (let i = 0; i < 60; i++) {
    const a = (i * 6 - 90) * (Math.PI / 180);
    const isCard = i % 15 === 0;
    const isHour = i % 5 === 0;
    const r1 = isCard ? 54.5 : isHour ? 56.5 : 60;
    const r2 = 63.5;
    const x1 = (cx + Math.cos(a) * r1).toFixed(1);
    const y1 = (cy + Math.sin(a) * r1).toFixed(1);
    const x2 = (cx + Math.cos(a) * r2).toFixed(1);
    const y2 = (cy + Math.sin(a) * r2).toFixed(1);
    const col = isCard ? "#E5C068" : isHour ? "#9CC084" : "#D4A843";
    const op = isCard ? "1" : isHour ? "0.85" : "0.32";
    const sw = isCard ? "2.2" : isHour ? "1.4" : "0.75";
    dialTicks += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-opacity="${op}" stroke-width="${sw}" stroke-linecap="round"/>`;
  }

  const romans = ["XII", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI"];
  let romanSvg = "";
  for (let i = 0; i < 12; i++) {
    const a = (i * 30 - 90) * (Math.PI / 180);
    const rx = (cx + Math.cos(a) * 46.2).toFixed(1);
    const ry = (cy + Math.sin(a) * 46.2 + 3.1).toFixed(1);
    const cls = i % 3 === 0 ? "roman-card" : "roman-minor";
    romanSvg += `<text x="${rx}" y="${ry}" text-anchor="middle" class="${cls}">${romans[i]}</text>`;
  }

  const hoursSvg = discreteHourGroup(244, 270, 98, elapsedDay, "clock-digit", "#F4EFE6");
  const minTensSvg = discreteDigitGroup(314, 98, 6, 3600, elapsedHour, "clock-digit", "#F4EFE6");
  const minOnesSvg = discreteDigitGroup(340, 98, 10, 600, elapsed10Min, "clock-digit", "#F4EFE6");
  const secTensSvg = discreteDigitGroup(384, 98, 6, 60, s, "clock-digit-sec", "#9CC084");
  const secOnesSvg = discreteDigitGroup(410, 98, 10, 10, s % 10, "clock-digit-sec", "#9CC084");

  const t = elapsedDay / 86400;
  const orbX = (876 + 280 * t).toFixed(1);
  const orbY = (126 - 172 * t * (1 - t)).toFixed(1);
  const dayPctInt = Math.round(t * 100);
  const tzShort =
    safeTz === "Asia/Jakarta"
      ? "WIB"
      : (safeTz.split("/").pop() ?? "UTC").toUpperCase().slice(0, 6);
  const tzSub = safeTz === "Asia/Jakarta" ? "UTC +7" : safeTz;

  const celestialOrb = isDay
    ? `<circle cx="${orbX}" cy="${orbY}" r="12" fill="${phaseCol}" fill-opacity="0.24"><animate attributeName="r" values="8;16;8" dur="3.4s" repeatCount="indefinite"/><animate attributeName="fill-opacity" values="0.34;0.04;0.34" dur="3.4s" repeatCount="indefinite"/></circle><circle cx="${orbX}" cy="${orbY}" r="5.5" fill="#F4EFE6" stroke="${phaseCol}" stroke-width="1.8"/>`
    : `<circle cx="${orbX}" cy="${orbY}" r="12" fill="#B399EE" fill-opacity="0.24"><animate attributeName="r" values="8;16;8" dur="3.8s" repeatCount="indefinite"/><animate attributeName="fill-opacity" values="0.32;0.04;0.32" dur="3.8s" repeatCount="indefinite"/></circle><circle cx="${orbX}" cy="${orbY}" r="5.6" fill="#B399EE"/><circle cx="${(parseFloat(orbX) + 2.4).toFixed(1)}" cy="${(parseFloat(orbY) - 1.4).toFixed(1)}" r="4.5" fill="#131815"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 188" width="100%" height="100%">
  <defs>
    <linearGradient id="clk_bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0E1310"/>
      <stop offset="50%" stop-color="#131815"/>
      <stop offset="100%" stop-color="#16131E"/>
    </linearGradient>
    <linearGradient id="clk_border" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#D4A843" stop-opacity="0.62"/>
      <stop offset="50%" stop-color="#8BA872" stop-opacity="0.7"/>
      <stop offset="100%" stop-color="#A78BFA" stop-opacity="0.62"/>
    </linearGradient>
    <radialGradient id="dial_grad" cx="50%" cy="42%" r="58%">
      <stop offset="0%" stop-color="#1C251F"/>
      <stop offset="65%" stop-color="#0E1310"/>
      <stop offset="100%" stop-color="#080B09"/>
    </radialGradient>
    <linearGradient id="cell_bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#151C18"/>
      <stop offset="50%" stop-color="#0B0F0D"/>
      <stop offset="100%" stop-color="#131816"/>
    </linearGradient>
    <linearGradient id="arc_fill" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${phaseCol}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#0E1310" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="arc_prog" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#9CC084"/>
      <stop offset="100%" stop-color="${phaseCol}"/>
    </linearGradient>
    <clipPath id="clk_clip"><rect x="0" y="0" width="1200" height="188" rx="16"/></clipPath>
    <clipPath id="arc_trav_clip"><rect x="876" y="30" width="${(280 * t).toFixed(1)}" height="104"/></clipPath>
    <style>
      ${FONT_FACE_CSS}
      .cinzel { font-family: 'Cinzel', Georgia, serif; font-weight: 600; }
      .serif { font-family: 'Cormorant', Georgia, serif; font-weight: 600; }
      .folio { font-family: 'CormorantItalic', Georgia, serif; font-style: italic; font-weight: 500; }
      .roman-card { font-family: 'Cinzel', Georgia, serif; font-size: 8.8px; font-weight: 800; fill: #E5C068; }
      .roman-minor { font-family: 'Cinzel', Georgia, serif; font-size: 7.4px; font-weight: 600; fill: #8E887A; }
      .clock-digit { font-family: 'Cinzel', Georgia, serif; font-size: 32px; font-weight: 800; font-variant-numeric: tabular-nums; }
      .clock-digit-sec { font-family: 'Cinzel', Georgia, serif; font-size: 32px; font-weight: 800; font-variant-numeric: tabular-nums; }
      .unit-lbl { font-family: 'Cinzel', Georgia, serif; font-size: 7.5px; font-weight: 600; letter-spacing: 1.4px; fill: #8E887A; }
    </style>
  </defs>

  <rect x="0.5" y="0.5" width="1199" height="187" rx="15.5" fill="url(#clk_bg)" stroke="url(#clk_border)" stroke-width="1.2"/>
  <rect x="6.5" y="6.5" width="1187" height="175" rx="11" fill="none" stroke="#D4A843" stroke-width="0.7" stroke-opacity="0.28"/>
  <polygon points="16,12 20,16 16,20 12,16" fill="#D4A843" fill-opacity="0.65"/>
  <polygon points="1184,12 1188,16 1184,20 1180,16" fill="#D4A843" fill-opacity="0.65"/>
  <polygon points="16,176 20,172 16,168 12,172" fill="#D4A843" fill-opacity="0.65"/>
  <polygon points="1184,176 1188,172 1184,168 1180,172" fill="#D4A843" fill-opacity="0.65"/>

  <g clip-path="url(#clk_clip)">
    <circle cx="112" cy="94" r="96" fill="none" stroke="#D4A843" stroke-opacity="0.06" stroke-width="1"/>
    <circle cx="112" cy="94" r="73" fill="none" stroke="#D4A843" stroke-opacity="0.34" stroke-width="1" stroke-dasharray="3 6">
      <animateTransform attributeName="transform" type="rotate" from="0 112 94" to="360 112 94" dur="80s" repeatCount="indefinite"/>
    </circle>
    <circle cx="112" cy="94" r="68" fill="#0A0E0C" stroke="#D4A843" stroke-opacity="0.75" stroke-width="1.6"/>
    <circle cx="112" cy="94" r="64.5" fill="url(#dial_grad)" stroke="#8BA872" stroke-opacity="0.28" stroke-width="0.8"/>
    <circle cx="112" cy="94" r="53.5" fill="none" stroke="#D4A843" stroke-opacity="0.22" stroke-width="0.6"/>

    <g stroke="#D4A843" stroke-opacity="0.16" fill="none">
      <circle cx="112" cy="94" r="35" stroke-width="0.7" stroke-dasharray="8 4"/>
      <polygon points="112,63 116,90 143,94 116,98 112,125 108,98 81,94 108,90" stroke-width="0.6"/>
      <animateTransform attributeName="transform" type="rotate" from="360 112 94" to="0 112 94" dur="120s" repeatCount="indefinite"/>
    </g>

    <circle cx="112" cy="114" r="9.5" fill="#080B09" stroke="#D4A843" stroke-opacity="0.45" stroke-width="0.8"/>
    <g stroke="#E5C068" stroke-opacity="0.65" stroke-width="0.8" fill="none">
      <line x1="104" y1="114" x2="120" y2="114"/>
      <line x1="112" y1="106" x2="112" y2="122"/>
      <circle cx="112" cy="114" r="5.5" stroke-dasharray="3 2"/>
      <animateTransform attributeName="transform" type="rotate" from="0 112 114" to="360 112 114" dur="12s" repeatCount="indefinite"/>
    </g>
    <circle cx="112" cy="114" r="1.6" fill="#B399EE"/>

    ${dialTicks}
    ${romanSvg}

    <g>
      <polygon points="112,59 115.8,92 112,102 108.2,92" fill="#F4EFE6" stroke="#D4A843" stroke-width="0.5"/>
      <line x1="112" y1="65" x2="112" y2="90" stroke="#D4A843" stroke-width="0.7"/>
      <animateTransform attributeName="transform" type="rotate" from="${hourDeg.toFixed(2)} 112 94" to="${(hourDeg + 360).toFixed(2)} 112 94" dur="43200s" repeatCount="indefinite"/>
    </g>
    <g>
      <polygon points="112,41 114.6,92 112,104 109.4,92" fill="#9CC084" stroke="#0E1310" stroke-width="0.4"/>
      <line x1="112" y1="48" x2="112" y2="90" stroke="#F4EFE6" stroke-opacity="0.6" stroke-width="0.6"/>
      <animateTransform attributeName="transform" type="rotate" from="${minDeg.toFixed(2)} 112 94" to="${(minDeg + 360).toFixed(2)} 112 94" dur="3600s" repeatCount="indefinite"/>
    </g>
    <g>
      <line x1="112" y1="113" x2="112" y2="37" stroke="#E5C068" stroke-width="1.15" stroke-linecap="round"/>
      <circle cx="112" cy="108" r="2.6" fill="#0E1310" stroke="#E5C068" stroke-width="1.1"/>
      <animateTransform attributeName="transform" type="rotate" from="${secDeg.toFixed(2)} 112 94" to="${(secDeg + 360).toFixed(2)} 112 94" dur="60s" repeatCount="indefinite"/>
    </g>
    <circle cx="112" cy="94" r="4.6" fill="#E5C068"/>
    <circle cx="112" cy="94" r="2.3" fill="#B399EE"/>

    <circle cx="222" cy="38" r="3.6" fill="#9CC084">
      <animate attributeName="opacity" values="0.35;1;0.35" dur="2.2s" repeatCount="indefinite"/>
    </circle>
    <text x="234" y="42" class="cinzel" font-size="11.8" fill="#E5C068" letter-spacing="1.6">ASTRAL HOROLOGIUM  ·  ${safeTz.toUpperCase()}</text>

    <rect x="218" y="54" width="320" height="74" rx="10" fill="#090D0B" stroke="#D4A843" stroke-opacity="0.34" stroke-width="1.1"/>

    <rect x="228" y="62" width="58" height="46" rx="6" fill="url(#cell_bg)" stroke="#D4A843" stroke-opacity="0.24" stroke-width="0.8"/>
    <line x1="257" y1="64" x2="257" y2="106" stroke="#D4A843" stroke-opacity="0.12" stroke-width="0.8"/>
    ${hoursSvg}
    <text x="257" y="121" text-anchor="middle" class="unit-lbl">HOURS</text>

    <g fill="#E5C068">
      <polygon points="292,76 294.6,79 292,82 289.4,79"/>
      <polygon points="292,90 294.6,93 292,96 289.4,93"/>
      <animate attributeName="opacity" values="1;0.25;1" dur="1s" repeatCount="indefinite"/>
    </g>

    <rect x="298" y="62" width="58" height="46" rx="6" fill="url(#cell_bg)" stroke="#D4A843" stroke-opacity="0.24" stroke-width="0.8"/>
    <line x1="327" y1="64" x2="327" y2="106" stroke="#D4A843" stroke-opacity="0.12" stroke-width="0.8"/>
    ${minTensSvg}
    ${minOnesSvg}
    <text x="327" y="121" text-anchor="middle" class="unit-lbl">MINUTES</text>

    <g fill="#9CC084">
      <polygon points="362,76 364.6,79 362,82 359.4,79"/>
      <polygon points="362,90 364.6,93 362,96 359.4,93"/>
      <animate attributeName="opacity" values="1;0.25;1" dur="1s" repeatCount="indefinite"/>
    </g>

    <rect x="368" y="62" width="58" height="46" rx="6" fill="url(#cell_bg)" stroke="#9CC084" stroke-opacity="0.32" stroke-width="0.9"/>
    <line x1="397" y1="64" x2="397" y2="106" stroke="#9CC084" stroke-opacity="0.14" stroke-width="0.8"/>
    ${secTensSvg}
    ${secOnesSvg}
    <text x="397" y="121" text-anchor="middle" class="unit-lbl" fill="#9CC084">SECONDS</text>

    <line x1="438" y1="64" x2="438" y2="118" stroke="#D4A843" stroke-opacity="0.22" stroke-width="1"/>
    <text x="484" y="82" text-anchor="middle" class="cinzel" font-size="13.5" fill="#E5C068" letter-spacing="1.4">${tzShort}</text>
    <text x="484" y="101" text-anchor="middle" class="folio" font-size="14.5" fill="#9CC084">${tzSub}</text>
    <text x="484" y="121" text-anchor="middle" class="unit-lbl" fill="#E5C068">LIVE SYNC</text>

    <text x="220" y="154" class="folio" font-size="16" fill="#C8C2B4">${weekday}, ${day} ${month} ${year}  ·  <tspan fill="${phaseCol}">${phase}</tspan></text>

    <line x1="564" y1="28" x2="564" y2="160" stroke="#D4A843" stroke-opacity="0.24" stroke-width="1"/>

    <text x="590" y="42" class="cinzel" font-size="11.5" fill="#B399EE" letter-spacing="1.5">IMPERIAL ERA CHRONICLE</text>
    <text x="590" y="78" class="cinzel" font-size="20" fill="#F4EFE6">29 Years Post-Himmel</text>
    <line x1="590" y1="93" x2="836" y2="93" stroke="#D4A843" stroke-opacity="0.22" stroke-width="1"/>
    <text x="590" y="120" class="folio" font-size="14.5" fill="#8E887A">Mage Registry</text>
    <text x="836" y="120" text-anchor="end" class="serif" font-size="16" fill="#9CC084">Äußerst · First-Class</text>
    <text x="590" y="150" class="folio" font-size="14.5" fill="#8E887A">Destination</text>
    <text x="836" y="150" text-anchor="end" class="serif" font-size="16" fill="#E5C068">Aureole (Ende)</text>

    <line x1="860" y1="28" x2="860" y2="160" stroke="#D4A843" stroke-opacity="0.24" stroke-width="1"/>

    <text x="876" y="42" class="cinzel" font-size="11.5" fill="#9CC084" letter-spacing="1.4">CELESTIAL MERIDIAN</text>
    <text x="1156" y="42" text-anchor="end" class="folio" font-size="14.5" fill="#E5C068">${dayPctInt}% of cycle</text>

    <circle cx="912" cy="64" r="1.1" fill="#F4EFE6" opacity="0.5"><animate attributeName="opacity" values="0.2;0.85;0.2" dur="3.6s" repeatCount="indefinite"/></circle>
    <circle cx="968" cy="52" r="1.3" fill="#E5C068" opacity="0.6"><animate attributeName="opacity" values="0.3;0.9;0.3" dur="4.4s" begin="1.1s" repeatCount="indefinite"/></circle>
    <circle cx="1064" cy="54" r="1.1" fill="#B399EE" opacity="0.5"><animate attributeName="opacity" values="0.2;0.8;0.2" dur="3.9s" begin="2.0s" repeatCount="indefinite"/></circle>
    <circle cx="1118" cy="68" r="1.2" fill="#9CC084" opacity="0.5"><animate attributeName="opacity" values="0.25;0.85;0.25" dur="4.1s" begin="0.6s" repeatCount="indefinite"/></circle>

    <path d="M 876 126 Q 1016 40 1156 126 Z" fill="url(#arc_fill)"/>
    <path d="M 876 126 Q 1016 40 1156 126" fill="none" stroke="#D4A843" stroke-opacity="0.32" stroke-width="1.4" stroke-dasharray="4 4"/>
    <path d="M 876 126 Q 1016 40 1156 126" fill="none" stroke="url(#arc_prog)" stroke-width="2.2" clip-path="url(#arc_trav_clip)"/>

    <line x1="${orbX}" y1="${orbY}" x2="${orbX}" y2="126" stroke="${phaseCol}" stroke-opacity="0.45" stroke-width="1" stroke-dasharray="2 2"/>

    <line x1="876" y1="126" x2="1156" y2="126" stroke="#D4A843" stroke-opacity="0.32" stroke-width="1"/>
    <line x1="876" y1="122" x2="876" y2="130" stroke="#8E887A" stroke-width="1"/>
    <line x1="946" y1="122" x2="946" y2="130" stroke="#9CC084" stroke-width="1"/>
    <line x1="1016" y1="121" x2="1016" y2="131" stroke="#E5C068" stroke-width="1.3"/>
    <line x1="1086" y1="122" x2="1086" y2="130" stroke="#B399EE" stroke-width="1"/>
    <line x1="1156" y1="122" x2="1156" y2="130" stroke="#8E887A" stroke-width="1"/>
    ${celestialOrb}
    <text x="876" y="150" class="folio" font-size="13" fill="#8E887A">00:00</text>
    <text x="946" y="150" text-anchor="middle" class="folio" font-size="13" fill="#9CC084">Dawn</text>
    <text x="1016" y="150" text-anchor="middle" class="folio" font-size="13" fill="#E5C068">Noon</text>
    <text x="1086" y="150" text-anchor="middle" class="folio" font-size="13" fill="#B399EE">Dusk</text>
    <text x="1156" y="150" text-anchor="end" class="folio" font-size="13" fill="#8E887A">24:00</text>
  </g>
</svg>`;
}

export default function handler(req: VercelRequest, res: VercelResponse): VercelResponse {
  const rawTz = req.query?.tz;
  const tz = typeof rawTz === "string" && rawTz.length <= 64 ? rawTz : "Asia/Jakarta";
  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0, s-maxage=0");
  res.setHeader("CDN-Cache-Control", "no-store");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  return res.status(200).send(buildClockSvg(tz));
}
