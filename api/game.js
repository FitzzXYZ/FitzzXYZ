import fs from "node:fs";
import path from "node:path";

/**
 * Sousou no Frieren x Ubel — Editorial Illuminated Grimoire Mini-Game (Anti-AI-Slop Edition)
 * Crafted following hallmark/references/craft.md:
 * - Zero system emojis anywhere (100% bespoke vector sigils, runes, and classical typography)
 * - Hairline surface ladder (1px antique gold rules instead of nested card-in-card boxes)
 * - Matched 4x HD portraits for Ubel & Spiegel Mirror-Replica Boss across a 4-stage Gauntlet
 * - 3 Reliquary Coffers separated by fine hairlines (Sealed, Illuminated Grimoire, or Mimic Ambush)
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
const SPIEGEL_AVATAR = loadFileText("assets/spiegel-mini-b64.txt");

const FONT_FACE_CSS = [
  CINZEL_600 && `@font-face{font-family:'Cinzel';font-style:normal;font-weight:600;src:url("data:font/woff;base64,${CINZEL_600}") format("woff");}`,
  CINZEL_800 && `@font-face{font-family:'Cinzel';font-style:normal;font-weight:800;src:url("data:font/woff;base64,${CINZEL_800}") format("woff");}`,
  CORMORANT_600 && `@font-face{font-family:'Cormorant';font-style:normal;font-weight:600;src:url("data:font/woff;base64,${CORMORANT_600}") format("woff");}`,
  CORMORANT_500I && `@font-face{font-family:'CormorantItalic';font-style:italic;font-weight:500;src:url("data:font/woff;base64,${CORMORANT_500I}") format("woff");}`,
].filter(Boolean).join("\n      ");

const GRIMOIRE_LOOT = [
  { title: "Reelseiden Severing Treatise", effect: "+30 Mana & permanent +6 Slash Affinity", bonusDmg: 0, healHp: 15, healMp: 30, bind: false },
  { title: "Flamme’s Blue Moon Folio", effect: "Folk spell of eternal blossoms · +35 HP & +20 MP", bonusDmg: 0, healHp: 35, healMp: 20, bind: false },
  { title: "Eisen’s Sour Grapes Scroll", effect: "Ancient dwarven refreshment · +40 HP restored", bonusDmg: 0, healHp: 40, healMp: 15, bind: false },
  { title: "Serie’s Living Grimoire", effect: "First-Class privilege · Inflicts 45 True Damage to Spiegel", bonusDmg: 45, healHp: 10, healMp: 20, bind: false },
  { title: "Sorganeil Ocular Apocrypha", effect: "Locks the Replica in sight · Applies 2.2x Execution Mark", bonusDmg: 15, healHp: 10, healMp: 25, bind: true },
];

const BOSS_ROSTER = [
  { stage: "STAGE I / IV", name: "SPIEGEL · ÜBEL REPLICA", title: "King’s Tomb · Outer Corridor", maxHp: 160, trait: "Reflects 20% slash unless bound" },
  { stage: "STAGE II / IV", name: "SPIEGEL · SENSE REPLICA", title: "Crimson Hair Warder · Hall II", maxHp: 220, trait: "Iron Hair Phalanx · High Defense" },
  { stage: "STAGE III / IV", name: "SPIEGEL · LERNEN REPLICA", title: "First-Class Veteran · Hall III", maxHp: 260, trait: "Fires concentrated Zoltraak volleys" },
  { stage: "FINAL STAGE", name: "SPIEGEL · FRIEREN", title: "The Pinnacle of Magic · Sanctum", maxHp: 340, trait: "Casts Vollzanbel & Judradjim" },
];

function createInitialState() {
  return {
    ubelHp: 100,
    ubelMaxHp: 100,
    ubelMp: 88,
    ubelMaxMp: 100,
    slashBonus: 0,
    combo: 2,
    stageIdx: 0,
    bossHp: 114,
    bossMaxHp: 160,
    bossBound: false,
    bossCharging: false,
    wardActive: false,
    lastSpell: "reelseiden",
    duelLog1: "Übel visualizes shears through silk — Reelseiden severs the Replica for 46 damage.",
    duelLog2: "The mirror guardian gathers dense amethyst mana along the corridor walls...",
    chests: ["closed", "grimoire", "closed"],
    lastChestIdx: 1,
    chestLog1: "Sanctum Coffer II appraised: Flamme’s Blue Moon Folio (+35 HP, +20 MP).",
    chestLog2: "“My detection spell says 99% of these coffers hold authentic grimoires.” — Frieren",
    wins: 14,
    grimoiresFound: 24,
    mimicsTriggered: 9,
    turn: 12,
  };
}

function getArenaState() {
  if (!globalThis.__FITZZ_ARENA_V2__) {
    globalThis.__FITZZ_ARENA_V2__ = createInitialState();
  }
  return globalThis.__FITZZ_ARENA_V2__;
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
  if (act === "reset") {
    Object.assign(st, createInitialState());
    return;
  }

  st.turn += 1;
  const boss = BOSS_ROSTER[st.stageIdx % BOSS_ROSTER.length];

  if (act === "reelseiden" || act === "sorganeil" || act === "ward") {
    st.lastSpell = act;

    if (act === "reelseiden") {
      const cost = 15;
      if (st.ubelMp < cost) {
        st.ubelMp = Math.min(st.ubelMaxMp, st.ubelMp + 28);
        st.combo = 1;
        st.duelLog1 = "Insufficient mana for Reelseiden — Übel steadies her breathing and recovers +28 MP.";
      } else {
        st.ubelMp -= cost;
        st.combo += 1;
        const base = 38 + st.slashBonus + ((st.turn * 7) % 16);
        const mult = st.bossBound ? 2.2 : 1.0;
        const dmg = Math.round(base * mult);
        st.bossHp = Math.max(0, st.bossHp - dmg);
        st.duelLog1 = st.bossBound
          ? `Execution Cleave (2.2x Crit) — Reelseiden bisects the sight-locked ${boss.name} for ${dmg} damage.`
          : `Reelseiden activates — invisible severing arc cuts ${boss.name} for ${dmg} damage (Combo x${st.combo}).`;
        st.bossBound = false;
      }
    } else if (act === "sorganeil") {
      const cost = 18;
      st.ubelMp = Math.max(0, st.ubelMp - cost);
      st.bossBound = true;
      st.bossCharging = false;
      st.combo += 1;
      const chip = 18 + (st.turn % 8);
      st.bossHp = Math.max(0, st.bossHp - chip);
      st.duelLog1 = `Sorganeil locks ${boss.name} entirely within sight — target paralyzed (${chip} dmg, next Reelseiden deals 2.2x).`;
    } else if (act === "ward") {
      st.ubelMp = Math.min(st.ubelMaxMp, st.ubelMp + 32);
      st.ubelHp = Math.min(st.ubelMaxHp, st.ubelHp + 22);
      st.wardActive = true;
      const counter = 22;
      st.bossHp = Math.max(0, st.bossHp - counter);
      st.duelLog1 = `Hexagonal Mana Ward refracts incoming Zoltraak — restored +22 HP, +32 MP & countered for ${counter} damage.`;
    }

    // Check Boss defeat -> advance gauntlet stage
    if (st.bossHp <= 0) {
      st.wins += 1;
      const oldName = boss.name;
      st.stageIdx = (st.stageIdx + 1) % BOSS_ROSTER.length;
      const nextBoss = BOSS_ROSTER[st.stageIdx];
      st.bossMaxHp = nextBoss.maxHp;
      st.bossHp = nextBoss.maxHp;
      st.bossBound = false;
      st.bossCharging = false;
      st.ubelHp = st.ubelMaxHp;
      st.ubelMp = st.ubelMaxMp;
      st.duelLog2 = `${oldName} dissolves into mana particles. Trial #${st.wins} cleared — advancing to ${nextBoss.name}.`;
      return;
    }

    // Boss turn
    if (st.bossBound) {
      st.duelLog2 = `${boss.name} is immobilized by Sorganeil’s binding gaze and cannot act this turn.`;
    } else if (!st.bossCharging && (st.turn % 3 === 0)) {
      st.bossCharging = true;
      st.duelLog2 = `Warning: ${boss.name} elevates dense mana for a lethal strike — cast Sorganeil to interrupt or Ward to block.`;
    } else {
      const rawAtk = st.bossCharging ? 34 + (st.turn % 10) : 15 + ((st.turn * 5) % 11);
      const taken = st.wardActive ? Math.floor(rawAtk * 0.25) : rawAtk;
      const wasCharged = st.bossCharging;
      st.bossCharging = false;
      st.wardActive = false;
      st.ubelHp = Math.max(1, st.ubelHp - taken);
      st.duelLog2 = taken < rawAtk
        ? `Defensive lattice disperses ${boss.name}’s ${wasCharged ? "charged barrage" : "strike"} (only ${taken} residual damage).`
        : `${boss.name} unleashes ${wasCharged ? "Cataclysmic Zoltraak" : "mirror spellcraft"} for ${taken} damage.`;
      if (st.ubelHp <= 15) {
        st.ubelHp = 68;
        st.duelLog2 += " First-Class resolve triggers Second Wind (+53 HP).";
      }
    }
    return;
  }

  // Reliquary Coffer Appraisal: chest1, chest2, chest3
  if (act === "chest1" || act === "chest2" || act === "chest3") {
    const idx = act === "chest1" ? 0 : act === "chest2" ? 1 : 2;
    const label = ["West Reliquary I", "Sanctum Coffer II", "East Reliquary III"][idx];
    st.lastChestIdx = idx;
    st.chests = ["closed", "closed", "closed"];

    const isMimic = ((st.turn + idx * 2) % 3) === 0;
    if (isMimic) {
      st.chests[idx] = "mimic";
      st.mimicsTriggered += 1;
      st.ubelHp = Math.max(18, st.ubelHp - 15);
      st.chestLog1 = `${label} was a Mimic ambush (-15 HP). “It’s dark and scary! Pull me out!”`;
      st.chestLog2 = "Frieren’s 99% appraisal missed the final 1% margin of dungeon error.";
    } else {
      st.chests[idx] = "grimoire";
      st.grimoiresFound += 1;
      const loot = GRIMOIRE_LOOT[(st.turn + idx) % GRIMOIRE_LOOT.length];
      st.ubelHp = Math.min(st.ubelMaxHp, st.ubelHp + loot.healHp);
      st.ubelMp = Math.min(st.ubelMaxMp, st.ubelMp + loot.healMp);
      if (loot.title.includes("Reelseiden")) st.slashBonus = Math.min(24, st.slashBonus + 6);
      if (loot.bonusDmg > 0) st.bossHp = Math.max(10, st.bossHp - loot.bonusDmg);
      if (loot.bind) st.bossBound = true;
      st.chestLog1 = `${label} appraised: ${loot.title}.`;
      st.chestLog2 = `${loot.effect}.`;
    }
  }
}

function renderSegmentedBar(x, y, w, h, val, maxVal, fillGrad, bgCol, segments = 12) {
  const pct = Math.max(0, Math.min(1, val / Math.max(1, maxVal)));
  const fillW = Math.round(pct * w);
  let ticks = "";
  for (let i = 1; i < segments; i++) {
    const tx = (x + (w / segments) * i).toFixed(1);
    ticks += `<line x1="${tx}" y1="${y}" x2="${tx}" y2="${y + h}" stroke="#0E1310" stroke-opacity="0.55" stroke-width="1"/>`;
  }
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${bgCol}"/>
    <rect x="${x}" y="${y}" width="${fillW}" height="${h}" rx="3" fill="url(#${fillGrad})"/>
    ${ticks}
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="none" stroke="#D4A843" stroke-opacity="0.24" stroke-width="0.7"/>`;
}

function renderReliquaryColumn(cx, yTop, numeral, title, state, isSelected) {
  const accent = state === "mimic" ? "#D4886A" : state === "grimoire" ? "#E5C068" : "#C8C2B4";
  const subCol = state === "mimic" ? "#D4886A" : state === "grimoire" ? "#9CC084" : "#8E887A";
  const ringOp = isSelected ? "0.45" : "0.14";

  let illustration = "";
  if (state === "closed") {
    illustration = `
      <circle cx="${cx}" cy="${yTop + 72}" r="36" fill="none" stroke="#D4A843" stroke-opacity="${ringOp}" stroke-width="0.9" stroke-dasharray="3 4"/>
      <g>
        <animateTransform attributeName="transform" type="translate" values="0,0; 0,-2; 0,0" dur="3.8s" repeatCount="indefinite"/>
        <!-- Gothic Arch Reliquary Lid -->
        <path d="M ${cx - 34} ${yTop + 64} Q ${cx} ${yTop + 46} ${cx + 34} ${yTop + 64} L ${cx + 34} ${yTop + 72} L ${cx - 34} ${yTop + 72} Z" fill="#1B1714" stroke="#D4A843" stroke-width="1.2"/>
        <!-- Coffer Body -->
        <rect x="${cx - 34}" y="${yTop + 72}" width="68" height="28" rx="2.5" fill="#141210" stroke="#D4A843" stroke-width="1.2"/>
        <!-- Filigree Iron-Gold Straps -->
        <line x1="${cx - 20}" y1="${yTop + 57}" x2="${cx - 20}" y2="${yTop + 100}" stroke="#D4A843" stroke-opacity="0.75" stroke-width="1.6"/>
        <line x1="${cx + 20}" y1="${yTop + 57}" x2="${cx + 20}" y2="${yTop + 100}" stroke="#D4A843" stroke-opacity="0.75" stroke-width="1.6"/>
        <line x1="${cx - 34}" y1="${yTop + 86}" x2="${cx + 34}" y2="${yTop + 86}" stroke="#D4A843" stroke-opacity="0.3" stroke-width="0.8"/>
        <!-- Diamond Lock Escutcheon -->
        <polygon points="${cx},${yTop + 65} ${cx + 6},${yTop + 72} ${cx},${yTop + 79} ${cx - 6},${yTop + 72}" fill="#E5C068" stroke="#0E1310" stroke-width="0.8"/>
        <circle cx="${cx}" cy="${yTop + 72}" r="1.4" fill="#0E1310"/>
      </g>
      <text x="${cx}" y="${yTop + 128}" text-anchor="middle" class="folio" font-size="13" fill="#8E887A">Unappraised · 99% Seal</text>`;
  } else if (state === "grimoire") {
    illustration = `
      <circle cx="${cx}" cy="${yTop + 68}" r="38" fill="#E5C068" fill-opacity="0.1">
        <animate attributeName="r" values="30;40;30" dur="3.2s" repeatCount="indefinite"/>
      </circle>
      <circle cx="${cx}" cy="${yTop + 68}" r="34" fill="none" stroke="#E5C068" stroke-opacity="0.5" stroke-width="0.9" stroke-dasharray="4 3">
        <animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${yTop + 68}" to="360 ${cx} ${yTop + 68}" dur="24s" repeatCount="indefinite"/>
      </circle>
      <g>
        <animateTransform attributeName="transform" type="translate" values="0,0; 0,-3.5; 0,0" dur="2.6s" repeatCount="indefinite"/>
        <!-- Open Illuminated Manuscript Pages -->
        <path d="M ${cx - 26} ${yTop + 68} Q ${cx - 13} ${yTop + 62} ${cx} ${yTop + 68} Q ${cx + 13} ${yTop + 62} ${cx + 26} ${yTop + 68} L ${cx + 26} ${yTop + 44} Q ${cx + 13} ${yTop + 38} ${cx} ${yTop + 44} Q ${cx - 13} ${yTop + 38} ${cx - 26} ${yTop + 44} Z" fill="#F4EFE6" stroke="#D4A843" stroke-width="1.3"/>
        <line x1="${cx}" y1="${yTop + 44}" x2="${cx}" y2="${yTop + 68}" stroke="#D4A843" stroke-width="1.2"/>
        <!-- Manuscript Ink Lines & Rune -->
        <line x1="${cx - 20}" y1="${yTop + 51}" x2="${cx - 6}" y2="${yTop + 49}" stroke="#8E887A" stroke-width="1"/>
        <line x1="${cx - 20}" y1="${yTop + 57}" x2="${cx - 6}" y2="${yTop + 55}" stroke="#8E887A" stroke-width="1"/>
        <polygon points="${cx + 13},${yTop + 49} ${cx + 17},${yTop + 54} ${cx + 13},${yTop + 59} ${cx + 9},${yTop + 54}" fill="none" stroke="#9CC084" stroke-width="1.2"/>
      </g>
      <!-- Open Coffer Base -->
      <rect x="${cx - 32}" y="${yTop + 78}" width="64" height="22" rx="2" fill="#181512" stroke="#E5C068" stroke-width="1.2"/>
      <line x1="${cx - 18}" y1="${yTop + 78}" x2="${cx - 18}" y2="${yTop + 100}" stroke="#E5C068" stroke-width="1.4"/>
      <line x1="${cx + 18}" y1="${yTop + 78}" x2="${cx + 18}" y2="${yTop + 100}" stroke="#E5C068" stroke-width="1.4"/>
      <text x="${cx}" y="${yTop + 128}" text-anchor="middle" class="cinzel" font-size="10" fill="#9CC084" letter-spacing="1">GRIMOIRE DISCOVERED</text>`;
  } else {
    illustration = `
      <circle cx="${cx}" cy="${yTop + 70}" r="36" fill="#D4886A" fill-opacity="0.12">
        <animate attributeName="r" values="28;38;28" dur="1.8s" repeatCount="indefinite"/>
      </circle>
      <!-- Eldritch Mimic Maw (Geometric Ivory Fangs & Abyssal Eye) -->
      <path d="M ${cx - 34} ${yTop + 62} Q ${cx} ${yTop + 40} ${cx + 34} ${yTop + 62} Z" fill="#221215" stroke="#D4886A" stroke-width="1.3"/>
      <polygon points="${cx - 26},${yTop + 62} ${cx - 21},${yTop + 71} ${cx - 16},${yTop + 62} ${cx - 10},${yTop + 73} ${cx - 4},${yTop + 62} ${cx},${yTop + 74} ${cx + 4},${yTop + 62} ${cx + 10},${yTop + 73} ${cx + 16},${yTop + 62} ${cx + 21},${yTop + 71} ${cx + 26},${yTop + 62}" fill="#F4EFE6"/>
      <ellipse cx="${cx - 12}" cy="${yTop + 53}" rx="3.2" ry="1.8" fill="#E5C068"/>
      <ellipse cx="${cx + 12}" cy="${yTop + 53}" rx="3.2" ry="1.8" fill="#E5C068"/>
      <rect x="${cx - 34}" y="${yTop + 76}" width="68" height="24" rx="2" fill="#1B1012" stroke="#D4886A" stroke-width="1.3"/>
      <polygon points="${cx - 20},${yTop + 76} ${cx - 15},${yTop + 69} ${cx - 10},${yTop + 76} ${cx + 10},${yTop + 76} ${cx + 15},${yTop + 69} ${cx + 20},${yTop + 76}" fill="#F4EFE6"/>
      <text x="${cx}" y="${yTop + 128}" text-anchor="middle" class="cinzel" font-size="10" fill="#D4886A" letter-spacing="1">1% MIMIC AMBUSH</text>`;
  }

  return `
    <text x="${cx}" y="${yTop + 16}" text-anchor="middle" class="cinzel" font-size="10.5" fill="${accent}" letter-spacing="1.2">${numeral} · ${title}</text>
    ${illustration}`;
}

export function buildGameSvg(st) {
  const boss = BOSS_ROSTER[st.stageIdx % BOSS_ROSTER.length];

  // Center Astrolabe Spell Diagram (cx=332, cy=164)
  let clashArt = "";
  if (st.lastSpell === "reelseiden") {
    clashArt = `
      <circle cx="332" cy="164" r="32" fill="none" stroke="#9CC084" stroke-opacity="0.32" stroke-width="0.9" stroke-dasharray="4 4">
        <animateTransform attributeName="transform" type="rotate" from="0 332 164" to="360 332 164" dur="22s" repeatCount="indefinite"/>
      </circle>
      <circle cx="332" cy="164" r="23" fill="#9CC084" fill-opacity="0.08"/>
      <path d="M 308 186 L 356 142 M 316 192 L 362 148" stroke="#9CC084" stroke-width="2.2" stroke-linecap="round">
        <animate attributeName="stroke-opacity" values="0.45;1;0.45" dur="1.6s" repeatCount="indefinite"/>
      </path>
      <text x="332" y="216" text-anchor="middle" class="cinzel" font-size="9.5" fill="#9CC084" letter-spacing="1.4">REELSEIDEN</text>
      <text x="332" y="231" text-anchor="middle" class="folio" font-size="12.5" fill="#C8C2B4">Combo x${st.combo}</text>`;
  } else if (st.lastSpell === "sorganeil") {
    clashArt = `
      <circle cx="332" cy="164" r="32" fill="none" stroke="#B399EE" stroke-opacity="0.4" stroke-width="1" stroke-dasharray="6 3">
        <animateTransform attributeName="transform" type="rotate" from="360 332 164" to="0 332 164" dur="18s" repeatCount="indefinite"/>
      </circle>
      <ellipse cx="332" cy="164" rx="20" ry="11" fill="none" stroke="#B399EE" stroke-width="1.8"/>
      <circle cx="332" cy="164" r="5" fill="#B399EE">
        <animate attributeName="r" values="3.8;6.5;3.8" dur="1.8s" repeatCount="indefinite"/>
      </circle>
      <text x="332" y="216" text-anchor="middle" class="cinzel" font-size="9.5" fill="#B399EE" letter-spacing="1.4">SORGANEIL</text>
      <text x="332" y="231" text-anchor="middle" class="folio" font-size="12.5" fill="#E5C068">2.2x Execution</text>`;
  } else {
    clashArt = `
      <circle cx="332" cy="164" r="32" fill="none" stroke="#7DA8E6" stroke-opacity="0.35" stroke-width="0.9" stroke-dasharray="3 3"/>
      <polygon points="332,137 355,150 355,178 332,191 309,178 309,150" fill="#7DA8E6" fill-opacity="0.1" stroke="#7DA8E6" stroke-width="1.6">
        <animate attributeName="stroke-opacity" values="0.45;1;0.45" dur="2s" repeatCount="indefinite"/>
      </polygon>
      <text x="332" y="216" text-anchor="middle" class="cinzel" font-size="9.5" fill="#7DA8E6" letter-spacing="1.4">ZOLTRAAK WARD</text>
      <text x="332" y="231" text-anchor="middle" class="folio" font-size="12.5" fill="#C8C2B4">Refraction Active</text>`;
  }

  const ubelImg = UBEL_AVATAR
    ? `<image href="${UBEL_AVATAR}" x="40" y="100" width="64" height="64" preserveAspectRatio="xMidYMin slice" clip-path="url(#ubel_av)"/>`
    : `<rect x="40" y="100" width="64" height="64" rx="8" fill="#161E18"/>`;

  const spiegelImg = SPIEGEL_AVATAR
    ? `<image href="${SPIEGEL_AVATAR}" x="560" y="100" width="64" height="64" preserveAspectRatio="xMidYMin slice" clip-path="url(#spiegel_av)"/>`
    : `<rect x="560" y="100" width="64" height="64" rx="8" fill="#1C1422"/>`;

  const ubelHpBar = renderSegmentedBar(40, 198, 224, 9, st.ubelHp, st.ubelMaxHp, "hp_g", "#171E19", 10);
  const ubelMpBar = renderSegmentedBar(40, 236, 224, 9, st.ubelMp, st.ubelMaxMp, "mp_g", "#181624", 10);
  const bossHpBar = renderSegmentedBar(400, 198, 224, 9, st.bossHp, st.bossMaxHp, "boss_g", "#221417", 10);

  const bossStateLabel = st.bossBound
    ? "SIGHT-LOCKED · 2.2X DMG"
    : st.bossCharging
    ? "MANA SURGE · CHARGING"
    : "MIRROR GUARDIAN · ACTIVE";
  const bossStateCol = st.bossBound ? "#B399EE" : st.bossCharging ? "#E5C068" : "#D4886A";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 420" width="100%" height="100%">
  <defs>
    <linearGradient id="gm_bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0E1310"/>
      <stop offset="50%" stop-color="#131815"/>
      <stop offset="100%" stop-color="#16131E"/>
    </linearGradient>
    <linearGradient id="gm_border" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#D4A843" stop-opacity="0.6"/>
      <stop offset="50%" stop-color="#8BA872" stop-opacity="0.68"/>
      <stop offset="100%" stop-color="#A78BFA" stop-opacity="0.6"/>
    </linearGradient>
    <linearGradient id="hp_g" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#527A56"/>
      <stop offset="100%" stop-color="#9CC084"/>
    </linearGradient>
    <linearGradient id="mp_g" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#6E56AF"/>
      <stop offset="100%" stop-color="#B399EE"/>
    </linearGradient>
    <linearGradient id="boss_g" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#B85650"/>
      <stop offset="100%" stop-color="#E5C068"/>
    </linearGradient>
    <clipPath id="gm_clip"><rect x="0" y="0" width="1200" height="420" rx="16"/></clipPath>
    <clipPath id="ubel_av"><rect x="40" y="100" width="64" height="64" rx="8"/></clipPath>
    <clipPath id="spiegel_av"><rect x="560" y="100" width="64" height="64" rx="8"/></clipPath>
    <style>
      ${FONT_FACE_CSS}
      .cinzel { font-family: 'Cinzel', Georgia, serif; font-weight: 600; }
      .cinzel-b { font-family: 'Cinzel', Georgia, serif; font-weight: 800; }
      .serif { font-family: 'Cormorant', Georgia, serif; font-weight: 600; }
      .folio { font-family: 'CormorantItalic', Georgia, serif; font-style: italic; font-weight: 500; }
      .num { font-family: 'Cinzel', Georgia, serif; font-weight: 800; font-variant-numeric: tabular-nums; }
    </style>
  </defs>

  <rect x="0.5" y="0.5" width="1199" height="419" rx="15.5" fill="url(#gm_bg)" stroke="url(#gm_border)" stroke-width="1.2"/>
  <rect x="6.5" y="6.5" width="1187" height="407" rx="11" fill="none" stroke="#D4A843" stroke-width="0.7" stroke-opacity="0.28"/>
  <polygon points="16,12 20,16 16,20 12,16" fill="#D4A843" fill-opacity="0.65"/>
  <polygon points="1184,12 1188,16 1184,20 1180,16" fill="#D4A843" fill-opacity="0.65"/>
  <polygon points="16,408 20,404 16,400 12,404" fill="#D4A843" fill-opacity="0.65"/>
  <polygon points="1184,408 1188,404 1184,400 1180,404" fill="#D4A843" fill-opacity="0.65"/>

  <g clip-path="url(#gm_clip)">
    <!-- RUNNING FOLIO HEADER -->
    <polygon points="40,32 45,37 40,42 35,37" fill="#D4A843"/>
    <text x="56" y="42" class="cinzel" font-size="18" fill="#F4EFE6" letter-spacing="0.8">THE KING’S TOMB  ·  FIRST-CLASS EXAM &amp; RELIQUARY TRIAL</text>
    <text x="1164" y="42" text-anchor="end" class="folio" font-size="15" fill="#E5C068">Sanctuaries Cleared: ${st.wins}  ·  Grimoires Appraised: ${st.grimoiresFound}  ·  Mimic Encounters: ${st.mimicsTriggered}</text>
    <line x1="36" y1="56" x2="1164" y2="56" stroke="#D4A843" stroke-opacity="0.28" stroke-width="1"/>

    <!-- ================================================================== -->
    <!-- COLUMN I: SPIEGEL SANCTUARY DUEL (x=36..624) — Hairline Architecture -->
    <!-- ================================================================== -->
    <text x="40" y="82" class="cinzel" font-size="11.5" fill="#9CC084" letter-spacing="1.4">I · SPIEGEL SANCTUARY DUEL</text>
    <text x="624" y="82" text-anchor="end" class="folio" font-size="14" fill="#C8C2B4">${xmlEsc(boss.stage)}  ·  Turn ${st.turn}</text>

    <!-- Left Combatant: Ubel -->
    ${ubelImg}
    <rect x="40" y="100" width="64" height="64" rx="8" fill="none" stroke="#9CC084" stroke-opacity="0.8" stroke-width="1.3"/>
    <rect x="43" y="103" width="58" height="58" rx="6" fill="none" stroke="#D4A843" stroke-opacity="0.35" stroke-width="0.7"/>
    <text x="116" y="117" class="cinzel-b" font-size="14" fill="#F4EFE6">ÜBEL · FITZZXYZ</text>
    <text x="116" y="136" class="folio" font-size="13.5" fill="#9CC084">First-Class · +${st.slashBonus} Sever</text>
    <text x="116" y="154" class="cinzel" font-size="9.5" fill="#E5C068" letter-spacing="0.8">${st.wardActive ? "WARD LATTICE ACTIVE" : "REELSEIDEN STANCE"}</text>

    <text x="40" y="191" class="cinzel" font-size="10" fill="#9CC084" letter-spacing="1.2">VITALITY</text>
    <text x="264" y="191" text-anchor="end" class="num" font-size="11" fill="#F4EFE6">${st.ubelHp} / ${st.ubelMaxHp}</text>
    ${ubelHpBar}

    <text x="40" y="229" class="cinzel" font-size="10" fill="#B399EE" letter-spacing="1.2">MANA POOL</text>
    <text x="264" y="229" text-anchor="end" class="num" font-size="11" fill="#F4EFE6">${st.ubelMp} / ${st.ubelMaxMp}</text>
    ${ubelMpBar}

    <!-- Center Astrolabe Spell Diagram -->
    ${clashArt}

    <!-- Right Combatant: Spiegel Replica -->
    ${spiegelImg}
    <rect x="560" y="100" width="64" height="64" rx="8" fill="none" stroke="${bossStateCol}" stroke-opacity="0.85" stroke-width="1.3"/>
    <rect x="563" y="103" width="58" height="58" rx="6" fill="none" stroke="#D4A843" stroke-opacity="0.35" stroke-width="0.7"/>
    <text x="548" y="117" text-anchor="end" class="cinzel-b" font-size="13.5" fill="#F4EFE6">${xmlEsc(boss.name)}</text>
    <text x="548" y="136" text-anchor="end" class="folio" font-size="13.5" fill="#E5C068">${xmlEsc(boss.title)}</text>
    <text x="548" y="154" text-anchor="end" class="cinzel" font-size="9.5" fill="${bossStateCol}" letter-spacing="0.6">${bossStateLabel}</text>

    <text x="400" y="191" class="cinzel" font-size="10" fill="#E5C068" letter-spacing="1.2">REPLICA INTEGRITY</text>
    <text x="624" y="191" text-anchor="end" class="num" font-size="11" fill="#F4EFE6">${st.bossHp} / ${st.bossMaxHp}</text>
    ${bossHpBar}

    <text x="400" y="229" class="cinzel" font-size="10" fill="#8E887A" letter-spacing="1.2">TRAIT</text>
    <text x="624" y="229" text-anchor="end" class="folio" font-size="13.5" fill="#C8C2B4">${xmlEsc(boss.trait)}</text>
    <line x1="400" y1="242" x2="624" y2="242" stroke="#D4A843" stroke-opacity="0.22" stroke-width="1"/>

    <!-- Duel Chronicle Well (Borderless Recessed Surface #0A0D0B) -->
    <line x1="40" y1="268" x2="624" y2="268" stroke="#D4A843" stroke-opacity="0.28" stroke-width="1"/>
    <rect x="40" y="280" width="584" height="112" rx="8" fill="#090C0A"/>
    <text x="56" y="304" class="cinzel" font-size="10.5" fill="#E5C068" letter-spacing="1.4">COMBAT CHRONICLE INSCRIPTION</text>
    <text x="56" y="334" class="serif" font-size="15.5" fill="#F4EFE6">${xmlEsc(st.duelLog1)}</text>
    <text x="56" y="364" class="folio" font-size="15" fill="#9CC084">${xmlEsc(st.duelLog2)}</text>

    <!-- Master Vertical Hairline Divider -->
    <line x1="648" y1="70" x2="648" y2="394" stroke="#D4A843" stroke-opacity="0.28" stroke-width="1"/>

    <!-- ================================================================== -->
    <!-- COLUMN II: RELIQUARY APPRAISAL (x=672..1164) — Hairline Columns     -->
    <!-- ================================================================== -->
    <text x="672" y="82" class="cinzel" font-size="11.5" fill="#E5C068" letter-spacing="1.4">II · DUNGEON RELIQUARY APPRAISAL</text>
    <text x="1164" y="82" text-anchor="end" class="folio" font-size="14" fill="#9CC084">Frieren’s 99% Detection Theorem</text>

    ${renderReliquaryColumn(748, 104, "I", "WEST COFFER", st.chests[0], st.lastChestIdx === 0)}
    <line x1="832" y1="108" x2="832" y2="246" stroke="#D4A843" stroke-opacity="0.2" stroke-width="1"/>
    ${renderReliquaryColumn(918, 104, "II", "SANCTUM", st.chests[1], st.lastChestIdx === 1)}
    <line x1="1002" y1="108" x2="1002" y2="246" stroke="#D4A843" stroke-opacity="0.2" stroke-width="1"/>
    ${renderReliquaryColumn(1086, 104, "III", "EAST COFFER", st.chests[2], st.lastChestIdx === 2)}

    <!-- Reliquary Appraisal Well (Borderless Recessed Surface #0A0D0B) -->
    <line x1="672" y1="268" x2="1164" y2="268" stroke="#D4A843" stroke-opacity="0.28" stroke-width="1"/>
    <rect x="672" y="280" width="492" height="112" rx="8" fill="#090C0A"/>
    <text x="688" y="304" class="cinzel" font-size="10.5" fill="#B399EE" letter-spacing="1.4">RELIQUARY APPRAISAL LEDGER</text>
    <text x="688" y="334" class="serif" font-size="15.5" fill="#F4EFE6">${xmlEsc(st.chestLog1)}</text>
    <text x="688" y="364" class="folio" font-size="14.5" fill="#C8C2B4">${xmlEsc(st.chestLog2)}</text>
  </g>
</svg>`;
}

function buildInteractiveConsoleHtml(svgContent) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>FitzzXYZ · The King’s Tomb & Reliquary Trial (Sousou no Frieren × Übel)</title>
  <style>
    ${FONT_FACE_CSS}
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 28px 18px; min-height: 100vh;
      background: radial-gradient(circle at 50% 0%, #161D18 0%, #0A0D0B 72%);
      color: #F4EFE6; font-family: 'Cormorant', Georgia, serif;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
    }
    .wrap { width: 100%; max-width: 1160px; display: flex; flex-direction: column; gap: 18px; align-items: center; }
    .top-bar {
      width: 100%; display: flex; justify-content: space-between; align-items: center;
      flex-wrap: wrap; gap: 12px; padding-bottom: 12px;
      border-bottom: 1px solid rgba(212,168,67,0.24);
    }
    .back-link {
      display: inline-flex; align-items: center; gap: 10px;
      padding: 9px 18px; border-radius: 8px; text-decoration: none;
      background: #101512; color: #F4EFE6; border: 1px solid rgba(212,168,67,0.45);
      font-family: 'Cinzel', Georgia, serif; font-size: 12px; letter-spacing: 0.8px;
      transition: border-color 0.18s ease, background 0.18s ease;
    }
    .back-link:hover { border-color: #9CC084; background: #151C18; }
    .folio-note { font-family: 'CormorantItalic', Georgia, serif; font-style: italic; color: #C8C2B4; font-size: 15.5px; }
    #arena-box { width: 100%; border-radius: 16px; box-shadow: 0 24px 60px rgba(0,0,0,0.72); overflow: hidden; }
    .control-grid {
      display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; width: 100%;
    }
    @media (max-width: 920px) { .control-grid { grid-template-columns: repeat(3, 1fr); } }
    @media (max-width: 520px) { .control-grid { grid-template-columns: repeat(2, 1fr); } }
    button.grimoire-btn {
      cursor: pointer; padding: 12px 14px; border-radius: 9px;
      background: #101512; color: #F4EFE6;
      border: 1px solid rgba(212,168,67,0.38);
      text-align: left; display: flex; flex-direction: column; gap: 4px;
      transition: border-color 0.16s ease, transform 0.14s ease, background 0.16s ease;
    }
    button.grimoire-btn:hover { transform: translateY(-2px); background: #151B17; border-color: #E5C068; }
    button.grimoire-btn:active { transform: translateY(0); }
    .btn-head { display: flex; justify-content: space-between; align-items: center; width: 100%; }
    .btn-title { font-family: 'Cinzel', Georgia, serif; font-size: 11.5px; font-weight: 600; letter-spacing: 0.8px; }
    .btn-key {
      font-family: 'Cinzel', Georgia, serif; font-size: 10px; color: #8E887A;
      border: 1px solid rgba(212,168,67,0.25); border-radius: 4px; padding: 1px 6px;
    }
    .btn-sub { font-family: 'CormorantItalic', Georgia, serif; font-style: italic; font-size: 14px; color: #9CA3AF; }
    .moss { color: #9CC084; }
    .amethyst { color: #B399EE; }
    .azure { color: #7DA8E6; }
    .gold { color: #E5C068; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="top-bar">
      <a class="back-link" href="https://github.com/FitzzXYZ">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E5C068" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        RETURN TO FITZZXYZ GITHUB CHRONICLE
      </a>
      <span class="folio-note">Live Grimoire Sanctum — every spell cast here updates the SVG state on the GitHub README (Keys 1–6)</span>
    </div>
    <div id="arena-box">${svgContent}</div>
    <div class="control-grid">
      <button class="grimoire-btn" onclick="play('reelseiden')">
        <div class="btn-head"><span class="btn-title"><span class="moss">I</span> · REELSEIDEN</span><span class="btn-key">1</span></div>
        <span class="btn-sub">Severing Slash · 38–54 Dmg</span>
      </button>
      <button class="grimoire-btn" onclick="play('sorganeil')">
        <div class="btn-head"><span class="btn-title"><span class="amethyst">II</span> · SORGANEIL</span><span class="btn-key">2</span></div>
        <span class="btn-sub">Sight-Lock · 2.2x Next Hit</span>
      </button>
      <button class="grimoire-btn" onclick="play('ward')">
        <div class="btn-head"><span class="btn-title"><span class="azure">III</span> · ZOLTRAAK WARD</span><span class="btn-key">3</span></div>
        <span class="btn-sub">Counter &amp; +32 MP / +22 HP</span>
      </button>
      <button class="grimoire-btn" onclick="play('chest1')">
        <div class="btn-head"><span class="btn-title"><span class="gold">I</span> · WEST COFFER</span><span class="btn-key">4</span></div>
        <span class="btn-sub">Appraise Reliquary (99%)</span>
      </button>
      <button class="grimoire-btn" onclick="play('chest2')">
        <div class="btn-head"><span class="btn-title"><span class="gold">II</span> · SANCTUM COFFER</span><span class="btn-key">5</span></div>
        <span class="btn-sub">Appraise Reliquary (99%)</span>
      </button>
      <button class="grimoire-btn" onclick="play('chest3')">
        <div class="btn-head"><span class="btn-title"><span class="gold">III</span> · EAST COFFER</span><span class="btn-key">6</span></div>
        <span class="btn-sub">Appraise Reliquary (99%)</span>
      </button>
    </div>
  </div>
  <script>
    async function play(move) {
      const r = await fetch('/api/game?act=' + move + '&json=1', { cache: 'no-store' });
      const data = await r.json();
      document.getElementById('arena-box').innerHTML = data.svg;
    }
    window.addEventListener('keydown', (e) => {
      const map = { '1': 'reelseiden', '2': 'sorganeil', '3': 'ward', '4': 'chest1', '5': 'chest2', '6': 'chest3', 'r': 'reset' };
      if (map[e.key]) play(map[e.key]);
    });
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
