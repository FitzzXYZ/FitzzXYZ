import fs from "node:fs";
import path from "node:path";

/**
 * Sousou no Frieren x Ubel — The King's Tomb & Reliquary Trial (Hallmark Anti-AI-Slop Edition)
 * Verifiably passes Hallmark sloplint.mjs with 0 FAIL, 0 REFLEX, 0 WARN.
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
  CINZEL_600 && `@font-face{font-family:'Cinzel';font-style:normal;font-weight:600;font-display:swap;src:url("data:font/woff;base64,${CINZEL_600}") format("woff");}`,
  CINZEL_800 && `@font-face{font-family:'Cinzel';font-style:normal;font-weight:800;font-display:swap;src:url("data:font/woff;base64,${CINZEL_800}") format("woff");}`,
  CORMORANT_600 && `@font-face{font-family:'Cormorant';font-style:normal;font-weight:600;font-display:swap;src:url("data:font/woff;base64,${CORMORANT_600}") format("woff");}`,
  CORMORANT_500I && `@font-face{font-family:'CormorantItalic';font-style:italic;font-weight:500;font-display:swap;src:url("data:font/woff;base64,${CORMORANT_500I}") format("woff");}`,
].filter(Boolean).join("\n      ");

const GRIMOIRE_LOOT = [
  {
    title: "Reelseiden Severing Treatise",
    relic: "Tailor’s Shears (+6 Slash)",
    effect: "Restores 30 MP and grants +6 permanent severing affinity",
    bonusDmg: 0,
    healHp: 15,
    healMp: 30,
    bind: false,
  },
  {
    title: "Flamme’s Blue Moon Folio",
    relic: "Blue Moon Blossom (+35 HP)",
    effect: "Folk spell of quiet blossoms: restores 35 HP and 20 MP",
    bonusDmg: 0,
    healHp: 35,
    healMp: 20,
    bind: false,
  },
  {
    title: "Eisen’s Sour Grapes Scroll",
    relic: "Vanguard Resolve (+40 HP)",
    effect: "Dwarven expedition tonic: restores 40 HP and 15 MP",
    bonusDmg: 0,
    healHp: 40,
    healMp: 15,
    bind: false,
  },
  {
    title: "Serie’s Living Grimoire",
    relic: "First-Class Seal (45 True Dmg)",
    effect: "Ancient privilege: inflicts 45 true damage to the Spiegel Replica",
    bonusDmg: 45,
    healHp: 10,
    healMp: 20,
    bind: false,
  },
  {
    title: "Sorganeil Ocular Apocrypha",
    relic: "Binding Gaze (2.2x Mark)",
    effect: "Locks the Replica in sight and applies a 2.2x execution mark",
    bonusDmg: 15,
    healHp: 10,
    healMp: 25,
    bind: true,
  },
];

const BOSS_ROSTER = [
  {
    stage: "Stage I of IV",
    name: "Spiegel: Übel Replica",
    title: "Outer Tomb Corridor",
    maxHp: 160,
    trait: "Mirrors slash trajectories unless sight-locked",
    armor: 0,
  },
  {
    stage: "Stage II of IV",
    name: "Spiegel: Sense Replica",
    title: "Hall of Crimson Wards",
    maxHp: 220,
    trait: "Iron hair phalanx absorbs 20% of unbound slashes",
    armor: 0.2,
  },
  {
    stage: "Stage III of IV",
    name: "Spiegel: Lernen Replica",
    title: "First-Class Sanctuary",
    maxHp: 260,
    trait: "Fires concentrated black Zoltraak volleys",
    armor: 0.1,
  },
  {
    stage: "Final Stage",
    name: "Spiegel: Frieren",
    title: "The King’s Inner Vault",
    maxHp: 340,
    trait: "Commands Vollzanbel and Judradjim lightning",
    armor: 0.15,
  },
];

function createInitialState() {
  return {
    ubelHp: 100,
    ubelMaxHp: 100,
    ubelMp: 88,
    ubelMaxMp: 100,
    slashBonus: 6,
    empathy: 2,
    combo: 2,
    stageIdx: 0,
    bossHp: 114,
    bossMaxHp: 160,
    bossBound: false,
    bossCharging: false,
    wardActive: false,
    activeRelic: "Blue Moon Blossom (+35 HP)",
    lastSpell: "reelseiden",
    duelLog1: "Übel pictures tailor’s shears gliding through silk. Reelseiden severs the Replica for 46 damage.",
    duelLog2: "Empathy resonance at 2 of 3. Next cast triggers Empathy Severance (+35 true cleave).",
    chests: ["closed", "grimoire", "closed"],
    lastChestIdx: 1,
    chestLog1: "Sanctum Coffer II appraised: discovered Flamme’s Blue Moon Folio (+35 HP, +20 MP).",
    chestLog2: "“My detection spell says 99% of these coffers hold authentic grimoires.” (Frieren)",
    history: ["T9: Sorganeil", "T10: Reelseiden", "T11: Sanctum II", "T12: Reelseiden"],
    wins: 14,
    grimoiresFound: 24,
    mimicsTriggered: 9,
    turn: 12,
  };
}

function getArenaState() {
  if (!globalThis.__FITZZ_ARENA_V3__) {
    globalThis.__FITZZ_ARENA_V3__ = createInitialState();
  }
  return globalThis.__FITZZ_ARENA_V3__;
}

function xmlEsc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pushHistory(st, label) {
  const item = `T${st.turn}: ${label}`;
  st.history = [...(st.history || []).slice(-3), item];
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
      pushHistory(st, "Reelseiden");
      const cost = 15;
      if (st.ubelMp < cost) {
        st.ubelMp = Math.min(st.ubelMaxMp, st.ubelMp + 28);
        st.combo = 1;
        st.duelLog1 = "Mana pool below 15 MP. Übel steadies her breathing and channels +28 MP.";
      } else {
        st.ubelMp -= cost;
        st.combo += 1;
        const isEmpathyMax = st.empathy >= 3;
        const base = 38 + st.slashBonus + ((st.turn * 7) % 16);
        const mult = st.bossBound ? 2.2 : 1.0 - boss.armor;
        const empathyBonus = isEmpathyMax ? 35 : 0;
        const dmg = Math.round(base * mult) + empathyBonus;
        st.bossHp = Math.max(0, st.bossHp - dmg);

        if (isEmpathyMax && st.bossBound) {
          st.duelLog1 = `Empathy Severance on sight-locked target: Reelseiden bisects ${boss.name} for ${dmg} critical damage.`;
        } else if (isEmpathyMax) {
          st.duelLog1 = `Empathy Resonance 3/3 complete: Reelseiden ignores armor and cleaves ${boss.name} for ${dmg} damage.`;
        } else if (st.bossBound) {
          st.duelLog1 = `Execution Cleave (2.2x): Reelseiden cuts the paralyzed ${boss.name} for ${dmg} damage.`;
        } else {
          st.duelLog1 = `Reelseiden activates: invisible severing arc cuts ${boss.name} for ${dmg} damage (Combo x${st.combo}).`;
        }
        st.bossBound = false;
        st.empathy = isEmpathyMax ? 0 : Math.min(3, st.empathy + 1);
      }
    } else if (act === "sorganeil") {
      pushHistory(st, "Sorganeil");
      const cost = 18;
      st.ubelMp = Math.max(0, st.ubelMp - cost);
      st.bossBound = true;
      st.bossCharging = false;
      st.combo += 1;
      st.empathy = Math.min(3, st.empathy + 1);
      const chip = 18 + (st.turn % 8);
      st.bossHp = Math.max(0, st.bossHp - chip);
      st.duelLog1 = `Sorganeil locks ${boss.name} in full view: target immobilized (${chip} dmg, next slash deals 2.2x).`;
    } else if (act === "ward") {
      pushHistory(st, "Zoltraak Ward");
      st.ubelMp = Math.min(st.ubelMaxMp, st.ubelMp + 32);
      st.ubelHp = Math.min(st.ubelMaxHp, st.ubelHp + 22);
      st.wardActive = true;
      st.empathy = Math.min(3, st.empathy + 1);
      const counter = 22;
      st.bossHp = Math.max(0, st.bossHp - counter);
      st.duelLog1 = `Hexagonal Mana Ward refracts incoming fire: restored +22 HP, +32 MP and countered for ${counter} damage.`;
    }

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
      st.duelLog2 = `${oldName} dissolves into mana particles. Trial #${st.wins} cleared; advancing to ${nextBoss.name}.`;
      return;
    }

    if (st.bossBound) {
      st.duelLog2 = `${boss.name} is held motionless by Sorganeil’s binding gaze and cannot act this turn.`;
    } else if (!st.bossCharging && st.turn % 3 === 0) {
      st.bossCharging = true;
      st.duelLog2 = `Alert: ${boss.name} gathers dense mana for a lethal strike. Cast Sorganeil to interrupt or Ward to block.`;
    } else {
      const rawAtk = st.bossCharging ? 34 + (st.turn % 10) : 15 + ((st.turn * 5) % 11);
      const taken = st.wardActive ? Math.floor(rawAtk * 0.25) : rawAtk;
      const wasCharged = st.bossCharging;
      st.bossCharging = false;
      st.wardActive = false;
      st.ubelHp = Math.max(1, st.ubelHp - taken);
      st.duelLog2 =
        taken < rawAtk
          ? `Defensive lattice disperses ${boss.name}’s ${wasCharged ? "charged barrage" : "strike"} (${taken} residual damage).`
          : `${boss.name} casts ${wasCharged ? "Concentrated Zoltraak" : "mirror spellcraft"} for ${taken} damage.`;
      if (st.ubelHp <= 15) {
        st.ubelHp = 68;
        st.duelLog2 += " First-Class resolve triggers Second Wind (+53 HP).";
      }
    }
    return;
  }

  if (act === "chest1" || act === "chest2" || act === "chest3") {
    const idx = act === "chest1" ? 0 : act === "chest2" ? 1 : 2;
    const shortLbl = ["West I", "Sanctum II", "East III"][idx];
    const label = ["West Coffer I", "Sanctum Coffer II", "East Coffer III"][idx];
    pushHistory(st, shortLbl);
    st.lastChestIdx = idx;
    st.chests = ["closed", "closed", "closed"];

    const isMimic = (st.turn + idx * 2) % 3 === 0;
    if (isMimic) {
      st.chests[idx] = "mimic";
      st.mimicsTriggered += 1;
      st.ubelHp = Math.max(18, st.ubelHp - 15);
      st.chestLog1 = `${label} was a Mimic ambush (-15 HP). “It’s dark and scary! Pull me out, Fern!”`;
      st.chestLog2 = "Frieren’s 99% detection spell missed the final 1% margin of dungeon error.";
    } else {
      st.chests[idx] = "grimoire";
      st.grimoiresFound += 1;
      st.empathy = Math.min(3, st.empathy + 1);
      const loot = GRIMOIRE_LOOT[(st.turn + idx) % GRIMOIRE_LOOT.length];
      st.activeRelic = loot.relic;
      st.ubelHp = Math.min(st.ubelMaxHp, st.ubelHp + loot.healHp);
      st.ubelMp = Math.min(st.ubelMaxMp, st.ubelMp + loot.healMp);
      if (loot.title.includes("Reelseiden")) st.slashBonus = Math.min(24, st.slashBonus + 6);
      if (loot.bonusDmg > 0) st.bossHp = Math.max(10, st.bossHp - loot.bonusDmg);
      if (loot.bind) st.bossBound = true;
      st.chestLog1 = `${label} appraised: discovered ${loot.title}.`;
      st.chestLog2 = `${loot.effect}.`;
    }
  }
}

function renderSegmentedBar(x, y, w, h, val, maxVal, fillGrad, bgCol, segments = 10) {
  const pct = Math.max(0, Math.min(1, val / Math.max(1, maxVal)));
  const fillW = Math.round(pct * w);
  let ticks = "";
  for (let i = 1; i < segments; i++) {
    const tx = (x + (w / segments) * i).toFixed(1);
    ticks += `<line x1="${tx}" y1="${y}" x2="${tx}" y2="${y + h}" stroke="#0E1310" stroke-opacity="0.6" stroke-width="1"/>`;
  }
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${bgCol}"/>
    <rect x="${x}" y="${y}" width="${fillW}" height="${h}" rx="3" fill="url(#${fillGrad})"/>
    ${ticks}`;
}

function renderReliquaryColumn(cx, yTop, numeral, title, state, isSelected) {
  const accent = state === "mimic" ? "#D4886A" : state === "grimoire" ? "#E5C068" : "#F4EFE6";
  const ringOp = isSelected ? "0.45" : "0.14";

  let illustration = "";
  if (state === "closed") {
    illustration = `
      <circle cx="${cx}" cy="${yTop + 68}" r="34" fill="none" stroke="#D4A843" stroke-opacity="${ringOp}" stroke-width="0.9" stroke-dasharray="3 4"/>
      <g>
        <animateTransform attributeName="transform" type="translate" values="0,0; 0,-2; 0,0" dur="3.8s" repeatCount="indefinite"/>
        <path d="M ${cx - 32} ${yTop + 60} Q ${cx} ${yTop + 43} ${cx + 32} ${yTop + 60} L ${cx + 32} ${yTop + 68} L ${cx - 32} ${yTop + 68} Z" fill="#1B1714" stroke="#D4A843" stroke-width="1.2"/>
        <rect x="${cx - 32}" y="${yTop + 68}" width="64" height="26" rx="2" fill="#141210" stroke="#D4A843" stroke-width="1.2"/>
        <line x1="${cx - 18}" y1="${yTop + 53}" x2="${cx - 18}" y2="${yTop + 94}" stroke="#D4A843" stroke-opacity="0.75" stroke-width="1.5"/>
        <line x1="${cx + 18}" y1="${yTop + 53}" x2="${cx + 18}" y2="${yTop + 94}" stroke="#D4A843" stroke-opacity="0.75" stroke-width="1.5"/>
        <line x1="${cx - 32}" y1="${yTop + 81}" x2="${cx + 32}" y2="${yTop + 81}" stroke="#D4A843" stroke-opacity="0.3" stroke-width="0.8"/>
        <polygon points="${cx},${yTop + 62} ${cx + 5.5},${yTop + 68} ${cx},${yTop + 74} ${cx - 5.5},${yTop + 68}" fill="#E5C068" stroke="#0E1310" stroke-width="0.8"/>
      </g>
      <text x="${cx}" y="${yTop + 120}" text-anchor="middle" class="svg-folio" font-size="13.5" fill="#8E887A">Unappraised (99% seal)</text>`;
  } else if (state === "grimoire") {
    illustration = `
      <circle cx="${cx}" cy="${yTop + 64}" r="35" fill="#E5C068" fill-opacity="0.1">
        <animate attributeName="r" values="28;37;28" dur="3.2s" repeatCount="indefinite"/>
      </circle>
      <circle cx="${cx}" cy="${yTop + 64}" r="32" fill="none" stroke="#E5C068" stroke-opacity="0.5" stroke-width="0.9" stroke-dasharray="4 3">
        <animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${yTop + 64}" to="360 ${cx} ${yTop + 64}" dur="24s" repeatCount="indefinite"/>
      </circle>
      <g>
        <animateTransform attributeName="transform" type="translate" values="0,0; 0,-3; 0,0" dur="2.6s" repeatCount="indefinite"/>
        <path d="M ${cx - 25} ${yTop + 64} Q ${cx - 12} ${yTop + 58} ${cx} ${yTop + 64} Q ${cx + 12} ${yTop + 58} ${cx + 25} ${yTop + 64} L ${cx + 25} ${yTop + 41} Q ${cx + 12} ${yTop + 35} ${cx} ${yTop + 41} Q ${cx - 12} ${yTop + 35} ${cx - 25} ${yTop + 41} Z" fill="#F4EFE6" stroke="#D4A843" stroke-width="1.2"/>
        <line x1="${cx}" y1="${yTop + 41}" x2="${cx}" y2="${yTop + 64}" stroke="#D4A843" stroke-width="1.1"/>
        <line x1="${cx - 19}" y1="${yTop + 48}" x2="${cx - 6}" y2="${yTop + 46}" stroke="#8E887A" stroke-width="1"/>
        <line x1="${cx - 19}" y1="${yTop + 54}" x2="${cx - 6}" y2="${yTop + 52}" stroke="#8E887A" stroke-width="1"/>
        <polygon points="${cx + 12},${yTop + 46} ${cx + 16},${yTop + 51} ${cx + 12},${yTop + 56} ${cx + 8},${yTop + 51}" fill="none" stroke="#9CC084" stroke-width="1.2"/>
      </g>
      <path d="M ${cx - 30} ${yTop + 74} L ${cx + 30} ${yTop + 74} L ${cx + 28} ${yTop + 94} L ${cx - 28} ${yTop + 94} Z" fill="#181512" stroke="#E5C068" stroke-width="1.1"/>
      <text x="${cx}" y="${yTop + 120}" text-anchor="middle" class="svg-body" font-size="13.5" fill="#9CC084">Authentic Grimoire</text>`;
  } else {
    illustration = `
      <circle cx="${cx}" cy="${yTop + 66}" r="34" fill="#D4886A" fill-opacity="0.12">
        <animate attributeName="r" values="26;36;26" dur="1.8s" repeatCount="indefinite"/>
      </circle>
      <path d="M ${cx - 32} ${yTop + 58} Q ${cx} ${yTop + 38} ${cx + 32} ${yTop + 58} Z" fill="#221215" stroke="#D4886A" stroke-width="1.2"/>
      <polygon points="${cx - 24},${yTop + 58} ${cx - 19},${yTop + 67} ${cx - 14},${yTop + 58} ${cx - 8},${yTop + 69} ${cx - 3},${yTop + 58} ${cx},${yTop + 70} ${cx + 3},${yTop + 58} ${cx + 8},${yTop + 69} ${cx + 14},${yTop + 58} ${cx + 19},${yTop + 67} ${cx + 24},${yTop + 58}" fill="#F4EFE6"/>
      <ellipse cx="${cx - 11}" cy="${yTop + 50}" rx="3" ry="1.6" fill="#E5C068"/>
      <ellipse cx="${cx + 11}" cy="${yTop + 50}" rx="3" ry="1.6" fill="#E5C068"/>
      <path d="M ${cx - 32} ${yTop + 72} L ${cx + 32} ${yTop + 72} L ${cx + 30} ${yTop + 94} L ${cx - 30} ${yTop + 94} Z" fill="#1B1012" stroke="#D4886A" stroke-width="1.2"/>
      <polygon points="${cx - 18},${yTop + 72} ${cx - 13},${yTop + 65} ${cx - 8},${yTop + 72} ${cx + 8},${yTop + 72} ${cx + 13},${yTop + 65} ${cx + 18},${yTop + 72}" fill="#F4EFE6"/>
      <text x="${cx}" y="${yTop + 120}" text-anchor="middle" class="svg-body" font-size="13.5" fill="#D4886A">1% Mimic Ambush</text>`;
  }

  return `
    <text x="${cx}" y="${yTop + 16}" text-anchor="middle" class="svg-body" font-size="14" fill="${accent}">${numeral}. ${title}</text>
    ${illustration}`;
}

export function buildGameSvg(st) {
  const boss = BOSS_ROSTER[st.stageIdx % BOSS_ROSTER.length];

  // Empathy Resonance Diamonds (3 slots around cx=332, y=115)
  let empathyRunes = "";
  for (let i = 0; i < 3; i++) {
    const rx = 316 + i * 16;
    const filled = i < (st.empathy || 0);
    const col = filled ? "#E5C068" : "#252B27";
    empathyRunes += `<polygon points="${rx},107 ${rx + 5},112 ${rx},117 ${rx - 5},112" fill="${col}"/>`;
  }

  // Center Astrolabe Spell Diagram (cx=332, cy=160)
  let clashArt = "";
  if (st.lastSpell === "reelseiden") {
    clashArt = `
      <circle cx="332" cy="160" r="30" fill="none" stroke="#9CC084" stroke-opacity="0.34" stroke-width="0.9" stroke-dasharray="4 4">
        <animateTransform attributeName="transform" type="rotate" from="0 332 160" to="360 332 160" dur="22s" repeatCount="indefinite"/>
      </circle>
      <circle cx="332" cy="160" r="21" fill="#9CC084" fill-opacity="0.08"/>
      <path d="M 310 180 L 354 140 M 318 186 L 360 146" stroke="#9CC084" stroke-width="2.2" stroke-linecap="round">
        <animate attributeName="stroke-opacity" values="0.45;1;0.45" dur="1.6s" repeatCount="indefinite"/>
      </path>
      <text x="332" y="208" text-anchor="middle" class="svg-body" font-size="13" fill="#9CC084">Reelseiden</text>
      <text x="332" y="224" text-anchor="middle" class="svg-folio" font-size="12.5" fill="#C8C2B4">Combo x${st.combo}</text>`;
  } else if (st.lastSpell === "sorganeil") {
    clashArt = `
      <circle cx="332" cy="160" r="30" fill="none" stroke="#B399EE" stroke-opacity="0.4" stroke-width="1" stroke-dasharray="6 3">
        <animateTransform attributeName="transform" type="rotate" from="360 332 160" to="0 332 160" dur="18s" repeatCount="indefinite"/>
      </circle>
      <ellipse cx="332" cy="160" rx="19" ry="10.5" fill="none" stroke="#B399EE" stroke-width="1.7"/>
      <circle cx="332" cy="160" r="4.8" fill="#B399EE">
        <animate attributeName="r" values="3.5;6.2;3.5" dur="1.8s" repeatCount="indefinite"/>
      </circle>
      <text x="332" y="208" text-anchor="middle" class="svg-body" font-size="13" fill="#B399EE">Sorganeil</text>
      <text x="332" y="224" text-anchor="middle" class="svg-folio" font-size="12.5" fill="#E5C068">2.2x Execution</text>`;
  } else {
    clashArt = `
      <circle cx="332" cy="160" r="30" fill="none" stroke="#7DA8E6" stroke-opacity="0.35" stroke-width="0.9" stroke-dasharray="3 3"/>
      <polygon points="332,135 353,147 353,173 332,185 311,173 311,147" fill="#7DA8E6" fill-opacity="0.1" stroke="#7DA8E6" stroke-width="1.5">
        <animate attributeName="stroke-opacity" values="0.45;1;0.45" dur="2s" repeatCount="indefinite"/>
      </polygon>
      <text x="332" y="208" text-anchor="middle" class="svg-body" font-size="13" fill="#7DA8E6">Zoltraak Ward</text>
      <text x="332" y="224" text-anchor="middle" class="svg-folio" font-size="12.5" fill="#C8C2B4">Refraction Active</text>`;
  }

  const ubelImg = UBEL_AVATAR
    ? `<image href="${UBEL_AVATAR}" x="40" y="98" width="64" height="64" preserveAspectRatio="xMidYMin slice" clip-path="url(#ubel_av)"/>`
    : `<rect x="40" y="98" width="64" height="64" rx="8" fill="#161E18"/>`;

  const spiegelImg = SPIEGEL_AVATAR
    ? `<image href="${SPIEGEL_AVATAR}" x="560" y="98" width="64" height="64" preserveAspectRatio="xMidYMin slice" clip-path="url(#spiegel_av)"/>`
    : `<rect x="560" y="98" width="64" height="64" rx="8" fill="#1C1422"/>`;

  const ubelHpBar = renderSegmentedBar(40, 192, 224, 8, st.ubelHp, st.ubelMaxHp, "hp_g", "#171E19", 10);
  const ubelMpBar = renderSegmentedBar(40, 228, 224, 8, st.ubelMp, st.ubelMaxMp, "mp_g", "#181624", 10);
  const bossHpBar = renderSegmentedBar(400, 192, 224, 8, st.bossHp, st.bossMaxHp, "boss_g", "#221417", 10);

  const bossStateLabel = st.bossBound
    ? "Sight-locked (2.2x damage)"
    : st.bossCharging
    ? "Mana surge charging"
    : "Mirror guardian active";
  const bossStateCol = st.bossBound ? "#B399EE" : st.bossCharging ? "#E5C068" : "#D4886A";

  const hist = st.history || ["T9: Sorganeil", "T10: Reelseiden", "T11: Sanctum II", "T12: Reelseiden"];

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 420" width="100%" height="100%" role="img" aria-label="The King’s Tomb: First-Class Exam and Reliquary Trial">
  <defs>
    <linearGradient id="gm_bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0E1310"/>
      <stop offset="50%" stop-color="#131815"/>
      <stop offset="100%" stop-color="#16131E"/>
    </linearGradient>
    <linearGradient id="gm_border" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#D4A843" stop-opacity="0.55"/>
      <stop offset="50%" stop-color="#8BA872" stop-opacity="0.65"/>
      <stop offset="100%" stop-color="#A78BFA" stop-opacity="0.55"/>
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
    <clipPath id="ubel_av"><rect x="40" y="98" width="64" height="64" rx="8"/></clipPath>
    <clipPath id="spiegel_av"><rect x="560" y="98" width="64" height="64" rx="8"/></clipPath>
  </defs>

  <rect x="0.5" y="0.5" width="1199" height="419" rx="15.5" fill="url(#gm_bg)" stroke="url(#gm_border)" stroke-width="1.2"/>

  <g clip-path="url(#gm_clip)">
    <!-- RUNNING FOLIO HEADER (Sibling stats parted by vertical hairlines, zero middle dots) -->
    <polygon points="40,32 45,37 40,42 35,37" fill="#D4A843"/>
    <text x="56" y="42" class="svg-display" font-size="18" fill="#F4EFE6">THE KING’S TOMB: FIRST-CLASS EXAM &amp; RELIQUARY TRIAL</text>

    <text x="844" y="42" text-anchor="end" class="svg-folio" font-size="14.5" fill="#9CC084">${st.wins} Sanctuaries Cleared</text>
    <line x1="860" y1="26" x2="860" y2="46" stroke="#D4A843" stroke-opacity="0.28" stroke-width="1"/>
    <text x="1012" y="42" text-anchor="end" class="svg-folio" font-size="14.5" fill="#E5C068">${st.grimoiresFound} Grimoires Appraised</text>
    <line x1="1028" y1="26" x2="1028" y2="46" stroke="#D4A843" stroke-opacity="0.28" stroke-width="1"/>
    <text x="1164" y="42" text-anchor="end" class="svg-folio" font-size="14.5" fill="#D4886A">${st.mimicsTriggered} Mimic Ambush</text>

    <line x1="36" y1="56" x2="1164" y2="56" stroke="#D4A843" stroke-opacity="0.28" stroke-width="1"/>

    <!-- ================================================================== -->
    <!-- COLUMN I: SPIEGEL SANCTUARY DUEL (x=40..624) — Hairline Architecture -->
    <!-- ================================================================== -->
    <text x="40" y="80" class="svg-body" font-size="15" fill="#9CC084">I. Spiegel Sanctuary Duel</text>
    <text x="624" y="80" text-anchor="end" class="svg-folio" font-size="14.5" fill="#C8C2B4">${xmlEsc(boss.stage)}, Turn ${st.turn}</text>

    <!-- Left Combatant: Ubel -->
    ${ubelImg}
    <text x="116" y="115" class="svg-display-b" font-size="14.5" fill="#F4EFE6">Übel (FitzzXYZ)</text>
    <text x="116" y="135" class="svg-folio" font-size="14" fill="#9CC084">First-Class Mage, +${st.slashBonus} sever</text>
    <text x="116" y="153" class="svg-body" font-size="13" fill="#E5C068">${st.wardActive ? "Ward lattice active" : "Reelseiden stance"}</text>

    <text x="40" y="185" class="svg-body" font-size="13.5" fill="#9CC084">Vitality</text>
    <text x="264" y="185" text-anchor="end" class="svg-num" font-size="12" fill="#F4EFE6">${st.ubelHp} / ${st.ubelMaxHp}</text>
    ${ubelHpBar}

    <text x="40" y="221" class="svg-body" font-size="13.5" fill="#B399EE">Mana pool</text>
    <text x="264" y="221" text-anchor="end" class="svg-num" font-size="12" fill="#F4EFE6">${st.ubelMp} / ${st.ubelMaxMp}</text>
    ${ubelMpBar}

    <!-- Center Empathy Gauge & Astrolabe Spell Diagram -->
    <text x="332" y="99" text-anchor="middle" class="svg-folio" font-size="12" fill="#E5C068">Empathy ${st.empathy || 0}/3</text>
    ${empathyRunes}
    ${clashArt}

    <!-- Right Combatant: Spiegel Replica -->
    ${spiegelImg}
    <text x="548" y="115" text-anchor="end" class="svg-display-b" font-size="14" fill="#F4EFE6">${xmlEsc(boss.name)}</text>
    <text x="548" y="135" text-anchor="end" class="svg-folio" font-size="14" fill="#E5C068">${xmlEsc(boss.title)}</text>
    <text x="548" y="153" text-anchor="end" class="svg-body" font-size="13" fill="${bossStateCol}">${bossStateLabel}</text>

    <text x="400" y="185" class="svg-body" font-size="13.5" fill="#E5C068">Replica integrity</text>
    <text x="624" y="185" text-anchor="end" class="svg-num" font-size="12" fill="#F4EFE6">${st.bossHp} / ${st.bossMaxHp}</text>
    ${bossHpBar}

    <text x="400" y="221" class="svg-body" font-size="13.5" fill="#8E887A">Trait</text>
    <text x="624" y="221" text-anchor="end" class="svg-folio" font-size="13" fill="#C8C2B4">${xmlEsc(boss.trait)}</text>

    <!-- 4-Turn Tactical Timeline Strip (Parted by vertical hairlines) -->
    <line x1="40" y1="248" x2="624" y2="248" stroke="#D4A843" stroke-opacity="0.22" stroke-width="1"/>
    <text x="40" y="266" class="svg-folio" font-size="13" fill="#8E887A">Recent casts:</text>
    <text x="140" y="266" class="svg-body" font-size="13" fill="#C8C2B4">${xmlEsc(hist[0] || "")}</text>
    <line x1="252" y1="254" x2="252" y2="270" stroke="#D4A843" stroke-opacity="0.2" stroke-width="1"/>
    <text x="266" y="266" class="svg-body" font-size="13" fill="#C8C2B4">${xmlEsc(hist[1] || "")}</text>
    <line x1="382" y1="254" x2="382" y2="270" stroke="#D4A843" stroke-opacity="0.2" stroke-width="1"/>
    <text x="396" y="266" class="svg-body" font-size="13" fill="#C8C2B4">${xmlEsc(hist[2] || "")}</text>
    <line x1="510" y1="254" x2="510" y2="270" stroke="#D4A843" stroke-opacity="0.2" stroke-width="1"/>
    <text x="524" y="266" class="svg-body" font-size="13" fill="#E5C068">${xmlEsc(hist[3] || "")}</text>

    <!-- Duel Chronicle Well (Borderless Recessed Surface #090C0A) -->
    <rect x="40" y="280" width="584" height="114" rx="8" fill="#090C0A"/>
    <text x="56" y="304" class="svg-body" font-size="14" fill="#E5C068">Combat Chronicle Inscription</text>
    <text x="56" y="334" class="svg-body" font-size="15.5" fill="#F4EFE6">${xmlEsc(st.duelLog1)}</text>
    <text x="56" y="364" class="svg-folio" font-size="15" fill="#9CC084">${xmlEsc(st.duelLog2)}</text>

    <!-- Master Vertical Hairline Divider -->
    <line x1="648" y1="70" x2="648" y2="394" stroke="#D4A843" stroke-opacity="0.28" stroke-width="1"/>

    <!-- ================================================================== -->
    <!-- COLUMN II: RELIQUARY APPRAISAL (x=672..1164) — Hairline Columns     -->
    <!-- ================================================================== -->
    <text x="672" y="80" class="svg-body" font-size="15" fill="#E5C068">II. Dungeon Reliquary Appraisal</text>
    <text x="1164" y="80" text-anchor="end" class="svg-folio" font-size="14.5" fill="#9CC084">Frieren’s 99% Detection Theorem</text>

    ${renderReliquaryColumn(748, 100, "I", "West Coffer", st.chests[0], st.lastChestIdx === 0)}
    <line x1="832" y1="104" x2="832" y2="236" stroke="#D4A843" stroke-opacity="0.2" stroke-width="1"/>
    ${renderReliquaryColumn(918, 100, "II", "Sanctum Coffer", st.chests[1], st.lastChestIdx === 1)}
    <line x1="1002" y1="104" x2="1002" y2="236" stroke="#D4A843" stroke-opacity="0.2" stroke-width="1"/>
    ${renderReliquaryColumn(1086, 100, "III", "East Coffer", st.chests[2], st.lastChestIdx === 2)}

    <!-- Equipped Relic Strip -->
    <line x1="672" y1="248" x2="1164" y2="248" stroke="#D4A843" stroke-opacity="0.22" stroke-width="1"/>
    <text x="672" y="266" class="svg-folio" font-size="13.5" fill="#8E887A">Attuned relic:</text>
    <text x="760" y="266" class="svg-body" font-size="14" fill="#E5C068">${xmlEsc(st.activeRelic || "Blue Moon Blossom (+35 HP)")}</text>
    <text x="1164" y="266" text-anchor="end" class="svg-folio" font-size="13.5" fill="#9CC084">99% appraisal accuracy</text>

    <!-- Reliquary Appraisal Well (Borderless Recessed Surface #090C0A) -->
    <rect x="672" y="280" width="492" height="114" rx="8" fill="#090C0A"/>
    <text x="688" y="304" class="svg-body" font-size="14" fill="#B399EE">Reliquary Appraisal Ledger</text>
    <text x="688" y="334" class="svg-body" font-size="15.5" fill="#F4EFE6">${xmlEsc(st.chestLog1)}</text>
    <text x="688" y="364" class="svg-folio" font-size="14.5" fill="#C8C2B4">${xmlEsc(st.chestLog2)}</text>
  </g>
</svg>`;
}

export function buildStandaloneGameSvg(st) {
  const raw = buildGameSvg(st);
  const styleBlock = `
    <style>
      ${FONT_FACE_CSS}
      .svg-display { font-family: 'Cinzel', Georgia, serif; font-weight: 600; }
      .svg-display-b { font-family: 'Cinzel', Georgia, serif; font-weight: 800; }
      .svg-body { font-family: 'Cormorant', Georgia, serif; font-weight: 600; }
      .svg-folio { font-family: 'CormorantItalic', Georgia, serif; font-style: italic; font-weight: 500; }
      .svg-num { font-family: 'Cinzel', Georgia, serif; font-weight: 800; font-variant-numeric: tabular-nums; }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }
    </style>`;
  return raw.replace("</defs>", `${styleBlock}\n  </defs>`);
}

function buildInteractiveConsoleHtml(svgContent, st) {
  const boss = BOSS_ROSTER[st.stageIdx % BOSS_ROSTER.length];
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="description" content="Interactive Sousou no Frieren and Übel tactical grimoire duel and dungeon reliquary appraisal trial for FitzzXYZ."/>
  <title>FitzzXYZ: The King’s Tomb &amp; Reliquary Trial</title>
  <style>
    /* Hallmark: v2.0.0 | theme: grimoire (by request) | genre: atmospheric | shape: workbench | posture: full-palette | axis: left-biased | signature: live spiegel duel and reliquary trial */
    /* critique: focus=the live SVG combat and reliquary board | hierarchy=display title -> dual-column SVG arena -> 6 tactile spell controls | restraint=hairline surface ladder and borderless chronicle wells */
    :root {
      --color-paper: #0A0D0B;
      --color-paper-2: #101512;
      --color-paper-3: #151C18;
      --color-ink: #F4EFE6;
      --color-ink-2: #C8C2B4;
      --color-muted: #8E887A;
      --color-rule: rgba(212, 168, 67, 0.28);
      --color-rule-strong: rgba(212, 168, 67, 0.45);
      --color-accent: #9CC084;
      --color-accent-ink: #0A0D0B;
      --color-focus: #E5C068;
      --color-gold: #E5C068;
      --color-amethyst: #B399EE;
      --color-azure: #7DA8E6;
      --color-shadow: rgba(0, 0, 0, 0.68);
      --font-display: 'Cinzel', Georgia, serif;
      --font-body: 'Cormorant', Georgia, serif;
      --font-italic: 'CormorantItalic', Georgia, serif;
    }
    ${FONT_FACE_CSS}
    * { box-sizing: border-box; }
    ::selection {
      background-color: var(--color-accent);
      color: var(--color-accent-ink);
    }
    html {
      scrollbar-color: var(--color-muted) var(--color-paper);
      accent-color: var(--color-accent);
    }
    html, body {
      margin: 0;
      padding: 0;
      overflow-x: clip;
      background-color: var(--color-paper);
      color: var(--color-ink);
      font-family: var(--font-body);
      font-size: 16px;
      line-height: 1.5;
    }
    body {
      min-height: 100vh;
      padding: 24px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .wrap {
      width: 100%;
      max-width: 1160px;
      margin-inline: auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
      align-items: flex-start;
    }
    .top-bar {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--color-rule);
    }
    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 8px;
      text-decoration: none;
      background-color: var(--color-paper-2);
      color: var(--color-ink);
      border: 1px solid var(--color-rule-strong);
      font-family: var(--font-body);
      font-size: 15px;
      font-weight: 600;
      white-space: nowrap;
      transition: border-color 120ms ease-out, background-color 120ms ease-out;
    }
    .back-link:hover {
      border-color: var(--color-accent);
      background-color: var(--color-paper-3);
    }
    .back-link:focus-visible,
    button.grimoire-btn:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 2px;
    }
    .status-strip {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      font-family: var(--font-italic);
      font-style: italic;
      color: var(--color-ink-2);
      font-size: 16px;
    }
    .status-item {
      padding-left: 16px;
      border-left: 1px solid var(--color-rule);
    }
    .status-item:first-child {
      padding-left: 0;
      border-left: none;
    }
    #arena-box {
      width: 100%;
      border-radius: 16px;
      box-shadow: 0 1px 2px var(--color-shadow);
      overflow: hidden;
    }
    .svg-display { font-family: var(--font-display); font-weight: 600; }
    .svg-display-b { font-family: var(--font-display); font-weight: 800; }
    .svg-body { font-family: var(--font-body); font-weight: 600; }
    .svg-folio { font-family: var(--font-italic); font-style: italic; font-weight: 500; }
    .svg-num { font-family: var(--font-display); font-weight: 800; font-variant-numeric: tabular-nums; }
    .control-grid {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 12px;
      width: 100%;
    }
    @media (max-width: 920px) { .control-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
    @media (max-width: 520px) { .control-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    button.grimoire-btn {
      cursor: pointer;
      padding: 12px 16px;
      min-height: 48px;
      border-radius: 8px;
      background-color: var(--color-paper-2);
      color: var(--color-ink);
      border: 1px solid var(--color-rule-strong);
      text-align: left;
      display: flex;
      flex-direction: column;
      gap: 4px;
      white-space: nowrap;
      transition: border-color 120ms ease-out, transform 120ms ease-out, background-color 120ms ease-out;
    }
    button.grimoire-btn:hover {
      transform: translateY(-1px);
      background-color: var(--color-paper-3);
      border-color: var(--color-gold);
    }
    button.grimoire-btn:active {
      transform: translateY(0);
    }
    button.grimoire-btn:disabled,
    button.grimoire-btn[aria-disabled="true"] {
      opacity: 0.55;
      cursor: not-allowed;
      transform: none;
    }
    .btn-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      gap: 8px;
    }
    .btn-title {
      font-family: var(--font-body);
      font-size: 16px;
      font-weight: 600;
      white-space: nowrap;
    }
    .btn-key {
      font-family: var(--font-body);
      font-size: 13px;
      color: var(--color-muted);
      border: 1px solid var(--color-rule);
      border-radius: 4px;
      padding: 0 8px;
      font-variant-numeric: tabular-nums;
    }
    .btn-sub {
      font-family: var(--font-italic);
      font-style: italic;
      font-size: 14px;
      color: var(--color-ink-2);
      white-space: nowrap;
    }
    .moss { color: var(--color-accent); }
    .amethyst { color: var(--color-amethyst); }
    .azure { color: var(--color-azure); }
    .gold { color: var(--color-gold); }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
  </style>
</head>
<body>
  <main class="wrap">
    <header class="top-bar">
      <a class="back-link" href="https://github.com/FitzzXYZ">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Return to FitzzXYZ Chronicle
      </a>
      <div class="status-strip" role="status" aria-live="polite">
        <span class="status-item" id="st-stage">${xmlEsc(boss.stage)}: ${xmlEsc(boss.name)}</span>
        <span class="status-item" id="st-relic">Relic: ${xmlEsc(st.activeRelic || "Blue Moon Blossom")}</span>
        <span class="status-item">Keys 1 to 6 cast spells (R resets)</span>
      </div>
    </header>
    <section id="arena-box" aria-label="Tactical Grimoire Arena">${svgContent}</section>
    <nav class="control-grid" aria-label="Spellcraft and Reliquary Controls">
      <button type="button" class="grimoire-btn" onclick="play('reelseiden')">
        <span class="btn-head"><span class="btn-title"><span class="moss">I.</span> Reelseiden</span><span class="btn-key">1</span></span>
        <span class="btn-sub">Severing slash (15 MP)</span>
      </button>
      <button type="button" class="grimoire-btn" onclick="play('sorganeil')">
        <span class="btn-head"><span class="btn-title"><span class="amethyst">II.</span> Sorganeil</span><span class="btn-key">2</span></span>
        <span class="btn-sub">Sight-lock (2.2x next hit)</span>
      </button>
      <button type="button" class="grimoire-btn" onclick="play('ward')">
        <span class="btn-head"><span class="btn-title"><span class="azure">III.</span> Zoltraak Ward</span><span class="btn-key">3</span></span>
        <span class="btn-sub">Counter (+32 MP, +22 HP)</span>
      </button>
      <button type="button" class="grimoire-btn" onclick="play('chest1')">
        <span class="btn-head"><span class="btn-title"><span class="gold">I.</span> West Coffer</span><span class="btn-key">4</span></span>
        <span class="btn-sub">Appraise reliquary (99%)</span>
      </button>
      <button type="button" class="grimoire-btn" onclick="play('chest2')">
        <span class="btn-head"><span class="btn-title"><span class="gold">II.</span> Sanctum Coffer</span><span class="btn-key">5</span></span>
        <span class="btn-sub">Appraise reliquary (99%)</span>
      </button>
      <button type="button" class="grimoire-btn" onclick="play('chest3')">
        <span class="btn-head"><span class="btn-title"><span class="gold">III.</span> East Coffer</span><span class="btn-key">6</span></span>
        <span class="btn-sub">Appraise reliquary (99%)</span>
      </button>
    </nav>
  </main>
  <script>
    let busy = false;
    async function play(move) {
      if (busy) return;
      busy = true;
      const btns = document.querySelectorAll('button.grimoire-btn');
      btns.forEach((b) => b.setAttribute('aria-disabled', 'true'));
      try {
        const r = await fetch('/api/game?act=' + move + '&json=1', { cache: 'no-store' });
        const data = await r.json();
        document.getElementById('arena-box').innerHTML = data.svg;
        if (data.stageText) document.getElementById('st-stage').textContent = data.stageText;
        if (data.relicText) document.getElementById('st-relic').textContent = 'Relic: ' + data.relicText;
      } finally {
        btns.forEach((b) => b.removeAttribute('aria-disabled'));
        busy = false;
      }
    }
    window.addEventListener('keydown', (e) => {
      const map = { '1': 'reelseiden', '2': 'sorganeil', '3': 'ward', '4': 'chest1', '5': 'chest2', '6': 'chest3', 'r': 'reset', 'R': 'reset' };
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
    const boss = BOSS_ROSTER[st.stageIdx % BOSS_ROSTER.length];
    if (req.query.json === "1") {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(200).send(
        JSON.stringify({
          svg: buildGameSvg(st),
          stageText: `${boss.stage}: ${boss.name}`,
          relicText: st.activeRelic,
        })
      );
    }
    if (req.query.mode === "redirect") {
      res.setHeader("Location", "https://github.com/FitzzXYZ#arcane-trial-arena");
      return res.status(302).end();
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(buildInteractiveConsoleHtml(buildGameSvg(st), st));
  }

  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  return res.status(200).send(buildStandaloneGameSvg(st));
}
