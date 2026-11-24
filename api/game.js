import fs from "node:fs";
import path from "node:path";

/**
 * Sousou no Frieren x Ubel — The King's Tomb: Tactical Duel & Frieren's Mimic Roulette
 * Hallmark v2.0.0 Anti-AI-Slop Edition (0 FAIL, 0 REFLEX, 0 WARN on sloplint.mjs)
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
    relic: "Blue Moon Blossom (+8 MP/turn)",
    effect: "Folk spell of quiet blossoms: restores 35 HP and +8 MP regeneration",
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
    bonusDmg: 18,
    healHp: 12,
    healMp: 25,
    bind: true,
  },
];

const BOSS_ROSTER = [
  {
    stage: "Chamber I of IV",
    shortName: "I. Übel",
    name: "Spiegel: Übel Replica",
    title: "Outer Tomb Corridor",
    maxHp: 160,
    trait: "Mirrors slash angles unless sight-locked",
    intentNormal: "Mirror Reelseiden (18 dmg)",
    intentCharge: "Severing Tempest (36 dmg)",
    armor: 0,
  },
  {
    stage: "Chamber II of IV",
    shortName: "II. Sense",
    name: "Spiegel: Sense Replica",
    title: "Hall of Crimson Wards",
    maxHp: 220,
    trait: "Iron hair phalanx absorbs 20% of unbound slashes",
    intentNormal: "Crimson Hair Lance (20 dmg)",
    intentCharge: "Phalanx Impale (38 dmg)",
    armor: 0.2,
  },
  {
    stage: "Chamber III of IV",
    shortName: "III. Lernen",
    name: "Spiegel: Lernen Replica",
    title: "First-Class Sanctuary",
    maxHp: 260,
    trait: "Fires concentrated black Zoltraak volleys",
    intentNormal: "Golem Barrage (22 dmg)",
    intentCharge: "Black Zoltraak Volley (42 dmg)",
    armor: 0.1,
  },
  {
    stage: "Final Chamber",
    shortName: "IV. Frieren",
    name: "Spiegel: Frieren",
    title: "The King’s Inner Vault",
    maxHp: 340,
    trait: "Commands Vollzanbel and Judradjim lightning",
    intentNormal: "Judradjim Bolt (24 dmg)",
    intentCharge: "Height of Magic (48 dmg)",
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
    mpRegen: 4,
    relicCount: 3,
    empathy: 2,
    combo: 2,
    stageIdx: 0,
    bossHp: 108,
    bossMaxHp: 160,
    bossBound: false,
    bossCharging: false,
    wardActive: false,
    frierenTrapped: false,
    lastDmg: 52,
    activeRelic: "Blue Moon Blossom (+8 MP/turn)",
    activeRelicEffect: "Regenerates +8 MP after every turn and illuminates hidden leylines.",
    lastSpell: "reelseiden",
    duelLog1: "Übel pictures tailor’s shears gliding through silk. Reelseiden severs the Replica for 52 damage.",
    duelLog2: "Empathy resonance is at 2 of 3. One more cast unlocks Empathy Severance (+35 true cleave).",
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
  if (!globalThis.__FITZZ_ARENA_V4__) {
    globalThis.__FITZZ_ARENA_V4__ = createInitialState();
  }
  return globalThis.__FITZZ_ARENA_V4__;
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

function getTacticalTip(st, boss) {
  if (st.frierenTrapped) {
    return "Frieren is stuck inside a Mimic! Appraise another coffer or cast Ward to pull her out (+25 MP).";
  }
  if (st.bossBound && st.empathy >= 3) {
    return "Maximum synergy ready: target is sight-locked and Empathy is 3/3. Cast Reelseiden for 2.2x + 35 True Cleave.";
  }
  if (st.bossBound) {
    return `${boss.name} is paralyzed by Sorganeil. Cast Reelseiden now for a 2.2x execution strike.`;
  }
  if (st.bossCharging) {
    return `Danger: ${boss.name} is charging ${boss.intentCharge}. Cast Sorganeil to stun or Ward to reflect 75% damage.`;
  }
  if (st.empathy >= 3) {
    return "Empathy Resonance is full (3/3). Your next Reelseiden ignores armor and inflicts +35 true severing damage.";
  }
  return "Build Empathy to 3/3 or lock the Replica with Sorganeil before unleashing Reelseiden.";
}

function applyAction(st, act, isFocusCrit = false) {
  if (!act) return;
  if (act === "reset") {
    Object.assign(st, createInitialState());
    return;
  }

  st.turn += 1;
  const boss = BOSS_ROSTER[st.stageIdx % BOSS_ROSTER.length];

  // Rescue Frieren bonus if she was trapped in a Mimic
  if (act === "rescue") {
    st.frierenTrapped = false;
    st.chests = ["closed", "closed", "closed"];
    st.ubelMp = Math.min(st.ubelMaxMp, st.ubelMp + 25);
    st.empathy = Math.min(3, st.empathy + 1);
    pushHistory(st, "Rescued Frieren");
    st.chestLog1 = "Fern and Übel pulled Frieren out of the Mimic’s jaws (+25 MP, +1 Empathy).";
    st.chestLog2 = "Frieren’s hair is curled into frizzy rings, but she hands over a backup spell scroll.";
    return;
  }

  if (act === "reelseiden" || act === "sorganeil" || act === "ward") {
    st.lastSpell = act;
    st.ubelMp = Math.min(st.ubelMaxMp, st.ubelMp + (st.mpRegen || 4));

    if (act === "reelseiden") {
      pushHistory(st, isFocusCrit ? "Perfect Sever" : "Reelseiden");
      const cost = 15;
      if (st.ubelMp < cost) {
        st.ubelMp = Math.min(st.ubelMaxMp, st.ubelMp + 28);
        st.combo = 1;
        st.lastDmg = 0;
        st.duelLog1 = "Mana pool below 15 MP. Übel steadies her breathing and channels +28 MP.";
      } else {
        st.ubelMp -= cost;
        st.combo += 1;
        const isEmpathyMax = st.empathy >= 3;
        const base = 38 + st.slashBonus + ((st.turn * 7) % 16);
        const armorFactor = isEmpathyMax || st.bossBound || isFocusCrit ? 1.0 : 1.0 - boss.armor;
        const boundMult = st.bossBound ? 2.2 : 1.0;
        const focusMult = isFocusCrit ? 1.25 : 1.0;
        const empathyBonus = isEmpathyMax ? 35 : 0;
        const dmg = Math.round(base * armorFactor * boundMult * focusMult) + empathyBonus;
        st.lastDmg = dmg;
        st.bossHp = Math.max(0, st.bossHp - dmg);

        const critTag = isFocusCrit ? "Perfect Visualization: " : "";
        if (isEmpathyMax && st.bossBound) {
          st.duelLog1 = `${critTag}Empathy Severance on sight-locked target cuts ${boss.name} for ${dmg} damage.`;
        } else if (isEmpathyMax) {
          st.duelLog1 = `${critTag}Empathy 3/3 complete. Reelseiden ignores armor and cleaves ${boss.name} for ${dmg} damage.`;
        } else if (st.bossBound) {
          st.duelLog1 = `${critTag}Execution Cleave (2.2x) cuts the immobilized ${boss.name} for ${dmg} damage.`;
        } else {
          st.duelLog1 = `${critTag}Reelseiden invisible severing arc cuts ${boss.name} for ${dmg} damage (Combo x${st.combo}).`;
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
      const chip = (isFocusCrit ? 26 : 18) + (st.turn % 8);
      st.lastDmg = chip;
      st.bossHp = Math.max(0, st.bossHp - chip);
      st.duelLog1 = `Sorganeil locks ${boss.name} in full view: target paralyzed (${chip} dmg, next slash deals 2.2x).`;
    } else if (act === "ward") {
      pushHistory(st, "Zoltraak Ward");
      st.ubelMp = Math.min(st.ubelMaxMp, st.ubelMp + 32);
      st.ubelHp = Math.min(st.ubelMaxHp, st.ubelHp + 22);
      st.wardActive = true;
      st.frierenTrapped = false;
      st.empathy = Math.min(3, st.empathy + 1);
      const counter = isFocusCrit ? 30 : 22;
      st.lastDmg = counter;
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
      st.duelLog2 = `${oldName} dissolves into golden mana particles. Chamber cleared; advancing to ${nextBoss.name}.`;
      return;
    }

    if (st.bossBound) {
      st.duelLog2 = `${boss.name} is held motionless by Sorganeil’s binding gaze and cannot act this turn.`;
    } else if (!st.bossCharging && st.turn % 3 === 0) {
      st.bossCharging = true;
      st.duelLog2 = `Alert: ${boss.name} elevates dense mana for ${boss.intentCharge}. Interrupt with Sorganeil or Ward.`;
    } else {
      const rawAtk = st.bossCharging ? 34 + (st.turn % 10) : 16 + ((st.turn * 5) % 10);
      const taken = st.wardActive ? Math.floor(rawAtk * 0.25) : rawAtk;
      const wasCharged = st.bossCharging;
      st.bossCharging = false;
      st.wardActive = false;
      st.ubelHp = Math.max(1, st.ubelHp - taken);
      st.duelLog2 =
        taken < rawAtk
          ? `Defensive lattice disperses ${boss.name}’s ${wasCharged ? boss.intentCharge : boss.intentNormal} (${taken} damage).`
          : `${boss.name} casts ${wasCharged ? boss.intentCharge : boss.intentNormal} for ${taken} damage.`;
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

    // 3-Coffer Roulette: exactly 1 Mimic and 2 Grimoires per turn
    const mimicIdx = st.turn % 3;
    const isMimic = idx === mimicIdx;
    if (isMimic) {
      st.chests[idx] = "mimic";
      st.frierenTrapped = true;
      st.mimicsTriggered += 1;
      st.ubelHp = Math.max(18, st.ubelHp - 15);
      st.chestLog1 = `${label} was a Mimic trap (-15 HP). “It’s dark and scary! Pull me out, Fern!”`;
      st.chestLog2 = "Frieren’s boots are kicking from inside the Mimic jaws. Click Rescue or cast Ward for +25 MP.";
    } else {
      st.chests[idx] = "grimoire";
      st.frierenTrapped = false;
      st.grimoiresFound += 1;
      st.relicCount = (st.relicCount || 3) + 1;
      st.empathy = Math.min(3, st.empathy + 1);
      const loot = GRIMOIRE_LOOT[(st.turn + idx) % GRIMOIRE_LOOT.length];
      st.activeRelic = loot.relic;
      st.activeRelicEffect = `${loot.effect}.`;
      st.ubelHp = Math.min(st.ubelMaxHp, st.ubelHp + loot.healHp);
      st.ubelMp = Math.min(st.ubelMaxMp, st.ubelMp + loot.healMp);
      if (loot.title.includes("Reelseiden")) st.slashBonus = Math.min(30, st.slashBonus + 6);
      if (loot.title.includes("Flamme")) st.mpRegen = Math.min(16, (st.mpRegen || 4) + 4);
      if (loot.bonusDmg > 0) {
        st.lastDmg = loot.bonusDmg;
        st.bossHp = Math.max(10, st.bossHp - loot.bonusDmg);
      }
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
    ticks += `<line x1="${tx}" y1="${y}" x2="${tx}" y2="${y + h}" stroke="#090C0A" stroke-opacity="0.65" stroke-width="1"/>`;
  }
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${bgCol}"/>
    <rect x="${x}" y="${y}" width="${fillW}" height="${h}" rx="3" fill="url(#${fillGrad})"/>
    ${ticks}`;
}

function renderDungeonMapBar(stageIdx) {
  const nodes = [
    { x: 428, label: "I. Übel" },
    { x: 538, label: "II. Sense" },
    { x: 648, label: "III. Lernen" },
    { x: 758, label: "IV. Frieren" },
  ];
  let lines = "";
  for (let i = 0; i < nodes.length - 1; i++) {
    const done = i < stageIdx;
    const col = done ? "#9CC084" : "#D4A843";
    const op = done ? "0.75" : "0.24";
    lines += `<line x1="${nodes[i].x + 36}" y1="36" x2="${nodes[i + 1].x - 36}" y2="36" stroke="${col}" stroke-opacity="${op}" stroke-width="1.3"/>`;
  }
  let dots = "";
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const isCur = i === stageIdx;
    const isDone = i < stageIdx;
    const col = isCur ? "#E5C068" : isDone ? "#9CC084" : "#8E887A";
    const ring = isCur
      ? `<circle cx="${n.x}" cy="24" r="7" fill="none" stroke="#E5C068" stroke-opacity="0.55" stroke-width="1" stroke-dasharray="3 2"><animateTransform attributeName="transform" type="rotate" from="0 ${n.x} 24" to="360 ${n.x} 24" dur="10s" repeatCount="indefinite"/></circle>`
      : "";
    dots += `
      ${ring}
      <polygon points="${n.x},20 ${n.x + 4},24 ${n.x},28 ${n.x - 4},24" fill="${col}"/>
      <text x="${n.x}" y="44" text-anchor="middle" class="svg-body" font-size="11.5" fill="${col}">${n.label}</text>`;
  }
  return lines + dots;
}

function renderReliquaryColumn(cx, yTop, numeral, title, state, isSelected, idx) {
  const accent = state === "mimic" ? "#D4886A" : state === "grimoire" ? "#E5C068" : "#F4EFE6";
  const ringOp = isSelected ? "0.5" : "0.15";
  const actName = `chest${idx + 1}`;

  let illustration = "";
  if (state === "closed") {
    illustration = `
      <circle cx="${cx}" cy="${yTop + 72}" r="36" fill="none" stroke="#D4A843" stroke-opacity="${ringOp}" stroke-width="0.9" stroke-dasharray="3 4"/>
      <g>
        <animateTransform attributeName="transform" type="translate" values="0,0; 0,-2.5; 0,0" dur="3.6s" repeatCount="indefinite"/>
        <!-- Ornate Stone Pedestal Shadow -->
        <ellipse cx="${cx}" cy="${yTop + 102}" rx="34" ry="4" fill="#050706"/>
        <!-- Gothic Arch Reliquary Lid -->
        <path d="M ${cx - 32} ${yTop + 64} Q ${cx} ${yTop + 46} ${cx + 32} ${yTop + 64} L ${cx + 32} ${yTop + 72} L ${cx - 32} ${yTop + 72} Z" fill="#1B1714" stroke="#D4A843" stroke-width="1.2"/>
        <!-- Coffer Body -->
        <rect x="${cx - 32}" y="${yTop + 72}" width="64" height="26" rx="2" fill="#141210" stroke="#D4A843" stroke-width="1.2"/>
        <line x1="${cx - 18}" y1="${yTop + 57}" x2="${cx - 18}" y2="${yTop + 98}" stroke="#D4A843" stroke-opacity="0.75" stroke-width="1.5"/>
        <line x1="${cx + 18}" y1="${yTop + 57}" x2="${cx + 18}" y2="${yTop + 98}" stroke="#D4A843" stroke-opacity="0.75" stroke-width="1.5"/>
        <line x1="${cx - 32}" y1="${yTop + 85}" x2="${cx + 32}" y2="${yTop + 85}" stroke="#D4A843" stroke-opacity="0.3" stroke-width="0.8"/>
        <polygon points="${cx},${yTop + 66} ${cx + 5.5},${yTop + 72} ${cx},${yTop + 78} ${cx - 5.5},${yTop + 72}" fill="#E5C068" stroke="#0E1310" stroke-width="0.8"/>
      </g>
      <text x="${cx}" y="${yTop + 124}" text-anchor="middle" class="svg-folio" font-size="13.5" fill="#8E887A">Unappraised (99% seal)</text>`;
  } else if (state === "grimoire") {
    illustration = `
      <circle cx="${cx}" cy="${yTop + 66}" r="36" fill="#E5C068" fill-opacity="0.11">
        <animate attributeName="r" values="28;38;28" dur="3.2s" repeatCount="indefinite"/>
      </circle>
      <circle cx="${cx}" cy="${yTop + 66}" r="33" fill="none" stroke="#E5C068" stroke-opacity="0.55" stroke-width="0.9" stroke-dasharray="4 3">
        <animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${yTop + 66}" to="360 ${cx} ${yTop + 66}" dur="22s" repeatCount="indefinite"/>
      </circle>
      <g>
        <animateTransform attributeName="transform" type="translate" values="0,0; 0,-3.5; 0,0" dur="2.4s" repeatCount="indefinite"/>
        <!-- Illuminated Grimoire Open Pages -->
        <path d="M ${cx - 26} ${yTop + 66} Q ${cx - 13} ${yTop + 60} ${cx} ${yTop + 66} Q ${cx + 13} ${yTop + 60} ${cx + 26} ${yTop + 66} L ${cx + 26} ${yTop + 42} Q ${cx + 13} ${yTop + 36} ${cx} ${yTop + 42} Q ${cx - 13} ${yTop + 36} ${cx - 26} ${yTop + 42} Z" fill="#F4EFE6" stroke="#D4A843" stroke-width="1.2"/>
        <line x1="${cx}" y1="${yTop + 42}" x2="${cx}" y2="${yTop + 66}" stroke="#D4A843" stroke-width="1.1"/>
        <line x1="${cx - 20}" y1="${yTop + 49}" x2="${cx - 6}" y2="${yTop + 47}" stroke="#8E887A" stroke-width="1"/>
        <line x1="${cx - 20}" y1="${yTop + 55}" x2="${cx - 6}" y2="${yTop + 53}" stroke="#8E887A" stroke-width="1"/>
        <polygon points="${cx + 13},${yTop + 47} ${cx + 17},${yTop + 52} ${cx + 13},${yTop + 57} ${cx + 9},${yTop + 52}" fill="none" stroke="#9CC084" stroke-width="1.2"/>
      </g>
      <path d="M ${cx - 30} ${yTop + 76} L ${cx + 30} ${yTop + 76} L ${cx + 28} ${yTop + 98} L ${cx - 28} ${yTop + 98} Z" fill="#181512" stroke="#E5C068" stroke-width="1.1"/>
      <text x="${cx}" y="${yTop + 124}" text-anchor="middle" class="svg-body" font-size="13.5" fill="#9CC084">Authentic Grimoire</text>`;
  } else {
    // Iconic Frieren trapped inside Mimic Chest (with kicking boots & white twin-tails!)
    illustration = `
      <circle cx="${cx}" cy="${yTop + 68}" r="36" fill="#D4886A" fill-opacity="0.14">
        <animate attributeName="r" values="28;38;28" dur="1.4s" repeatCount="indefinite"/>
      </circle>
      <!-- Mimic Upper Jaw -->
      <path d="M ${cx - 32} ${yTop + 62} Q ${cx} ${yTop + 40} ${cx + 32} ${yTop + 62} Z" fill="#221215" stroke="#D4886A" stroke-width="1.2"/>
      <ellipse cx="${cx - 12}" cy="${yTop + 53}" rx="3" ry="1.6" fill="#E5C068"/>
      <ellipse cx="${cx + 12}" cy="${yTop + 53}" rx="3" ry="1.6" fill="#E5C068"/>
      <!-- Frieren's Iconic White Twin-Tails & Kicking Boots Sticking Out of Mimic Maw -->
      <g>
        <animateTransform attributeName="transform" type="rotate" values="-4 ${cx} ${yTop + 66}; 5 ${cx} ${yTop + 66}; -4 ${cx} ${yTop + 66}" dur="0.7s" repeatCount="indefinite"/>
        <!-- White Twin-Tail Ribbons -->
        <path d="M ${cx - 18} ${yTop + 64} Q ${cx - 28} ${yTop + 52} ${cx - 34} ${yTop + 58}" fill="none" stroke="#F4EFE6" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M ${cx + 18} ${yTop + 64} Q ${cx + 28} ${yTop + 52} ${cx + 34} ${yTop + 58}" fill="none" stroke="#F4EFE6" stroke-width="2.4" stroke-linecap="round"/>
        <!-- Left & Right Legs + Adventurer Boots Kicking -->
        <line x1="${cx - 7}" y1="${yTop + 70}" x2="${cx - 13}" y2="${yTop + 46}" stroke="#F4EFE6" stroke-width="3.2" stroke-linecap="round"/>
        <path d="M ${cx - 16} ${yTop + 46} L ${cx - 9} ${yTop + 46} L ${cx - 7} ${yTop + 39} L ${cx - 18} ${yTop + 41} Z" fill="#5C3D2E" stroke="#E5C068" stroke-width="0.8"/>
        <line x1="${cx + 7}" y1="${yTop + 70}" x2="${cx + 14}" y2="${yTop + 48}" stroke="#F4EFE6" stroke-width="3.2" stroke-linecap="round"/>
        <path d="M ${cx + 10} ${yTop + 48} L ${cx + 17} ${yTop + 48} L ${cx + 19} ${yTop + 41} L ${cx + 9} ${yTop + 43} Z" fill="#5C3D2E" stroke="#E5C068" stroke-width="0.8"/>
      </g>
      <!-- Ivory Mimic Fangs -->
      <polygon points="${cx - 24},${yTop + 62} ${cx - 19},${yTop + 70} ${cx - 14},${yTop + 62} ${cx - 8},${yTop + 71} ${cx - 3},${yTop + 62} ${cx + 3},${yTop + 62} ${cx + 8},${yTop + 71} ${cx + 14},${yTop + 62} ${cx + 19},${yTop + 70} ${cx + 24},${yTop + 62}" fill="#F4EFE6"/>
      <!-- Mimic Lower Chest Body -->
      <path d="M ${cx - 32} ${yTop + 74} L ${cx + 32} ${yTop + 74} L ${cx + 30} ${yTop + 98} L ${cx - 30} ${yTop + 98} Z" fill="#1B1012" stroke="#D4886A" stroke-width="1.2"/>
      <text x="${cx}" y="${yTop + 124}" text-anchor="middle" class="svg-body" font-size="13.5" fill="#D4886A">Frieren Trapped! (-15 HP)</text>`;
  }

  return `
    <g data-act="${actName}" style="cursor:pointer">
      <text x="${cx}" y="${yTop + 16}" text-anchor="middle" class="svg-body" font-size="14" fill="${accent}">${numeral}. ${title}</text>
      ${illustration}
    </g>`;
}

export function buildGameSvg(st) {
  const boss = BOSS_ROSTER[st.stageIdx % BOSS_ROSTER.length];
  const mapSvg = renderDungeonMapBar(st.stageIdx % BOSS_ROSTER.length);

  // Empathy Resonance Diamonds (3 slots around cx=332, y=118)
  let empathyRunes = "";
  for (let i = 0; i < 3; i++) {
    const rx = 316 + i * 16;
    const filled = i < (st.empathy || 0);
    const col = filled ? "#E5C068" : "#252B27";
    empathyRunes += `<polygon points="${rx},112 ${rx + 5},117 ${rx},122 ${rx - 5},117" fill="${col}"/>`;
  }

  // Center Clash Visual & Animated Battle Trajectory (cx=332, cy=166)
  let clashArt = "";
  const dmgText = st.lastDmg ? `-${st.lastDmg} HP` : "READY";
  if (st.lastSpell === "reelseiden") {
    clashArt = `
      <circle cx="332" cy="166" r="30" fill="none" stroke="#9CC084" stroke-opacity="0.36" stroke-width="0.9" stroke-dasharray="4 4">
        <animateTransform attributeName="transform" type="rotate" from="0 332 166" to="360 332 166" dur="20s" repeatCount="indefinite"/>
      </circle>
      <!-- Dynamic Severing Slash Arcs Extending Toward Boss -->
      <path d="M 284 188 Q 332 152 388 132" fill="none" stroke="#9CC084" stroke-width="2.2" stroke-linecap="round">
        <animate attributeName="stroke-opacity" values="0.3;1;0.3" dur="1.4s" repeatCount="indefinite"/>
      </path>
      <path d="M 292 196 Q 340 164 394 146" fill="none" stroke="#E5C068" stroke-width="1.5" stroke-linecap="round">
        <animate attributeName="stroke-opacity" values="0.9;0.25;0.9" dur="1.4s" repeatCount="indefinite"/>
      </path>
      <text x="332" y="212" text-anchor="middle" class="svg-num" font-size="12" fill="#9CC084">${dmgText}</text>
      <text x="332" y="228" text-anchor="middle" class="svg-folio" font-size="12.5" fill="#C8C2B4">Reelseiden x${st.combo}</text>`;
  } else if (st.lastSpell === "sorganeil") {
    clashArt = `
      <circle cx="332" cy="166" r="30" fill="none" stroke="#B399EE" stroke-opacity="0.45" stroke-width="1" stroke-dasharray="6 3">
        <animateTransform attributeName="transform" type="rotate" from="360 332 166" to="0 332 166" dur="16s" repeatCount="indefinite"/>
      </circle>
      <!-- Binding Gaze Leylines Locking onto Spiegel -->
      <line x1="352" y1="162" x2="532" y2="132" stroke="#B399EE" stroke-opacity="0.45" stroke-width="1.2" stroke-dasharray="4 3"/>
      <line x1="352" y1="170" x2="532" y2="152" stroke="#B399EE" stroke-opacity="0.45" stroke-width="1.2" stroke-dasharray="4 3"/>
      <ellipse cx="332" cy="166" rx="19" ry="10.5" fill="none" stroke="#B399EE" stroke-width="1.8"/>
      <circle cx="332" cy="166" r="4.8" fill="#E5C068">
        <animate attributeName="r" values="3.5;6.5;3.5" dur="1.6s" repeatCount="indefinite"/>
      </circle>
      <text x="332" y="212" text-anchor="middle" class="svg-num" font-size="11.5" fill="#B399EE">LOCKED 2.2X</text>
      <text x="332" y="228" text-anchor="middle" class="svg-folio" font-size="12.5" fill="#E5C068">Sorganeil Bind</text>`;
  } else {
    clashArt = `
      <circle cx="332" cy="166" r="30" fill="none" stroke="#7DA8E6" stroke-opacity="0.35" stroke-width="0.9" stroke-dasharray="3 3"/>
      <polygon points="332,140 354,153 354,179 332,192 310,179 310,153" fill="#7DA8E6" fill-opacity="0.12" stroke="#7DA8E6" stroke-width="1.6">
        <animate attributeName="stroke-opacity" values="0.45;1;0.45" dur="1.8s" repeatCount="indefinite"/>
      </polygon>
      <text x="332" y="212" text-anchor="middle" class="svg-num" font-size="11.5" fill="#7DA8E6">+22 HP / +32 MP</text>
      <text x="332" y="228" text-anchor="middle" class="svg-folio" font-size="12.5" fill="#C8C2B4">Zoltraak Ward</text>`;
  }

  const ubelImg = UBEL_AVATAR
    ? `<image href="${UBEL_AVATAR}" x="52" y="104" width="64" height="64" preserveAspectRatio="xMidYMin slice" clip-path="url(#ubel_av)"/>`
    : `<rect x="52" y="104" width="64" height="64" rx="8" fill="#161E18"/>`;

  const spiegelImg = SPIEGEL_AVATAR
    ? `<image href="${SPIEGEL_AVATAR}" x="548" y="104" width="64" height="64" preserveAspectRatio="xMidYMin slice" clip-path="url(#spiegel_av)"/>`
    : `<rect x="548" y="104" width="64" height="64" rx="8" fill="#1C1422"/>`;

  // Binding Chains Overlay on Boss Portrait when Sight-Locked
  const bossBindOverlay = st.bossBound
    ? `<line x1="548" y1="104" x2="612" y2="168" stroke="#B399EE" stroke-opacity="0.75" stroke-width="1.6" stroke-dasharray="4 2"/>
       <line x1="612" y1="104" x2="548" y2="168" stroke="#B399EE" stroke-opacity="0.75" stroke-width="1.6" stroke-dasharray="4 2"/>`
    : "";

  const ubelHpBar = renderSegmentedBar(52, 198, 212, 8, st.ubelHp, st.ubelMaxHp, "hp_g", "#171E19", 10);
  const ubelMpBar = renderSegmentedBar(52, 232, 212, 8, st.ubelMp, st.ubelMaxMp, "mp_g", "#181624", 10);
  const bossHpBar = renderSegmentedBar(400, 198, 212, 8, st.bossHp, st.bossMaxHp, "boss_g", "#221417", 10);

  const bossIntent = st.bossBound
    ? "Paralyzed (0 dmg)"
    : st.bossCharging
    ? boss.intentCharge
    : boss.intentNormal;
  const bossStateCol = st.bossBound ? "#B399EE" : st.bossCharging ? "#E5C068" : "#D4886A";

  const hist = st.history || ["T9: Sorganeil", "T10: Reelseiden", "T11: Sanctum II", "T12: Reelseiden"];
  const tipText = getTacticalTip(st, boss);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 456" width="100%" height="100%" role="img" aria-label="The King’s Tomb: First-Class Exam and Reliquary Trial">
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
    <clipPath id="gm_clip"><rect x="0" y="0" width="1200" height="456" rx="16"/></clipPath>
    <clipPath id="ubel_av"><rect x="52" y="104" width="64" height="64" rx="8"/></clipPath>
    <clipPath id="spiegel_av"><rect x="548" y="104" width="64" height="64" rx="8"/></clipPath>
  </defs>

  <rect x="0.5" y="0.5" width="1199" height="455" rx="15.5" fill="url(#gm_bg)" stroke="url(#gm_border)" stroke-width="1.2"/>

  <g clip-path="url(#gm_clip)">
    <!-- TOP DUNGEON EXPEDITION MAP & TELEMETRY BAR -->
    <polygon points="40,28 45,33 40,38 35,33" fill="#D4A843"/>
    <text x="56" y="38" class="svg-display" font-size="17" fill="#F4EFE6">THE KING’S TOMB: DUNGEON TRIAL</text>

    <!-- 4-Chamber Dungeon Progression Nodes (x=428..758) -->
    ${mapSvg}

    <!-- Right Sibling Stats Parted by Vertical Hairlines -->
    <text x="916" y="38" text-anchor="end" class="svg-folio" font-size="14" fill="#9CC084">${st.wins} Cleared</text>
    <line x1="930" y1="22" x2="930" y2="42" stroke="#D4A843" stroke-opacity="0.28" stroke-width="1"/>
    <text x="1046" y="38" text-anchor="end" class="svg-folio" font-size="14" fill="#E5C068">${st.grimoiresFound} Grimoires</text>
    <line x1="1060" y1="22" x2="1060" y2="42" stroke="#D4A843" stroke-opacity="0.28" stroke-width="1"/>
    <text x="1164" y="38" text-anchor="end" class="svg-folio" font-size="14" fill="#C8C2B4">Turn ${st.turn}</text>

    <line x1="36" y1="56" x2="1164" y2="56" stroke="#D4A843" stroke-opacity="0.28" stroke-width="1"/>

    <!-- ================================================================== -->
    <!-- COLUMN I: SPIEGEL SANCTUARY DUEL (x=40..624)                        -->
    <!-- ================================================================== -->
    <text x="40" y="80" class="svg-body" font-size="15" fill="#9CC084">I. Spiegel Sanctuary Duel</text>
    <text x="624" y="80" text-anchor="end" class="svg-folio" font-size="14" fill="${bossStateCol}">Next intent: ${xmlEsc(bossIntent)}</text>

    <!-- Recessed Arena Stage (#090C0A, borderless) -->
    <rect x="40" y="92" width="584" height="162" rx="8" fill="#090C0A"/>

    <!-- Left Combatant: Ubel -->
    <g data-act="ward" style="cursor:pointer">
      ${ubelImg}
      <text x="126" y="120" class="svg-display-b" font-size="14" fill="#F4EFE6">Übel (FitzzXYZ)</text>
      <text x="126" y="139" class="svg-folio" font-size="13.5" fill="#9CC084">First-Class, +${st.slashBonus} sever</text>
      <text x="126" y="157" class="svg-body" font-size="12.5" fill="#E5C068">${st.wardActive ? "Ward lattice active" : st.empathy >= 3 ? "Empathy 3/3 ready" : "Reelseiden stance"}</text>
    </g>

    <text x="52" y="191" class="svg-body" font-size="13" fill="#9CC084">Vitality</text>
    <text x="264" y="191" text-anchor="end" class="svg-num" font-size="11.5" fill="#F4EFE6">${st.ubelHp} / ${st.ubelMaxHp}</text>
    ${ubelHpBar}

    <text x="52" y="225" class="svg-body" font-size="13" fill="#B399EE">Mana pool (+${st.mpRegen || 4}/turn)</text>
    <text x="264" y="225" text-anchor="end" class="svg-num" font-size="11.5" fill="#F4EFE6">${st.ubelMp} / ${st.ubelMaxMp}</text>
    ${ubelMpBar}

    <!-- Center Empathy Gauge & Astrolabe Spell Clash -->
    <g data-act="reelseiden" style="cursor:pointer">
      <text x="332" y="105" text-anchor="middle" class="svg-folio" font-size="12" fill="#E5C068">Empathy ${st.empathy || 0}/3</text>
      ${empathyRunes}
      ${clashArt}
    </g>

    <!-- Right Combatant: Spiegel Replica -->
    <g data-act="sorganeil" style="cursor:pointer">
      ${spiegelImg}
      ${bossBindOverlay}
      <text x="536" y="120" text-anchor="end" class="svg-display-b" font-size="13.5" fill="#F4EFE6">${xmlEsc(boss.name)}</text>
      <text x="536" y="139" text-anchor="end" class="svg-folio" font-size="13.5" fill="#E5C068">${xmlEsc(boss.title)}</text>
      <text x="536" y="157" text-anchor="end" class="svg-body" font-size="12.5" fill="${bossStateCol}">Armor: ${Math.round(boss.armor * 100)}%</text>
    </g>

    <text x="400" y="191" class="svg-body" font-size="13" fill="#E5C068">Replica integrity</text>
    <text x="612" y="191" text-anchor="end" class="svg-num" font-size="11.5" fill="#F4EFE6">${st.bossHp} / ${st.bossMaxHp}</text>
    ${bossHpBar}

    <text x="400" y="225" class="svg-body" font-size="13" fill="#8E887A">Trait</text>
    <text x="612" y="225" text-anchor="end" class="svg-folio" font-size="12.5" fill="#C8C2B4">${xmlEsc(boss.trait)}</text>

    <!-- 4-Turn Tactical Timeline Strip -->
    <text x="40" y="276" class="svg-folio" font-size="13" fill="#8E887A">Recent casts:</text>
    <text x="136" y="276" class="svg-body" font-size="13" fill="#C8C2B4">${xmlEsc(hist[0] || "")}</text>
    <line x1="250" y1="264" x2="250" y2="280" stroke="#D4A843" stroke-opacity="0.22" stroke-width="1"/>
    <text x="264" y="276" class="svg-body" font-size="13" fill="#C8C2B4">${xmlEsc(hist[1] || "")}</text>
    <line x1="382" y1="264" x2="382" y2="280" stroke="#D4A843" stroke-opacity="0.22" stroke-width="1"/>
    <text x="396" y="276" class="svg-body" font-size="13" fill="#C8C2B4">${xmlEsc(hist[2] || "")}</text>
    <line x1="510" y1="264" x2="510" y2="280" stroke="#D4A843" stroke-opacity="0.22" stroke-width="1"/>
    <text x="524" y="276" class="svg-body" font-size="13" fill="#E5C068">${xmlEsc(hist[3] || "")}</text>

    <!-- Duel Chronicle Well (Borderless Recessed Surface #090C0A) -->
    <rect x="40" y="292" width="584" height="140" rx="8" fill="#090C0A"/>
    <text x="56" y="316" class="svg-body" font-size="14" fill="#E5C068">Combat Chronicle &amp; Tactical Advisor</text>
    <text x="56" y="344" class="svg-body" font-size="15" fill="#F4EFE6">${xmlEsc(st.duelLog1)}</text>
    <text x="56" y="372" class="svg-folio" font-size="14.5" fill="#9CC084">${xmlEsc(st.duelLog2)}</text>
    <line x1="56" y1="388" x2="608" y2="388" stroke="#D4A843" stroke-opacity="0.18" stroke-width="1"/>
    <text x="56" y="412" class="svg-folio" font-size="14" fill="#E5C068">${xmlEsc(tipText)}</text>

    <!-- Master Vertical Hairline Divider -->
    <line x1="648" y1="70" x2="648" y2="432" stroke="#D4A843" stroke-opacity="0.28" stroke-width="1"/>

    <!-- ================================================================== -->
    <!-- COLUMN II: RELIQUARY APPRAISAL (x=672..1164)                        -->
    <!-- ================================================================== -->
    <text x="672" y="80" class="svg-body" font-size="15" fill="#E5C068">II. Frieren’s Reliquary Roulette</text>
    <text x="1164" y="80" text-anchor="end" class="svg-folio" font-size="14" fill="#9CC084">2 Grimoires, 1 Mimic Trap per turn</text>

    ${renderReliquaryColumn(748, 102, "I", "West Coffer", st.chests[0], st.lastChestIdx === 0, 0)}
    <line x1="832" y1="106" x2="832" y2="242" stroke="#D4A843" stroke-opacity="0.2" stroke-width="1"/>
    ${renderReliquaryColumn(918, 102, "II", "Sanctum Coffer", st.chests[1], st.lastChestIdx === 1, 1)}
    <line x1="1002" y1="106" x2="1002" y2="242" stroke="#D4A843" stroke-opacity="0.2" stroke-width="1"/>
    ${renderReliquaryColumn(1086, 102, "III", "East Coffer", st.chests[2], st.lastChestIdx === 2, 2)}

    <!-- Equipped Relic & Collection Strip -->
    <line x1="672" y1="254" x2="1164" y2="254" stroke="#D4A843" stroke-opacity="0.22" stroke-width="1"/>
    <text x="672" y="276" class="svg-folio" font-size="13.5" fill="#8E887A">Attuned relic:</text>
    <text x="760" y="276" class="svg-body" font-size="14" fill="#E5C068">${xmlEsc(st.activeRelic || "Blue Moon Blossom (+8 MP/turn)")}</text>
    <text x="1164" y="276" text-anchor="end" class="svg-folio" font-size="13.5" fill="#9CC084">${st.relicCount || 3} Folios Collected</text>

    <!-- Reliquary Appraisal Well (Borderless Recessed Surface #090C0A) -->
    <rect x="672" y="292" width="492" height="140" rx="8" fill="#090C0A"/>
    <text x="688" y="316" class="svg-body" font-size="14" fill="#B399EE">Reliquary Appraisal Ledger</text>
    <text x="688" y="344" class="svg-body" font-size="15" fill="#F4EFE6">${xmlEsc(st.chestLog1)}</text>
    <text x="688" y="372" class="svg-folio" font-size="14.5" fill="#C8C2B4">${xmlEsc(st.chestLog2)}</text>
    <line x1="688" y1="388" x2="1148" y2="388" stroke="#D4A843" stroke-opacity="0.18" stroke-width="1"/>
    <text x="688" y="412" class="svg-folio" font-size="14" fill="#9CC084">Relic resonance: ${xmlEsc(st.activeRelicEffect || "Regenerates +8 MP after every turn.")}</text>
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
  <meta name="description" content="Interactive Sousou no Frieren and Übel tactical grimoire duel and Frieren Mimic roulette mini-game for FitzzXYZ."/>
  <title>FitzzXYZ: The King’s Tomb &amp; Reliquary Trial</title>
  <style>
    /* Hallmark: v2.0.0 | theme: grimoire (by request) | genre: atmospheric | shape: workbench | posture: full-palette | axis: left-biased | signature: live spiegel duel and mimic roulette */
    /* critique: focus=the live SVG combat and reliquary board with visualization focus meter | hierarchy=status header -> interactive SVG stage -> visualization timing meter -> 6 spell and coffer controls | restraint=hairline surface ladder and borderless chronicle wells */
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
      --color-terracotta: #D4886A;
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
    .nav-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .back-link,
    button.utility-btn {
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      min-height: 40px;
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
    .back-link:hover,
    button.utility-btn:hover {
      border-color: var(--color-accent);
      background-color: var(--color-paper-3);
    }
    .back-link:focus-visible,
    button.utility-btn:focus-visible,
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
      transition: transform 120ms ease-out;
    }
    .focus-bar-wrap {
      width: 100%;
      padding: 12px 16px;
      border-radius: 8px;
      background-color: var(--color-paper-2);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }
    .focus-label {
      font-family: var(--font-body);
      font-size: 15px;
      font-weight: 600;
      color: var(--color-ink);
      white-space: nowrap;
    }
    .focus-track {
      position: relative;
      flex: 1;
      min-width: 200px;
      height: 12px;
      border-radius: 4px;
      background-color: var(--color-paper);
      overflow: hidden;
    }
    .focus-sweet {
      position: absolute;
      left: 38%;
      width: 24%;
      top: 0;
      bottom: 0;
      background-color: var(--color-rule-strong);
    }
    .focus-cursor {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 12px;
      border-radius: 4px;
      background-color: var(--color-gold);
      animation: focusSweep 2.2s linear infinite alternate;
    }
    @keyframes focusSweep {
      0% { transform: translateX(0); }
      100% { transform: translateX(520px); }
    }
    .focus-hint {
      font-family: var(--font-italic);
      font-style: italic;
      font-size: 15px;
      color: var(--color-gold);
      white-space: nowrap;
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
    button.grimoire-btn[aria-disabled="true"],
    button.utility-btn:disabled,
    button.utility-btn[aria-disabled="true"] {
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
      <div class="nav-actions">
        <a class="back-link" href="https://github.com/FitzzXYZ">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Return to FitzzXYZ Chronicle
        </a>
        <button type="button" class="utility-btn" id="rescue-btn" onclick="play('rescue')">
          Pull Frieren from Mimic (+25 MP)
        </button>
        <button type="button" class="utility-btn" id="sfx-btn" onclick="toggleSfx()">
          Spell Audio: On
        </button>
      </div>
      <div class="status-strip" role="status" aria-live="polite">
        <span class="status-item" id="st-stage">${xmlEsc(boss.stage)}: ${xmlEsc(boss.name)}</span>
        <span class="status-item" id="st-relic">Relic: ${xmlEsc(st.activeRelic || "Blue Moon Blossom")}</span>
        <span class="status-item">Click SVG figures or press keys 1 to 6</span>
      </div>
    </header>

    <section id="arena-box" aria-label="Tactical Grimoire Arena">${svgContent}</section>

    <section class="focus-bar-wrap" aria-label="Visualization Focus Meter">
      <span class="focus-label">Übel’s Visualization Focus</span>
      <div class="focus-track" id="focus-track">
        <div class="focus-sweet" id="focus-sweet"></div>
        <div class="focus-cursor" id="focus-cursor"></div>
      </div>
      <span class="focus-hint" id="focus-hint">Time casts in the gold zone for 1.25x Pierce</span>
    </section>

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
    let sfxOn = true;
    let audioCtx = null;

    function toggleSfx() {
      sfxOn = !sfxOn;
      document.getElementById('sfx-btn').textContent = 'Spell Audio: ' + (sfxOn ? 'On' : 'Muted');
    }

    function playSpellSfx(move, isCrit) {
      if (!sfxOn) return;
      try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (move === 'reelseiden') {
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(isCrit ? 680 : 520, now);
          osc.frequency.exponentialRampToValueAtTime(140, now + 0.16);
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
          osc.start(now);
          osc.stop(now + 0.18);
        } else if (move === 'sorganeil') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(320, now);
          osc.frequency.exponentialRampToValueAtTime(640, now + 0.22);
          gain.gain.setValueAtTime(0.11, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
          osc.start(now);
          osc.stop(now + 0.25);
        } else if (move === 'ward' || move === 'rescue') {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.exponentialRampToValueAtTime(880, now + 0.2);
          gain.gain.setValueAtTime(0.1, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
          osc.start(now);
          osc.stop(now + 0.23);
        } else {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(587, now);
          osc.frequency.exponentialRampToValueAtTime(880, now + 0.18);
          gain.gain.setValueAtTime(0.09, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          osc.start(now);
          osc.stop(now + 0.21);
        }
      } catch {}
    }

    function checkFocusCrit() {
      try {
        const track = document.getElementById('focus-track').getBoundingClientRect();
        const cur = document.getElementById('focus-cursor').getBoundingClientRect();
        const pct = (cur.left + cur.width / 2 - track.left) / Math.max(1, track.width);
        return pct >= 0.34 && pct <= 0.66;
      } catch {
        return false;
      }
    }

    function bindSvgHotspots() {
      document.querySelectorAll('#arena-box [data-act]').forEach((el) => {
        el.onclick = () => play(el.getAttribute('data-act'));
      });
    }

    async function play(move) {
      if (busy) return;
      busy = true;
      const isCrit = checkFocusCrit();
      playSpellSfx(move, isCrit);
      const hint = document.getElementById('focus-hint');
      if (hint) {
        hint.textContent = isCrit ? 'Perfect Visualization (1.25x Pierce Activated)' : 'Standard Visualization Cast';
      }
      const btns = document.querySelectorAll('button.grimoire-btn, button.utility-btn');
      btns.forEach((b) => b.setAttribute('aria-disabled', 'true'));
      try {
        const r = await fetch('/api/game?act=' + move + '&crit=' + (isCrit ? '1' : '0') + '&json=1', { cache: 'no-store' });
        const data = await r.json();
        const box = document.getElementById('arena-box');
        box.innerHTML = data.svg;
        bindSvgHotspots();
        if (data.stageText) document.getElementById('st-stage').textContent = data.stageText;
        if (data.relicText) document.getElementById('st-relic').textContent = 'Relic: ' + data.relicText;
      } finally {
        btns.forEach((b) => b.removeAttribute('aria-disabled'));
        busy = false;
      }
    }

    bindSvgHotspots();
    window.addEventListener('keydown', (e) => {
      const map = { '1': 'reelseiden', '2': 'sorganeil', '3': 'ward', '4': 'chest1', '5': 'chest2', '6': 'chest3', 'f': 'rescue', 'F': 'rescue', 'r': 'reset', 'R': 'reset' };
      if (map[e.key]) play(map[e.key]);
    });
  </script>
</body>
</html>`;
}

export default function handler(req, res) {
  const st = getArenaState();
  const act = req.query && req.query.act;
  const isCrit = req.query && req.query.crit === "1";

  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0, s-maxage=0");
  res.setHeader("CDN-Cache-Control", "no-store");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  if (act) {
    applyAction(st, act, isCrit);
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
