import fs from "node:fs";
import path from "node:path";

/**
 * Sousou no Frieren x Ubel — Dual Interactive README Mini-Game (Vercel Serverless)
 * Left Arena : First-Class Mage Exam — Ubel vs. Spiegel Clone (Turn-Based Spell Duel)
 * Right Trial: Frieren's Dungeon Roulette — Mimic or Grimoire? (3 Chests, "99% Accuracy!")
 *
 * Endpoints:
 *   GET /api/game                     -> Returns live 1200x430 High-Fantasy SVG screen for GitHub README <img>
 *   GET /api/game?act=<move>          -> Executes move & opens instant zero-latency playable Arena Console
 *   GET /api/game?act=<move>&json=1   -> Executes move & returns updated SVG + state JSON for in-page play
 */

function loadFileText(relPath) {
  try {
    return fs.readFileSync(path.join(process.cwd(), relPath), "utf8").trim();
  } catch {
    return "";
  }
}

function loadFontB64(name) {
  try {
    return fs.readFileSync(path.join(process.cwd(), "assets", "fonts", name)).toString("base64");
  } catch {
    return "";
  }
}

const CINZEL_600 = loadFontB64("cinzel-600.woff");
const CINZEL_800 = loadFontB64("cinzel-800.woff");
const CORMORANT_600 = loadFontB64("cormorant-600.woff");
const CORMORANT_500I = loadFontB64("cormorant-italic-500.woff");
const UBEL_AVATAR = loadFileText("assets/ubel-mini-b64.txt");

const FONT_FACE_CSS = [
  CINZEL_600 && `@font-face{font-family:'Cinzel';font-style:normal;font-weight:600;src:url("data:font/woff;base64,${CINZEL_600}") format("woff");}`,
  CINZEL_800 && `@font-face{font-family:'Cinzel';font-style:normal;font-weight:800;src:url("data:font/woff;base64,${CINZEL_800}") format("woff");}`,
  CORMORANT_600 && `@font-face{font-family:'Cormorant';font-style:normal;font-weight:600;src:url("data:font/woff;base64,${CORMORANT_600}") format("woff");}`,
  CORMORANT_500I && `@font-face{font-family:'CormorantItalic';font-style:italic;font-weight:500;src:url("data:font/woff;base64,${CORMORANT_500I}") format("woff");}`,
].filter(Boolean).join("\n      ");

const GRIMOIRE_LOOT = [
  { title: "Reelseiden Secret Folio", desc: "+25 Mana & permanent +5 Slash Power!" },
  { title: "Flamme’s Blue Moon Seed", desc: "Folk spell of eternal flowers · +30 HP restored!" },
  { title: "Spell to Make Sweet Grapes", desc: "Eisen’s favorite folk magic · +25 HP & +20 MP!" },
  { title: "Serie’s Ancient Scroll", desc: "First-Class privilege · Instant 35 DMG to Boss!" },
  { title: "Sorganeil Binding Treatise", desc: "Gaze locks the Clone · Next slash deals 2x CRIT!" },
];

const BOSS_ROSTER = [
  { name: "SPIEGEL · UBEL CLONE", title: "Ruins of the King’s Tomb · Floor I", maxHp: 160 },
  { name: "SPIEGEL · SENSE CLONE", title: "Hair-Magic Warder · Floor II", maxHp: 220 },
  { name: "SPIEGEL · FRIEREN CLONE", title: "Pinnacle of Magic · Inner Sanctum", maxHp: 300 },
];

function createInitialState() {
  return {
    ubelHp: 100,
    ubelMaxHp: 100,
    ubelMp: 85,
    ubelMaxMp: 100,
    stageIdx: 0,
    bossHp: 118,
    bossMaxHp: 160,
    bossBound: false,
    wardActive: false,
    lastSpell: "reelseiden",
    duelLog1: "✦ Übel casts REELSEIDEN! Twin emerald arc slices Spiegel Clone for 42 DMG!",
    duelLog2: "⚡ Spiegel Clone prepares a defensive hair-magic counterattack...",
    chests: ["closed", "grimoire", "closed"],
    lastChestIdx: 1,
    chestLog1: "✦ Chest II opened: Found [Flamme’s Blue Moon Seed]! (+30 HP restored)",
    chestLog2: "“Frieren’s detection spell says 99% of chests are grimoires... dare to open another?”",
    wins: 14,
    grimoiresFound: 23,
    mimicsTriggered: 9,
    turn: 12,
  };
}

function getArenaState() {
  if (!globalThis.__FITZZ_ARENA__) {
    globalThis.__FITZZ_ARENA__ = createInitialState();
  }
  return globalThis.__FITZZ_ARENA__;
}

function xmlEsc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function applyAction(st, act) {
  if (!act) return;
  st.turn += 1;
  const boss = BOSS_ROSTER[st.stageIdx % BOSS_ROSTER.length];

  if (act === "reset") {
    Object.assign(st, createInitialState());
    return;
  }

  if (act === "reelseiden" || act === "sorganeil" || act === "ward") {
    st.lastSpell = act;

    if (act === "reelseiden") {
      const cost = 15;
      if (st.ubelMp < cost) {
        st.ubelMp = Math.min(st.ubelMaxMp, st.ubelMp + 25);
        st.duelLog1 = "✧ Mana too low for Reelseiden! Übel channels 25 MP recovery.";
      } else {
        st.ubelMp -= cost;
        const base = 36 + ((st.turn * 7) % 18);
        const mult = st.bossBound ? 2 : 1;
        const dmg = base * mult;
        st.bossHp = Math.max(0, st.bossHp - dmg);
        st.duelLog1 = st.bossBound
          ? `✦ SORGANEIL CRIT! Übel’s Reelseiden cleaves through the bound Clone for ${dmg} DMG!`
          : `✦ Übel visualizes cloth being cut — REELSEIDEN slashes for ${dmg} DMG!`;
        st.bossBound = false;
      }
    } else if (act === "sorganeil") {
      const cost = 20;
      st.ubelMp = Math.max(0, st.ubelMp - cost);
      st.bossBound = true;
      const chip = 16 + (st.turn % 9);
      st.bossHp = Math.max(0, st.bossHp - chip);
      st.duelLog1 = `👁️ SORGANEIL! Full body in sight — Clone is paralyzed (${chip} DMG, 2x next hit & stunned)!`;
    } else if (act === "ward") {
      st.ubelMp = Math.min(st.ubelMaxMp, st.ubelMp + 35);
      st.ubelHp = Math.min(st.ubelMaxHp, st.ubelHp + 22);
      st.wardActive = true;
      st.duelLog1 = "🛡️ Defensive Mana Ward deployed! Restored +22 HP and +35 MP.";
    }

    // Check Boss defeat -> advance stage
    if (st.bossHp <= 0) {
      st.wins += 1;
      const oldName = boss.name;
      st.stageIdx = (st.stageIdx + 1) % BOSS_ROSTER.length;
      const nextBoss = BOSS_ROSTER[st.stageIdx];
      st.bossMaxHp = nextBoss.maxHp;
      st.bossHp = nextBoss.maxHp;
      st.bossBound = false;
      st.ubelHp = st.ubelMaxHp;
      st.ubelMp = st.ubelMaxMp;
      st.duelLog2 = `🏆 ${oldName} shattered! Trial Cleared (#${st.wins})! Next guardian: ${nextBoss.name}!`;
      return;
    }

    // Boss counterattack
    if (st.bossBound) {
      st.duelLog2 = "⛓️ Spiegel Clone is immobilized by Sorganeil and cannot counterattack!";
    } else {
      const rawAtk = 14 + ((st.turn * 5) % 12);
      const taken = st.wardActive ? Math.floor(rawAtk * 0.3) : rawAtk;
      st.wardActive = false;
      st.ubelHp = Math.max(1, st.ubelHp - taken);
      st.duelLog2 = taken < rawAtk
        ? `⚡ Clone fires Zoltraak! Hexagonal Ward absorbs the blast (${taken} chip DMG).`
        : `⚡ ${boss.name} strikes back with dense mana for ${taken} DMG!`;
      if (st.ubelHp <= 12) {
        st.ubelHp = 65;
        st.duelLog2 += " ✦ Second Wind surge restores Übel to 65 HP!";
      }
    }
    return;
  }

  // Chest roulette actions: chest1, chest2, chest3
  if (act === "chest1" || act === "chest2" || act === "chest3") {
    const idx = act === "chest1" ? 0 : act === "chest2" ? 1 : 2;
    st.lastChestIdx = idx;
    // Reset other chests to closed so player can keep opening
    st.chests = ["closed", "closed", "closed"];

    // 1 of 3 chests is a Mimic based on deterministic turn + index mix
    const isMimic = ((st.turn + idx * 2) % 3) === 0;
    if (isMimic) {
      st.chests[idx] = "mimic";
      st.mimicsTriggered += 1;
      st.ubelHp = Math.max(15, st.ubelHp - 15);
      st.chestLog1 = `🦷 IT’S A MIMIC in Chest ${["I", "II", "III"][idx]}!! “Kurai yo! Kowai yo!!” (-15 HP, hair ruined!)`;
      st.chestLog2 = "Frieren: “Wait... the grimoire detection spell said 99% accuracy! Pull me out, Fern!”";
    } else {
      st.chests[idx] = "grimoire";
      st.grimoiresFound += 1;
      const loot = GRIMOIRE_LOOT[(st.turn + idx) % GRIMOIRE_LOOT.length];
      st.ubelHp = Math.min(st.ubelMaxHp, st.ubelHp + 25);
      st.ubelMp = Math.min(st.ubelMaxMp, st.ubelMp + 25);
      if (loot.title.includes("Serie")) {
        st.bossHp = Math.max(10, st.bossHp - 35);
      } else if (loot.title.includes("Sorganeil")) {
        st.bossBound = true;
      }
      st.chestLog1 = `✨ Chest ${["I", "II", "III"][idx]} opened: Found [${loot.title}]!`;
      st.chestLog2 = `✦ ${loot.desc}`;
    }
  }
}

function renderChest(x, y, label, state, isSelected) {
  const borderCol = state === "mimic" ? "#E05D53" : state === "grimoire" ? "#E5C068" : "#D4A843";
  const bgCol = state === "mimic" ? "#1E1215" : state === "grimoire" ? "#181A12" : "#111613";
  const glowOp = isSelected ? "0.75" : "0.28";

  let art = "";
  if (state === "closed") {
    art = `
      <g>
        <animateTransform attributeName="transform" type="translate" values="0,0; 0,-2.5; 0,0" dur="3.4s" repeatCount="indefinite"/>
        <!-- Ornate Closed Dungeon Chest -->
        <path d="M ${x + 30} ${y + 52} Q ${x + 70} ${y + 34} ${x + 110} ${y + 52} L ${x + 110} ${y + 64} L ${x + 30} ${y + 64} Z" fill="#2A211B" stroke="#D4A843" stroke-width="1.4"/>
        <rect x="${x + 30}" y="${y + 64}" width="80" height="36" rx="4" fill="#1F1815" stroke="#D4A843" stroke-width="1.4"/>
        <line x1="${x + 48}" y1="${y + 46}" x2="${x + 48}" y2="${y + 100}" stroke="#D4A843" stroke-width="2.2"/>
        <line x1="${x + 92}" y1="${y + 46}" x2="${x + 92}" y2="${y + 100}" stroke="#D4A843" stroke-width="2.2"/>
        <rect x="${x + 64}" y="${y + 58}" width="12" height="14" rx="2" fill="#E5C068"/>
        <circle cx="${x + 70}" cy="${y + 65}" r="2.2" fill="#0E1310"/>
      </g>
      <text x="${x + 70}" y="${y + 124}" text-anchor="middle" class="folio" font-size="13" fill="#8E887A">Click below to open</text>`;
  } else if (state === "grimoire") {
    art = `
      <!-- Open Chest + Floating Golden Grimoire -->
      <circle cx="${x + 70}" cy="${y + 54}" r="28" fill="#E5C068" fill-opacity="0.18">
        <animate attributeName="r" values="22;32;22" dur="2.8s" repeatCount="indefinite"/>
      </circle>
      <g>
        <animateTransform attributeName="transform" type="translate" values="0,0; 0,-4; 0,0" dur="2.4s" repeatCount="indefinite"/>
        <!-- Open Illuminated Grimoire Book -->
        <path d="M ${x + 46} ${y + 56} Q ${x + 58} ${y + 50} ${x + 70} ${y + 56} Q ${x + 82} ${y + 50} ${x + 94} ${y + 56} L ${x + 94} ${y + 34} Q ${x + 82} ${y + 28} ${x + 70} ${y + 34} Q ${x + 58} ${y + 28} ${x + 46} ${y + 34} Z" fill="#F4EFE6" stroke="#E5C068" stroke-width="1.5"/>
        <line x1="${x + 70}" y1="${y + 34}" x2="${x + 70}" y2="${y + 56}" stroke="#D4A843" stroke-width="1.4"/>
        <polygon points="${x + 70},${y + 20} ${x + 73},${y + 26} ${x + 70},${y + 30} ${x + 67},${y + 26}" fill="#9CC084"/>
      </g>
      <rect x="${x + 32}" y="${y + 72}" width="76" height="28" rx="3" fill="#1F1815" stroke="#E5C068" stroke-width="1.4"/>
      <text x="${x + 70}" y="${y + 124}" text-anchor="middle" class="cinzel" font-size="10.5" fill="#9CC084" letter-spacing="0.8">✦ RARE GRIMOIRE!</text>`;
  } else {
    art = `
      <!-- Open Fanged Mimic Trap! -->
      <circle cx="${x + 70}" cy="${y + 62}" r="28" fill="#E05D53" fill-opacity="0.2">
        <animate attributeName="r" values="20;30;20" dur="1.4s" repeatCount="indefinite"/>
      </circle>
      <!-- Upper Jaw -->
      <path d="M ${x + 28} ${y + 54} Q ${x + 70} ${y + 30} ${x + 112} ${y + 54} Z" fill="#2B1418" stroke="#E05D53" stroke-width="1.5"/>
      <!-- Sharp White Fangs -->
      <polygon points="${x + 38},${y + 54} ${x + 43},${y + 64} ${x + 48},${y + 54} ${x + 54},${y + 66} ${x + 60},${y + 54} ${x + 70},${y + 67} ${x + 80},${y + 54} ${x + 86},${y + 66} ${x + 92},${y + 54} ${x + 97},${y + 64} ${x + 102},${y + 54}" fill="#F4EFE6"/>
      <!-- Glowing Mimic Eyes & Tongue -->
      <circle cx="${x + 54}" cy="${y + 45}" r="2.6" fill="#E05D53"/>
      <circle cx="${x + 86}" cy="${y + 45}" r="2.6" fill="#E05D53"/>
      <path d="M ${x + 64} ${y + 72} Q ${x + 70} ${y + 56} ${x + 84} ${y + 62}" fill="none" stroke="#E05D53" stroke-width="3.2" stroke-linecap="round"/>
      <!-- Lower Box -->
      <rect x="${x + 30}" y="${y + 72}" width="80" height="28" rx="3" fill="#231216" stroke="#E05D53" stroke-width="1.5"/>
      <text x="${x + 70}" y="${y + 124}" text-anchor="middle" class="cinzel" font-size="10.5" fill="#E05D53" letter-spacing="0.6">🦷 MIMIC! KURAI YO!</text>`;
  }

  return `
    <rect x="${x}" y="${y}" width="140" height="138" rx="10" fill="${bgCol}" stroke="${borderCol}" stroke-opacity="${glowOp}" stroke-width="1.2"/>
    <text x="${x + 70}" y="${y + 21}" text-anchor="middle" class="cinzel" font-size="11" fill="${borderCol}" letter-spacing="1.2">${label}</text>
    ${art}`;
}

export function buildGameSvg(st) {
  const boss = BOSS_ROSTER[st.stageIdx % BOSS_ROSTER.length];
  const hpW = Math.round((st.ubelHp / st.ubelMaxHp) * 204);
  const mpW = Math.round((st.ubelMp / st.ubelMaxMp) * 204);
  const bossHpW = Math.round((st.bossHp / st.bossMaxHp) * 204);

  // Center spell clash effect (x=316, y=172)
  let clashArt = "";
  if (st.lastSpell === "reelseiden") {
    clashArt = `
      <circle cx="334" cy="176" r="34" fill="#9CC084" fill-opacity="0.12">
        <animate attributeName="r" values="24;38;24" dur="2.2s" repeatCount="indefinite"/>
      </circle>
      <path d="M 304 204 L 364 146 M 314 210 L 372 154" stroke="#9CC084" stroke-width="3.2" stroke-linecap="round">
        <animate attributeName="stroke-opacity" values="0.4;1;0.4" dur="1.4s" repeatCount="indefinite"/>
      </path>
      <text x="334" y="228" text-anchor="middle" class="cinzel" font-size="10" fill="#9CC084" letter-spacing="1">REELSEIDEN</text>`;
  } else if (st.lastSpell === "sorganeil") {
    clashArt = `
      <circle cx="334" cy="176" r="34" fill="#B399EE" fill-opacity="0.16">
        <animate attributeName="r" values="24;38;24" dur="2.4s" repeatCount="indefinite"/>
      </circle>
      <ellipse cx="334" cy="176" rx="22" ry="12" fill="none" stroke="#B399EE" stroke-width="2.2"/>
      <circle cx="334" cy="176" r="6" fill="#B399EE">
        <animate attributeName="r" values="4;7.5;4" dur="1.6s" repeatCount="indefinite"/>
      </circle>
      <text x="334" y="228" text-anchor="middle" class="cinzel" font-size="10" fill="#B399EE" letter-spacing="1">SORGANEIL</text>`;
  } else {
    clashArt = `
      <polygon points="334,144 362,160 362,192 334,208 306,192 306,160" fill="#7DA8E6" fill-opacity="0.15" stroke="#7DA8E6" stroke-width="2">
        <animate attributeName="stroke-opacity" values="0.4;1;0.4" dur="1.8s" repeatCount="indefinite"/>
      </polygon>
      <text x="334" y="228" text-anchor="middle" class="cinzel" font-size="10" fill="#7DA8E6" letter-spacing="1">MANA WARD</text>`;
  }

  const avatarImg = UBEL_AVATAR
    ? `<image href="${UBEL_AVATAR}" x="46" y="106" width="64" height="64" preserveAspectRatio="xMidYMin slice" clip-path="url(#ubel_av_clip)"/>`
    : `<circle cx="78" cy="138" r="30" fill="#18221B"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 424" width="100%" height="100%">
  <defs>
    <linearGradient id="gm_bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0E1310"/>
      <stop offset="50%" stop-color="#131815"/>
      <stop offset="100%" stop-color="#16131E"/>
    </linearGradient>
    <linearGradient id="gm_border" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#D4A843" stop-opacity="0.62"/>
      <stop offset="50%" stop-color="#8BA872" stop-opacity="0.7"/>
      <stop offset="100%" stop-color="#A78BFA" stop-opacity="0.62"/>
    </linearGradient>
    <linearGradient id="hp_grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#4E7A52"/>
      <stop offset="100%" stop-color="#9CC084"/>
    </linearGradient>
    <linearGradient id="mp_grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#6E56AF"/>
      <stop offset="100%" stop-color="#B399EE"/>
    </linearGradient>
    <linearGradient id="boss_grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#C95B55"/>
      <stop offset="100%" stop-color="#E5C068"/>
    </linearGradient>
    <clipPath id="gm_clip"><rect x="0" y="0" width="1200" height="424" rx="16"/></clipPath>
    <clipPath id="ubel_av_clip"><rect x="46" y="106" width="64" height="64" rx="10"/></clipPath>
    <style>
      ${FONT_FACE_CSS}
      .cinzel { font-family: 'Cinzel', Georgia, serif; font-weight: 600; }
      .cinzel-b { font-family: 'Cinzel', Georgia, serif; font-weight: 800; }
      .serif { font-family: 'Cormorant', Georgia, serif; font-weight: 600; }
      .folio { font-family: 'CormorantItalic', Georgia, serif; font-style: italic; font-weight: 500; }
      .mono { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif; font-variant-numeric: tabular-nums; font-weight: 700; }
    </style>
  </defs>

  <rect x="0.5" y="0.5" width="1199" height="423" rx="15.5" fill="url(#gm_bg)" stroke="url(#gm_border)" stroke-width="1.2"/>
  <rect x="6.5" y="6.5" width="1187" height="411" rx="11" fill="none" stroke="#D4A843" stroke-width="0.7" stroke-opacity="0.28"/>
  <polygon points="16,12 20,16 16,20 12,16" fill="#D4A843" fill-opacity="0.65"/>
  <polygon points="1184,12 1188,16 1184,20 1180,16" fill="#D4A843" fill-opacity="0.65"/>
  <polygon points="16,412 20,408 16,404 12,408" fill="#D4A843" fill-opacity="0.65"/>
  <polygon points="1184,412 1188,408 1184,404 1180,408" fill="#D4A843" fill-opacity="0.65"/>

  <g clip-path="url(#gm_clip)">
    <!-- TOP HEADER -->
    <circle cx="42" cy="36" r="4" fill="#9CC084">
      <animate attributeName="opacity" values="0.35;1;0.35" dur="2s" repeatCount="indefinite"/>
    </circle>
    <text x="56" y="41" class="cinzel" font-size="18" fill="#F4EFE6" letter-spacing="0.8">ARCANE TRIAL ARENA  ·  INTERACTIVE GRIMOIRE MINI-GAME</text>
    <text x="1164" y="41" text-anchor="end" class="folio" font-size="15" fill="#E5C068">Trials Cleared: ${st.wins}  ·  Grimoires Found: ${st.grimoiresFound}  ·  Mimic Traps: ${st.mimicsTriggered}</text>
    <line x1="36" y1="56" x2="1164" y2="56" stroke="#D4A843" stroke-opacity="0.28" stroke-width="1"/>

    <!-- ================================================================== -->
    <!-- LEFT PANEL: TRIAL I · UBEL VS SPIEGEL CLONE (x=28..640)            -->
    <!-- ================================================================== -->
    <rect x="28" y="70" width="612" height="328" rx="12" fill="#0C110E" stroke="#9CC084" stroke-opacity="0.28" stroke-width="1"/>
    <text x="46" y="94" class="cinzel" font-size="12" fill="#9CC084" letter-spacing="1.4">TRIAL I · FIRST-CLASS MAGE DUEL (KING’S TOMB)</text>
    <text x="622" y="94" text-anchor="end" class="folio" font-size="13.5" fill="#C8C2B4">Turn #${st.turn} · Interactive</text>

    <!-- Player Side: Ubel (x=46..280) -->
    ${avatarImg}
    <rect x="46" y="106" width="64" height="64" rx="10" fill="none" stroke="#9CC084" stroke-width="1.5"/>
    <text x="122" y="124" class="cinzel-b" font-size="15.5" fill="#F4EFE6">ÜBEL · FITZZXYZ</text>
    <text x="122" y="143" class="folio" font-size="13.5" fill="#9CC084">First-Class Mage · Reelseiden</text>
    <text x="122" y="162" class="cinzel" font-size="10.5" fill="#E5C068">${st.wardActive ? "🛡️ WARD ACTIVE" : "⚔️ OFFENSIVE STANCE"}</text>

    <!-- Ubel HP Bar -->
    <text x="46" y="196" class="cinzel" font-size="10.5" fill="#9CC084" letter-spacing="1">HP</text>
    <text x="250" y="196" text-anchor="end" class="mono" font-size="11.5" fill="#F4EFE6">${st.ubelHp} / ${st.ubelMaxHp}</text>
    <rect x="46" y="203" width="204" height="11" rx="4" fill="#1A221D"/>
    <rect x="46" y="203" width="${hpW}" height="11" rx="4" fill="url(#hp_grad)"/>

    <!-- Ubel MP Bar -->
    <text x="46" y="236" class="cinzel" font-size="10.5" fill="#B399EE" letter-spacing="1">MANA</text>
    <text x="250" y="236" text-anchor="end" class="mono" font-size="11.5" fill="#F4EFE6">${st.ubelMp} / ${st.ubelMaxMp}</text>
    <rect x="46" y="243" width="204" height="11" rx="4" fill="#1A1826"/>
    <rect x="46" y="243" width="${mpW}" height="11" rx="4" fill="url(#mp_grad)"/>

    <!-- Center Clash FX -->
    ${clashArt}

    <!-- Boss Side: Spiegel Clone (x=418..622) -->
    <g transform="translate(590, 138)">
      <circle cx="0" cy="0" r="30" fill="#171222" stroke="#E05D53" stroke-width="1.4"/>
      <circle cx="0" cy="0" r="23" fill="none" stroke="#E5C068" stroke-opacity="0.55" stroke-width="1" stroke-dasharray="4 3">
        <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="18s" repeatCount="indefinite"/>
      </circle>
      <polygon points="0,-13 11,0 0,13 -11,0" fill="none" stroke="#B399EE" stroke-width="1.6"/>
      <circle cx="0" cy="0" r="3.5" fill="#E05D53"/>
    </g>
    <text x="546" y="124" text-anchor="end" class="cinzel-b" font-size="14.5" fill="#F4EFE6">${xmlEsc(boss.name)}</text>
    <text x="546" y="143" text-anchor="end" class="folio" font-size="13.5" fill="#E5C068">${xmlEsc(boss.title)}</text>
    <text x="546" y="162" text-anchor="end" class="cinzel" font-size="10.5" fill="${st.bossBound ? "#B399EE" : "#E05D53"}">${st.bossBound ? "⛓️ BOUND BY SORGANEIL (2X)" : "⚡ ACTIVE GUARDIAN"}</text>

    <!-- Boss HP Bar -->
    <text x="418" y="196" class="cinzel" font-size="10.5" fill="#E5C068" letter-spacing="1">BOSS HP</text>
    <text x="622" y="196" text-anchor="end" class="mono" font-size="11.5" fill="#F4EFE6">${st.bossHp} / ${st.bossMaxHp}</text>
    <rect x="418" y="203" width="204" height="11" rx="4" fill="#241618"/>
    <rect x="418" y="203" width="${bossHpW}" height="11" rx="4" fill="url(#boss_grad)"/>

    <text x="418" y="236" class="cinzel" font-size="10.5" fill="#8E887A" letter-spacing="1">WEAKNESS</text>
    <text x="622" y="236" text-anchor="end" class="folio" font-size="13.5" fill="#B399EE">Sorganeil → Reelseiden</text>
    <line x1="418" y1="248" x2="622" y2="248" stroke="#D4A843" stroke-opacity="0.22" stroke-width="1"/>

    <!-- Battle Chronicle Log Well -->
    <rect x="46" y="276" width="576" height="106" rx="8" fill="#080B09" stroke="#D4A843" stroke-opacity="0.22" stroke-width="1"/>
    <text x="62" y="298" class="cinzel" font-size="10.5" fill="#E5C068" letter-spacing="1.4">BATTLE CHRONICLE LOG</text>
    <text x="62" y="328" class="serif" font-size="15" fill="#F4EFE6">${xmlEsc(st.duelLog1)}</text>
    <text x="62" y="356" class="folio" font-size="14.5" fill="#C8C2B4">${xmlEsc(st.duelLog2)}</text>

    <!-- ================================================================== -->
    <!-- RIGHT PANEL: TRIAL II · MIMIC OR GRIMOIRE? (x=656..1172)           -->
    <!-- ================================================================== -->
    <rect x="656" y="70" width="516" height="328" rx="12" fill="#0C110E" stroke="#E5C068" stroke-opacity="0.28" stroke-width="1"/>
    <text x="676" y="94" class="cinzel" font-size="12" fill="#E5C068" letter-spacing="1.4">TRIAL II · FRIEREN’S DUNGEON CHEST ROULETTE</text>
    <text x="1152" y="94" text-anchor="end" class="folio" font-size="13.5" fill="#9CC084">“99% Grimoire!”</text>

    ${renderChest(676, 114, "CHEST I", st.chests[0], st.lastChestIdx === 0)}
    ${renderChest(844, 114, "CHEST II", st.chests[1], st.lastChestIdx === 1)}
    ${renderChest(1012, 114, "CHEST III", st.chests[2], st.lastChestIdx === 2)}

    <!-- Dungeon Roulette Log Well -->
    <rect x="676" y="276" width="476" height="106" rx="8" fill="#080B09" stroke="#D4A843" stroke-opacity="0.22" stroke-width="1"/>
    <text x="692" y="298" class="cinzel" font-size="10.5" fill="#B399EE" letter-spacing="1.4">DUNGEON APPRAISAL LOG</text>
    <text x="692" y="328" class="serif" font-size="14.5" fill="#F4EFE6">${xmlEsc(st.chestLog1)}</text>
    <text x="692" y="356" class="folio" font-size="14" fill="#C8C2B4">${xmlEsc(st.chestLog2)}</text>
  </g>
</svg>`;
}

function buildInteractiveConsoleHtml(svgContent) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>FitzzXYZ · Arcane Trial Arena (Sousou no Frieren × Übel)</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 24px 16px; min-height: 100vh;
      background: radial-gradient(circle at 50% 10%, #171E19 0%, #0B0E0C 75%);
      color: #F4EFE6; font-family: Georgia, 'Times New Roman', serif;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
    }
    .wrap { width: 100%; max-width: 1120px; display: flex; flex-direction: column; gap: 16px; align-items: center; }
    .top-bar { width: 100%; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
    .back-btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 9px 18px; border-radius: 9px; text-decoration: none;
      background: #121815; color: #F4EFE6; border: 1px solid rgba(212,168,67,0.55);
      font-size: 13.5px; font-weight: 600; letter-spacing: 0.4px; transition: all 0.18s ease;
    }
    .back-btn:hover { border-color: #9CC084; background: #18211C; transform: translateY(-1px); }
    .badge { font-style: italic; color: #9CC084; font-size: 14px; }
    #arena-box { width: 100%; border-radius: 16px; box-shadow: 0 20px 50px rgba(0,0,0,0.65); overflow: hidden; }
    .controls { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; width: 100%; }
    button.act-btn {
      cursor: pointer; padding: 11px 18px; border-radius: 10px;
      background: linear-gradient(135deg, #121714, #181522);
      color: #F4EFE6; border: 1px solid rgba(212,168,67,0.5);
      font-family: Georgia, serif; font-size: 13.5px; font-weight: 700;
      display: flex; flex-direction: column; align-items: center; gap: 3px;
      min-width: 158px; transition: all 0.15s ease;
    }
    button.act-btn:hover { transform: translateY(-2px); border-color: #E5C068; box-shadow: 0 6px 18px rgba(212,168,67,0.18); }
    button.act-btn:active { transform: translateY(0); }
    button.act-btn span.sub { font-size: 11.5px; font-weight: 400; font-style: italic; color: #9CC084; }
    button.act-btn.purple span.sub { color: #B399EE; }
    button.act-btn.blue span.sub { color: #7DA8E6; }
    button.act-btn.gold span.sub { color: #E5C068; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="top-bar">
      <a class="back-btn" href="https://github.com/FitzzXYZ">↩ Kembali ke Profil GitHub FitzzXYZ (State Tersimpan Live)</a>
      <span class="badge">✦ Setiap aksi Anda di sini juga langsung memperbarui gambar SVG di README GitHub!</span>
    </div>
    <div id="arena-box">${svgContent}</div>
    <div class="controls">
      <button class="act-btn" onclick="play('reelseiden')">⚔️ I · Cast Reelseiden<span class="sub">Slash · 35–55 DMG</span></button>
      <button class="act-btn purple" onclick="play('sorganeil')">👁️ II · Cast Sorganeil<span class="sub">Bind · 2x Next Hit</span></button>
      <button class="act-btn blue" onclick="play('ward')">🛡️ III · Mana Ward<span class="sub">+35 MP · +22 HP</span></button>
      <button class="act-btn gold" onclick="play('chest1')">📦 Open Chest I<span class="sub">99% Grimoire?</span></button>
      <button class="act-btn gold" onclick="play('chest2')">📦 Open Chest II<span class="sub">99% Grimoire?</span></button>
      <button class="act-btn gold" onclick="play('chest3')">📦 Open Chest III<span class="sub">99% Grimoire?</span></button>
    </div>
  </div>
  <script>
    async function play(move) {
      const r = await fetch('/api/game?act=' + move + '&json=1', { cache: 'no-store' });
      const data = await r.json();
      document.getElementById('arena-box').innerHTML = data.svg;
    }
  </script>
</body>
</html>`;
}

export default function handler(req, res) {
  const st = getArenaState();
  const act = req.query && req.query.act;

  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0, s-maxage=0");
  res.setHeader("CDN-Cache-Control", "no-store");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  if (act) {
    applyAction(st, act);
    if (req.query.json === "1") {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(200).send(JSON.stringify({ svg: buildGameSvg(st) }));
    }
    if (req.query.mode === "redirect") {
      res.setHeader("Location", "https://github.com/FitzzXYZ#arcane-trial-arena");
      return res.status(302).end();
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(buildInteractiveConsoleHtml(buildGameSvg(st)));
  }

  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  return res.status(200).send(buildGameSvg(st));
}
