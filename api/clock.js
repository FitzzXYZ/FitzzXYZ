/**
 * Haute Horlogerie Sousou no Frieren x Ubel Celestial Astrolabe Clock SVG Endpoint (Vercel Serverless).
 * Deploy FitzzXYZ to Vercel and embed:
 *   <img src="https://<your-app>.vercel.app/api/clock?tz=Asia/Jakarta" width="100%" />
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
  return {
    h: parseInt(map.hour, 10) % 24,
    m: parseInt(map.minute, 10),
    s: parseInt(map.second, 10),
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
    const r1 = isCard ? 53 : isHour ? 55.5 : 59;
    const r2 = 62.5;
    const x1 = (cx + Math.cos(a) * r1).toFixed(1);
    const y1 = (cy + Math.sin(a) * r1).toFixed(1);
    const x2 = (cx + Math.cos(a) * r2).toFixed(1);
    const y2 = (cy + Math.sin(a) * r2).toFixed(1);
    const col = isCard ? "#E5C068" : isHour ? "#9CC084" : "#D4A843";
    const op = isCard ? "0.95" : isHour ? "0.78" : "0.28";
    const sw = isCard ? "2.1" : isHour ? "1.4" : "0.75";
    dialTicks += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-opacity="${op}" stroke-width="${sw}" stroke-linecap="round"/>`;
  }

  let tensSvg = "";
  for (let d = 0; d < 6; d++) {
    const vals = Array.from({ length: 6 }, (_, k) => (k === d ? "1" : "0")).join(";");
    tensSvg += `<text x="369" y="108" text-anchor="middle" class="clock-sec" fill="#9CC084" opacity="0">${d}<animate attributeName="opacity" values="${vals}" keyTimes="0;0.1667;0.3333;0.5;0.6667;0.8333" calcMode="discrete" dur="60s" begin="-${s}s" repeatCount="indefinite"/></text>`;
  }
  let onesSvg = "";
  for (let d = 0; d < 10; d++) {
    const vals = Array.from({ length: 10 }, (_, k) => (k === d ? "1" : "0")).join(";");
    onesSvg += `<text x="392" y="108" text-anchor="middle" class="clock-sec" fill="#9CC084" opacity="0">${d}<animate attributeName="opacity" values="${vals}" keyTimes="0;0.1;0.2;0.3;0.4;0.5;0.6;0.7;0.8;0.9" calcMode="discrete" dur="10s" begin="-${s % 10}s" repeatCount="indefinite"/></text>`;
  }

  const t = (h * 3600 + m * 60 + s) / 86400;
  const orbX = (876 + 280 * t).toFixed(1);
  const orbY = (126 - 172 * t * (1 - t)).toFixed(1);
  const dayPctInt = Math.round(t * 100);
  const tzShort = safeTz === "Asia/Jakarta" ? "WIB" : safeTz.split("/").pop().toUpperCase().slice(0, 6);
  const tzSub = safeTz === "Asia/Jakarta" ? "UTC +7" : safeTz;

  const celestialOrb = isDay
    ? `<circle cx="${orbX}" cy="${orbY}" r="11" fill="${phaseCol}" fill-opacity="0.22"><animate attributeName="r" values="8;15;8" dur="3.4s" repeatCount="indefinite"/><animate attributeName="fill-opacity" values="0.32;0.05;0.32" dur="3.4s" repeatCount="indefinite"/></circle><circle cx="${orbX}" cy="${orbY}" r="5.2" fill="#F4EFE6" stroke="${phaseCol}" stroke-width="1.6"/>`
    : `<circle cx="${orbX}" cy="${orbY}" r="11" fill="#B399EE" fill-opacity="0.22"><animate attributeName="r" values="8;15;8" dur="3.8s" repeatCount="indefinite"/><animate attributeName="fill-opacity" values="0.3;0.05;0.3" dur="3.8s" repeatCount="indefinite"/></circle><circle cx="${orbX}" cy="${orbY}" r="5.4" fill="#B399EE"/><circle cx="${(parseFloat(orbX) + 2.4).toFixed(1)}" cy="${(parseFloat(orbY) - 1.4).toFixed(1)}" r="4.4" fill="#131815"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 188" width="100%" height="100%">
  <defs>
    <linearGradient id="clk_bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0E1310"/>
      <stop offset="50%" stop-color="#131815"/>
      <stop offset="100%" stop-color="#16131E"/>
    </linearGradient>
    <linearGradient id="clk_border" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#D4A843" stop-opacity="0.6"/>
      <stop offset="50%" stop-color="#8BA872" stop-opacity="0.68"/>
      <stop offset="100%" stop-color="#A78BFA" stop-opacity="0.6"/>
    </linearGradient>
    <radialGradient id="dial_grad" cx="50%" cy="42%" r="58%">
      <stop offset="0%" stop-color="#1A221D"/>
      <stop offset="68%" stop-color="#0E1310"/>
      <stop offset="100%" stop-color="#090C0A"/>
    </radialGradient>
    <linearGradient id="arc_fill" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${phaseCol}" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#0E1310" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="clk_clip"><rect x="0" y="0" width="1200" height="188" rx="16"/></clipPath>
    <style>
      .serif { font-family: Georgia, 'Times New Roman', serif; }
      .roman { font-family: Georgia, serif; font-size: 9px; font-weight: 700; fill: #D4A843; }
      .clock-main { font-family: Georgia, 'Times New Roman', serif; font-size: 40px; font-weight: 700; letter-spacing: 2px; font-variant-numeric: tabular-nums; }
      .clock-sec { font-family: Georgia, 'Times New Roman', serif; font-size: 32px; font-weight: 700; font-variant-numeric: tabular-nums; }
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
    <circle cx="112" cy="94" r="71" fill="none" stroke="#D4A843" stroke-opacity="0.32" stroke-width="1" stroke-dasharray="3 6">
      <animateTransform attributeName="transform" type="rotate" from="0 112 94" to="360 112 94" dur="80s" repeatCount="indefinite"/>
    </circle>
    <circle cx="112" cy="94" r="66" fill="#0A0E0C" stroke="#D4A843" stroke-opacity="0.68" stroke-width="1.6"/>
    <circle cx="112" cy="94" r="63" fill="url(#dial_grad)" stroke="#8BA872" stroke-opacity="0.24" stroke-width="0.7"/>
    <g stroke="#D4A843" stroke-opacity="0.16" fill="none">
      <circle cx="112" cy="94" r="36" stroke-width="0.8" stroke-dasharray="10 4"/>
      <polygon points="112,62 116,90 144,94 116,98 112,126 108,98 80,94 108,90" stroke-width="0.6"/>
      <animateTransform attributeName="transform" type="rotate" from="360 112 94" to="0 112 94" dur="120s" repeatCount="indefinite"/>
    </g>
    ${dialTicks}
    <text x="112" y="51" text-anchor="middle" class="roman">XII</text>
    <text x="155" y="97" text-anchor="middle" class="roman">III</text>
    <text x="112" y="143" text-anchor="middle" class="roman">VI</text>
    <text x="69" y="97" text-anchor="middle" class="roman">IX</text>

    <g>
      <polygon points="112,58 115.6,92 112,102 108.4,92" fill="#F4EFE6" stroke="#D4A843" stroke-width="0.5"/>
      <animateTransform attributeName="transform" type="rotate" from="${hourDeg.toFixed(2)} 112 94" to="${(hourDeg + 360).toFixed(2)} 112 94" dur="43200s" repeatCount="indefinite"/>
    </g>
    <g>
      <polygon points="112,42 114.6,92 112,104 109.4,92" fill="#9CC084" stroke="#0E1310" stroke-width="0.4"/>
      <animateTransform attributeName="transform" type="rotate" from="${minDeg.toFixed(2)} 112 94" to="${(minDeg + 360).toFixed(2)} 112 94" dur="3600s" repeatCount="indefinite"/>
    </g>
    <g>
      <line x1="112" y1="112" x2="112" y2="39" stroke="#E5C068" stroke-width="1.2" stroke-linecap="round"/>
      <circle cx="112" cy="109" r="2.8" fill="#0E1310" stroke="#E5C068" stroke-width="1.1"/>
      <animateTransform attributeName="transform" type="rotate" from="${secDeg.toFixed(2)} 112 94" to="${(secDeg + 360).toFixed(2)} 112 94" dur="60s" repeatCount="indefinite"/>
    </g>
    <circle cx="112" cy="94" r="4.6" fill="#E5C068"/>
    <circle cx="112" cy="94" r="2.3" fill="#B399EE"/>

    <circle cx="222" cy="40" r="3.6" fill="#9CC084">
      <animate attributeName="opacity" values="0.35;1;0.35" dur="2.2s" repeatCount="indefinite"/>
    </circle>
    <text x="234" y="44" class="serif" font-size="12" font-weight="700" fill="#E5C068" letter-spacing="1.6">ASTRAL HOROLOGIUM  ·  ${safeTz.toUpperCase()}</text>

    <rect x="218" y="58" width="290" height="68" rx="10" fill="#0B0F0D" stroke="#D4A843" stroke-opacity="0.28" stroke-width="1"/>
    <line x1="416" y1="68" x2="416" y2="116" stroke="#D4A843" stroke-opacity="0.22" stroke-width="1"/>

    <text x="234" y="108" class="clock-main" fill="#F4EFE6">${pad(h)}<tspan fill="#E5C068"><animate attributeName="opacity" values="1;0.25;1" dur="1s" repeatCount="indefinite"/>:</tspan>${pad(m)}<tspan font-size="30" fill="#8E887A">:</tspan></text>
    ${tensSvg}
    ${onesSvg}

    <text x="430" y="87" class="serif" font-size="13" font-weight="700" fill="#E5C068" letter-spacing="1.2">${tzShort}</text>
    <text x="430" y="108" class="serif" font-style="italic" font-size="14" fill="#9CC084">${tzSub}</text>
    <text x="220" y="152" class="serif" font-style="italic" font-size="16" fill="#C8C2B4">${weekday}, ${day} ${month} ${year}  ·  <tspan fill="${phaseCol}">${phase}</tspan></text>

    <line x1="564" y1="28" x2="564" y2="160" stroke="#D4A843" stroke-opacity="0.24" stroke-width="1"/>

    <text x="590" y="44" class="serif" font-size="11.5" font-weight="700" fill="#B399EE" letter-spacing="1.5">IMPERIAL ERA CHRONICLE</text>
    <text x="590" y="80" class="serif" font-size="20" font-weight="700" fill="#F4EFE6">29 Years Post-Himmel</text>
    <line x1="590" y1="95" x2="836" y2="95" stroke="#D4A843" stroke-opacity="0.22" stroke-width="1"/>
    <text x="590" y="121" class="serif" font-style="italic" font-size="14" fill="#8E887A">Mage Registry</text>
    <text x="836" y="121" text-anchor="end" class="serif" font-size="15.5" fill="#9CC084">Äußerst · First-Class</text>
    <text x="590" y="149" class="serif" font-style="italic" font-size="14" fill="#8E887A">Destination</text>
    <text x="836" y="149" text-anchor="end" class="serif" font-size="15.5" fill="#E5C068">Aureole (Ende)</text>

    <line x1="860" y1="28" x2="860" y2="160" stroke="#D4A843" stroke-opacity="0.24" stroke-width="1"/>

    <text x="876" y="44" class="serif" font-size="11.5" font-weight="700" fill="#9CC084" letter-spacing="1.4">CELESTIAL MERIDIAN</text>
    <text x="1156" y="44" text-anchor="end" class="serif" font-style="italic" font-size="14" fill="#E5C068">${dayPctInt}% of cycle</text>
    <path d="M 876 126 Q 1016 40 1156 126 Z" fill="url(#arc_fill)"/>
    <path d="M 876 126 Q 1016 40 1156 126" fill="none" stroke="#D4A843" stroke-opacity="0.45" stroke-width="1.5" stroke-dasharray="4 4"/>
    <line x1="876" y1="126" x2="1156" y2="126" stroke="#D4A843" stroke-opacity="0.28" stroke-width="1"/>
    <line x1="876" y1="122" x2="876" y2="130" stroke="#8E887A" stroke-width="1"/>
    <line x1="946" y1="122" x2="946" y2="130" stroke="#9CC084" stroke-width="1"/>
    <line x1="1016" y1="121" x2="1016" y2="131" stroke="#E5C068" stroke-width="1.3"/>
    <line x1="1086" y1="122" x2="1086" y2="130" stroke="#B399EE" stroke-width="1"/>
    <line x1="1156" y1="122" x2="1156" y2="130" stroke="#8E887A" stroke-width="1"/>
    ${celestialOrb}
    <text x="876" y="149" class="serif" font-style="italic" font-size="12.5" fill="#8E887A">00:00</text>
    <text x="946" y="149" text-anchor="middle" class="serif" font-style="italic" font-size="12.5" fill="#9CC084">Dawn</text>
    <text x="1016" y="149" text-anchor="middle" class="serif" font-style="italic" font-size="12.5" fill="#E5C068">Noon</text>
    <text x="1086" y="149" text-anchor="middle" class="serif" font-style="italic" font-size="12.5" fill="#B399EE">Dusk</text>
    <text x="1156" y="149" text-anchor="end" class="serif" font-style="italic" font-size="12.5" fill="#8E887A">24:00</text>
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
