/**
 * Real-Time Sousou no Frieren x Ubel Celestial Astrolabe Clock SVG Endpoint (Vercel Serverless).
 * Deploy FitzzXYZ to Vercel and embed:
 *   <img src="https://<your-app>.vercel.app/api/clock?tz=Asia/Jakarta" width="100%" />
 * Serves exact server time with no-cache headers + pure SVG SMIL ticking analog hands & digital seconds.
 */

function getZonedParts(timeZone) {
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
  const map = {};
  for (const p of fmt.formatToParts(now)) {
    map[p.type] = p.value;
  }
  const h = parseInt(map.hour, 10) % 24;
  const m = parseInt(map.minute, 10);
  const s = parseInt(map.second, 10);
  return {
    h,
    m,
    s,
    weekday: map.weekday,
    day: map.day,
    month: map.month,
    year: map.year,
  };
}

function buildClockSvg(tz = "Asia/Jakarta") {
  let parts;
  let safeTz = tz;
  try {
    parts = getZonedParts(tz);
  } catch {
    safeTz = "Asia/Jakarta";
    parts = getZonedParts(safeTz);
  }

  const { h, m, s, weekday, day, month, year } = parts;
  const pad = (n) => String(n).padStart(2, "0");

  const secDeg = s * 6;
  const minDeg = m * 6 + s * 0.1;
  const hourDeg = (h % 12) * 30 + m * 0.5 + s * (0.5 / 60);

  let phase = "Nocturnal Grimoire Study";
  let phaseColor = "#B399EE";
  if (h >= 5 && h < 11) {
    phase = "Dawn Expedition Watch";
    phaseColor = "#9CC084";
  } else if (h >= 11 && h < 15) {
    phase = "High Sun Meridian";
    phaseColor = "#E5C068";
  } else if (h >= 15 && h < 19) {
    phase = "Aureole Dusk Horizon";
    phaseColor = "#D4A843";
  }

  // Hour tick marks around cx=84, cy=70, r=44
  let ticks = "";
  for (let i = 0; i < 12; i++) {
    const a = (i * 30 - 90) * (Math.PI / 180);
    const r1 = i % 3 === 0 ? 35 : 38;
    const r2 = 43;
    const x1 = (84 + Math.cos(a) * r1).toFixed(1);
    const y1 = (70 + Math.sin(a) * r1).toFixed(1);
    const x2 = (84 + Math.cos(a) * r2).toFixed(1);
    const y2 = (70 + Math.sin(a) * r2).toFixed(1);
    const col = i % 3 === 0 ? "#E5C068" : "#8BA872";
    const sw = i % 3 === 0 ? "1.8" : "1.1";
    ticks += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${sw}" stroke-linecap="round"/>`;
  }

  // Discrete SMIL ticking seconds (tens 0..5 over 60s, ones 0..9 over 10s)
  let tensSvg = "";
  for (let d = 0; d < 6; d++) {
    const vals = Array.from({ length: 6 }, (_, k) => (k === d ? "1" : "0")).join(";");
    tensSvg += `<text x="304" y="90" class="clock-sec" fill="#9CC084" opacity="0">${d}<animate attributeName="opacity" values="${vals}" keyTimes="0;0.1667;0.3333;0.5;0.6667;0.8333" calcMode="discrete" dur="60s" begin="-${s}s" repeatCount="indefinite"/></text>`;
  }
  let onesSvg = "";
  for (let d = 0; d < 10; d++) {
    const vals = Array.from({ length: 10 }, (_, k) => (k === d ? "1" : "0")).join(";");
    onesSvg += `<text x="325" y="90" class="clock-sec" fill="#9CC084" opacity="0">${d}<animate attributeName="opacity" values="${vals}" keyTimes="0;0.1;0.2;0.3;0.4;0.5;0.6;0.7;0.8;0.9" calcMode="discrete" dur="10s" begin="-${s % 10}s" repeatCount="indefinite"/></text>`;
  }

  // 24-hour celestial arc position (x=820..1130)
  const dayPct = (h * 3600 + m * 60 + s) / 86400;
  const sunX = (820 + dayPct * 310).toFixed(1);
  const sunY = (94 - Math.sin(dayPct * Math.PI) * 34).toFixed(1);
  const tzLabel = safeTz === "Asia/Jakarta" ? "WIB · UTC+7" : safeTz;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 140" width="100%" height="100%">
  <defs>
    <linearGradient id="clk_bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0E1310"/>
      <stop offset="50%" stop-color="#131815"/>
      <stop offset="100%" stop-color="#16131E"/>
    </linearGradient>
    <linearGradient id="clk_border" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#D4A843" stop-opacity="0.55"/>
      <stop offset="50%" stop-color="#8BA872" stop-opacity="0.65"/>
      <stop offset="100%" stop-color="#A78BFA" stop-opacity="0.55"/>
    </linearGradient>
    <clipPath id="clk_clip"><rect x="0" y="0" width="1200" height="140" rx="16"/></clipPath>
    <style>
      .serif { font-family: Georgia, 'Times New Roman', serif; }
      .mono { font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace; font-variant-numeric: tabular-nums; }
      .clock-main { font-family: Georgia, 'Times New Roman', serif; font-size: 42px; font-weight: 700; letter-spacing: 2px; }
      .clock-sec { font-family: Georgia, 'Times New Roman', serif; font-size: 32px; font-weight: 700; }
    </style>
  </defs>

  <rect x="0.5" y="0.5" width="1199" height="139" rx="15.5" fill="url(#clk_bg)" stroke="url(#clk_border)" stroke-width="1.2"/>
  <rect x="6.5" y="6.5" width="1187" height="127" rx="11" fill="none" stroke="#D4A843" stroke-width="0.7" stroke-opacity="0.28"/>
  <polygon points="16,12 20,16 16,20 12,16" fill="#D4A843" fill-opacity="0.65"/>
  <polygon points="1184,12 1188,16 1184,20 1180,16" fill="#D4A843" fill-opacity="0.65"/>
  <polygon points="16,128 20,124 16,120 12,124" fill="#D4A843" fill-opacity="0.65"/>
  <polygon points="1184,128 1188,124 1184,120 1180,124" fill="#D4A843" fill-opacity="0.65"/>

  <g clip-path="url(#clk_clip)">
    <!-- Left: Live Celestial Astrolabe Analog Clock -->
    <circle cx="84" cy="70" r="51" fill="none" stroke="#D4A843" stroke-opacity="0.28" stroke-width="1" stroke-dasharray="4 5">
      <animateTransform attributeName="transform" type="rotate" from="0 84 70" to="360 84 70" dur="60s" repeatCount="indefinite"/>
    </circle>
    <circle cx="84" cy="70" r="45" fill="#0B0F0D" stroke="#D4A843" stroke-opacity="0.6" stroke-width="1.2"/>
    ${ticks}
    <!-- Hour Hand -->
    <line x1="84" y1="70" x2="84" y2="46" stroke="#F4EFE6" stroke-width="2.6" stroke-linecap="round">
      <animateTransform attributeName="transform" type="rotate" from="${hourDeg.toFixed(2)} 84 70" to="${(hourDeg + 360).toFixed(2)} 84 70" dur="43200s" repeatCount="indefinite"/>
    </line>
    <!-- Minute Hand -->
    <line x1="84" y1="70" x2="84" y2="36" stroke="#9CC084" stroke-width="2" stroke-linecap="round">
      <animateTransform attributeName="transform" type="rotate" from="${minDeg.toFixed(2)} 84 70" to="${(minDeg + 360).toFixed(2)} 84 70" dur="3600s" repeatCount="indefinite"/>
    </line>
    <!-- Ticking Second Hand -->
    <line x1="84" y1="78" x2="84" y2="32" stroke="#E5C068" stroke-width="1.2" stroke-linecap="round">
      <animateTransform attributeName="transform" type="rotate" from="${secDeg.toFixed(2)} 84 70" to="${(secDeg + 360).toFixed(2)} 84 70" dur="60s" repeatCount="indefinite"/>
    </line>
    <circle cx="84" cy="70" r="3.4" fill="#E5C068"/>

    <!-- Center: Live Digital Time & Imperial Phase -->
    <text x="166" y="42" class="serif" font-size="12" fill="#E5C068" letter-spacing="1.6">ASTRAL HOROLOGIUM  ·  ${safeTz.toUpperCase()}</text>
    <text x="166" y="90" class="clock-main" fill="#F4EFE6">${pad(h)}<tspan fill="#E5C068"><animate attributeName="opacity" values="1;0.25;1" dur="1s" repeatCount="indefinite"/>:</tspan>${pad(m)}<tspan font-size="32" fill="#8E887A">:</tspan></text>
    ${tensSvg}
    ${onesSvg}
    <text x="358" y="88" class="serif" font-size="14" fill="#D4A843" letter-spacing="1.2">${tzLabel}</text>
    <text x="166" y="114" class="serif" font-style="italic" font-size="14.5" fill="#C8C2B4">${weekday}, ${day} ${month} ${year}  ·  <tspan fill="${phaseColor}">${phase}</tspan></text>

    <line x1="786" y1="24" x2="786" y2="116" stroke="#D4A843" stroke-opacity="0.25" stroke-width="1"/>

    <!-- Right: 24-Hour Celestial Arc & Live Pulse -->
    <circle cx="826" cy="36" r="4" fill="#9CC084">
      <animate attributeName="opacity" values="0.35;1;0.35" dur="2s" repeatCount="indefinite"/>
    </circle>
    <text x="838" y="40" class="serif" font-size="12" fill="#9CC084" letter-spacing="1.4">LIVE CELESTIAL MERIDIAN</text>
    <path d="M 820 94 Q 975 30 1130 94" fill="none" stroke="#D4A843" stroke-opacity="0.32" stroke-width="1.4" stroke-dasharray="4 4"/>
    <line x1="820" y1="94" x2="1130" y2="94" stroke="#D4A843" stroke-opacity="0.2" stroke-width="1"/>
    <circle cx="${sunX}" cy="${sunY}" r="9" fill="${phaseColor}" fill-opacity="0.24">
      <animate attributeName="r" values="6;13;6" dur="3.4s" repeatCount="indefinite"/>
      <animate attributeName="fill-opacity" values="0.35;0.05;0.35" dur="3.4s" repeatCount="indefinite"/>
    </circle>
    <circle cx="${sunX}" cy="${sunY}" r="4.5" fill="#F4EFE6" stroke="${phaseColor}" stroke-width="1.5"/>
    <text x="820" y="113" class="serif" font-size="11.5" fill="#8E887A">00:00</text>
    <text x="975" y="113" text-anchor="middle" class="serif" font-size="11.5" fill="#E5C068">12:00</text>
    <text x="1130" y="113" text-anchor="end" class="serif" font-size="11.5" fill="#8E887A">23:59</text>
  </g>
</svg>`;
}

export default function handler(req, res) {
  const tz = (req.query && req.query.tz) || "Asia/Jakarta";
  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  return res.status(200).send(buildClockSvg(tz));
}

export { buildClockSvg };
