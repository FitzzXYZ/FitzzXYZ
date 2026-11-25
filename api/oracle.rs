use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use std::time::Duration;
use vercel_runtime::{run, service_fn, Error, Request, Response, ResponseBody};

const ARENA_REDIS_KEY: &str = "fitzz:arena:v4";

#[derive(Debug, Clone, Copy, Serialize)]
struct BossSpec {
    stage: &'static str,
    name: &'static str,
    max_hp: u32,
    armor: f64,
}

const BOSS_ROSTER: [BossSpec; 4] = [
    BossSpec {
        stage: "Chamber I",
        name: "Spiegel: Übel Replica",
        max_hp: 160,
        armor: 0.0,
    },
    BossSpec {
        stage: "Chamber II",
        name: "Spiegel: Sense Replica",
        max_hp: 220,
        armor: 0.20,
    },
    BossSpec {
        stage: "Chamber III",
        name: "Spiegel: Lernen Replica",
        max_hp: 260,
        armor: 0.10,
    },
    BossSpec {
        stage: "Final Chamber",
        name: "Spiegel: Frieren",
        max_hp: 340,
        armor: 0.15,
    },
];

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RedisArenaState {
    #[serde(default)]
    stage_idx: usize,
    #[serde(default = "default_boss_hp")]
    boss_hp: u32,
    #[serde(default = "default_slash_bonus")]
    slash_bonus: u32,
    #[serde(default = "default_empathy")]
    empathy: u32,
    #[serde(default)]
    boss_bound: bool,
    #[serde(default = "default_turn")]
    turn: u32,
    #[serde(default)]
    ending_reached: bool,
}

fn default_boss_hp() -> u32 {
    108
}
fn default_slash_bonus() -> u32 {
    6
}
fn default_empathy() -> u32 {
    2
}
fn default_turn() -> u32 {
    12
}

impl Default for RedisArenaState {
    fn default() -> Self {
        Self {
            stage_idx: 0,
            boss_hp: default_boss_hp(),
            slash_bonus: default_slash_bonus(),
            empathy: default_empathy(),
            boss_bound: false,
            turn: default_turn(),
            ending_reached: false,
        }
    }
}

#[derive(Debug, Deserialize)]
struct UpstashGetEnvelope {
    result: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DamageBand {
    min: u32,
    avg: u32,
    max: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct OracleReport {
    runtime: &'static str,
    storage: String,
    stage: &'static str,
    boss_name: &'static str,
    boss_hp: u32,
    boss_max_hp: u32,
    boss_armor_pct: u32,
    slash_bonus: u32,
    empathy: u32,
    ending_reached: bool,
    standard_slash: DamageBand,
    perfect_bound_slash: DamageBand,
    empathy_true_cleave: DamageBand,
    turns_to_kill_standard: u32,
    turns_to_kill_optimal: u32,
    safe_coffer_pct: f64,
    mimic_trap_pct: f64,
    next_mimic_slot: &'static str,
    tactical_verdict: String,
}

fn parse_query(query: Option<&str>) -> HashMap<String, String> {
    let mut map = HashMap::new();
    let Some(q) = query else {
        return map;
    };
    for pair in q.split('&') {
        if let Some((k, v)) = pair.split_once('=') {
            if !k.is_empty() {
                map.insert(k.to_string(), v.to_string());
            }
        }
    }
    map
}

async fn fetch_redis_state() -> (RedisArenaState, String) {
    let url = env::var("UPSTASH_REDIS_REST_URL")
        .or_else(|_| env::var("KV_REST_API_URL"))
        .unwrap_or_default();
    let token = env::var("UPSTASH_REDIS_REST_TOKEN")
        .or_else(|_| env::var("KV_REST_API_TOKEN"))
        .unwrap_or_default();

    let base = url.trim().trim_end_matches('/');
    let tok = token.trim();
    if base.is_empty() || tok.is_empty() {
        return (RedisArenaState::default(), "memory-fallback".to_string());
    }

    let client = match reqwest::Client::builder()
        .timeout(Duration::from_millis(2500))
        .build()
    {
        Ok(c) => c,
        Err(_) => return (RedisArenaState::default(), "memory-fallback".to_string()),
    };

    let endpoint = format!("{}/get/{}", base, ARENA_REDIS_KEY);
    let resp = match client.get(&endpoint).bearer_auth(tok).send().await {
        Ok(r) if r.status().is_success() => r,
        _ => return (RedisArenaState::default(), "memory-fallback".to_string()),
    };

    let env_body = match resp.json::<UpstashGetEnvelope>().await {
        Ok(e) => e,
        Err(_) => return (RedisArenaState::default(), "memory-fallback".to_string()),
    };

    match env_body.result {
        Some(raw) if !raw.is_empty() => match serde_json::from_str::<RedisArenaState>(&raw) {
            Ok(parsed) => (parsed, "upstash".to_string()),
            Err(_) => (RedisArenaState::default(), "memory-fallback".to_string()),
        },
        _ => (RedisArenaState::default(), "upstash-empty".to_string()),
    }
}

fn calc_reelseiden_dmg(
    slash_bonus: u32,
    roll: u32,
    armor: f64,
    bound: bool,
    crit: bool,
    empathy_max: bool,
) -> u32 {
    let base = (38 + slash_bonus + (roll % 16)) as f64;
    let armor_factor = if empathy_max || bound || crit {
        1.0
    } else {
        1.0 - armor
    };
    let bound_mult = if bound { 2.2 } else { 1.0 };
    let focus_mult = if crit { 1.25 } else { 1.0 };
    let empathy_bonus = if empathy_max { 35 } else { 0 };
    (base * armor_factor * bound_mult * focus_mult).round() as u32 + empathy_bonus
}

fn calc_band(slash_bonus: u32, armor: f64, bound: bool, crit: bool, empathy_max: bool) -> DamageBand {
    let min = calc_reelseiden_dmg(slash_bonus, 0, armor, bound, crit, empathy_max);
    let max = calc_reelseiden_dmg(slash_bonus, 15, armor, bound, crit, empathy_max);
    let mut sum: u32 = 0;
    for r in 0..16 {
        sum += calc_reelseiden_dmg(slash_bonus, r, armor, bound, crit, empathy_max);
    }
    let avg = (sum + 8) / 16;
    DamageBand { min, avg, max }
}

fn compute_oracle(state: &RedisArenaState, storage: String) -> OracleReport {
    let boss = BOSS_ROSTER[state.stage_idx % BOSS_ROSTER.len()];
    let boss_hp = if state.ending_reached {
        0
    } else {
        state.boss_hp.min(boss.max_hp)
    };
    let slash_bonus = state.slash_bonus.clamp(0, 42);
    let empathy = state.empathy.min(3);

    let standard = calc_band(slash_bonus, boss.armor, false, false, false);
    let perfect_bound = calc_band(slash_bonus, boss.armor, true, true, false);
    let empathy_true = calc_band(slash_bonus, boss.armor, true, true, true);

    let ttk_std = if boss_hp == 0 {
        0
    } else {
        boss_hp.div_ceil(standard.avg.max(1))
    };
    let ttk_opt = if boss_hp == 0 {
        0
    } else {
        boss_hp.div_ceil(empathy_true.avg.max(1))
    };

    let next_mimic_idx = (state.turn.saturating_add(1)) % 3;
    let next_mimic_slot = match next_mimic_idx {
        0 => "West Coffer I",
        1 => "Sanctum Coffer II",
        _ => "East Coffer III",
    };

    let tactical_verdict = if state.ending_reached {
        format!("Epilogue reached — NG+ ready with +{} Sever.", slash_bonus)
    } else if state.boss_bound && empathy >= 3 {
        format!(
            "LETHAL WINDOW: Cast Perfect Reelseiden now ({}–{} true dmg).",
            empathy_true.min, empathy_true.max
        )
    } else if boss.armor > 0.0 {
        format!(
            "Target holds {}% ward — bind with Sorganeil or charge Empathy 3/3.",
            (boss.armor * 100.0).round() as u32
        )
    } else {
        format!(
            "0% ward exposed — optimal execution clears in {} turn(s).",
            ttk_opt.max(1)
        )
    };

    OracleReport {
        runtime: "rust",
        storage,
        stage: boss.stage,
        boss_name: boss.name,
        boss_hp,
        boss_max_hp: boss.max_hp,
        boss_armor_pct: (boss.armor * 100.0).round() as u32,
        slash_bonus,
        empathy,
        ending_reached: state.ending_reached,
        standard_slash: standard,
        perfect_bound_slash: perfect_bound,
        empathy_true_cleave: empathy_true,
        turns_to_kill_standard: ttk_std,
        turns_to_kill_optimal: ttk_opt,
        safe_coffer_pct: 66.7,
        mimic_trap_pct: 33.3,
        next_mimic_slot,
        tactical_verdict,
    }
}

fn xml_escape(input: &str) -> String {
    input
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn render_svg(rep: &OracleReport) -> String {
    let storage_lbl = if rep.storage == "upstash" {
        "UPSTASH SYNCED · FLUID RUST"
    } else {
        "DETERMINISTIC ENGINE · FLUID RUST"
    };
    let storage_col = if rep.storage == "upstash" {
        "#9CC084"
    } else {
        "#B399EE"
    };

    let boss_label = xml_escape(&format!("{} · {}", rep.stage, rep.boss_name));
    let verdict = xml_escape(&rep.tactical_verdict);
    let mimic_slot = xml_escape(rep.next_mimic_slot);

    let std_w = ((rep.standard_slash.avg as f64 / rep.empathy_true_cleave.max.max(1) as f64)
        * 210.0)
        .round() as u32;
    let bound_w = ((rep.perfect_bound_slash.avg as f64 / rep.empathy_true_cleave.max.max(1) as f64)
        * 210.0)
        .round() as u32;

    format!(
        r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 176" width="100%" height="100%">
  <defs>
    <linearGradient id="rs_bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0E1310"/>
      <stop offset="52%" stop-color="#13151B"/>
      <stop offset="100%" stop-color="#1A1320"/>
    </linearGradient>
    <linearGradient id="rs_border" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#D4886A" stop-opacity="0.65"/>
      <stop offset="50%" stop-color="#B399EE" stop-opacity="0.68"/>
      <stop offset="100%" stop-color="#D4A843" stop-opacity="0.62"/>
    </linearGradient>
    <clipPath id="rs_clip"><rect x="0" y="0" width="1200" height="176" rx="16"/></clipPath>
    <style>
      .r-h {{ font-family: 'Cinzel', Georgia, serif; font-weight: 700; letter-spacing: 1.4px; }}
      .r-num {{ font-family: 'Cinzel', Georgia, serif; font-weight: 800; font-variant-numeric: tabular-nums; }}
      .r-body {{ font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 600; }}
      .r-it {{ font-family: 'Cormorant Garamond', Georgia, serif; font-style: italic; font-weight: 500; }}
      .r-mono {{ font-family: ui-monospace, 'JetBrains Mono', monospace; font-weight: 600; }}
    </style>
  </defs>

  <rect x="0.5" y="0.5" width="1199" height="175" rx="15.5" fill="url(#rs_bg)" stroke="url(#rs_border)" stroke-width="1.2"/>
  <rect x="6.5" y="6.5" width="1187" height="163" rx="11" fill="none" stroke="#D4A843" stroke-width="0.7" stroke-opacity="0.28"/>
  <polygon points="16,12 20,16 16,20 12,16" fill="#D4886A" fill-opacity="0.7"/>
  <polygon points="1184,12 1188,16 1184,20 1180,16" fill="#D4886A" fill-opacity="0.7"/>
  <polygon points="16,164 20,160 16,156 12,160" fill="#D4886A" fill-opacity="0.7"/>
  <polygon points="1184,164 1188,160 1184,156 1180,160" fill="#D4886A" fill-opacity="0.7"/>

  <g clip-path="url(#rs_clip)">
    <polygon points="34,29 39,34 34,39 29,34" fill="#D4886A">
      <animate attributeName="opacity" values="0.45;1;0.45" dur="2.6s" repeatCount="indefinite"/>
    </polygon>
    <text x="48" y="38" class="r-h" font-size="11.5" fill="#E5C068">FIRST-CLASS COMBAT ORACLE  ·  RUST PROBABILITY ENGINE</text>
    <text x="1164" y="38" text-anchor="end" class="r-mono" font-size="10.5" fill="{storage_col}">{storage_lbl}</text>
    <line x1="30" y1="50" x2="1170" y2="50" stroke="#D4A843" stroke-opacity="0.24" stroke-width="1"/>

    <!-- Col 1: Target & Armor -->
    <text x="34" y="74" class="r-h" font-size="10" fill="#D4886A">ACTIVE TARGET ANALYSIS</text>
    <text x="34" y="102" class="r-body" font-size="17" fill="#F4EFE6">{boss_label}</text>
    <text x="34" y="124" class="r-mono" font-size="11.5" fill="#C8C2B4">HP {boss_hp}/{boss_max_hp} · WARD {armor}% · EMPATHY {empathy}/3</text>
    <text x="34" y="148" class="r-it" font-size="13.5" fill="#9CC084">{verdict}</text>

    <line x1="418" y1="64" x2="418" y2="152" stroke="#D4A843" stroke-opacity="0.22" stroke-width="1"/>

    <!-- Col 2: Reelseiden Damage Curve -->
    <text x="442" y="74" class="r-h" font-size="10" fill="#9CC084">REELSEIDEN DAMAGE CURVE (+{slash_bonus} SEVER)</text>
    <text x="442" y="98" class="r-mono" font-size="11" fill="#C8C2B4">Base Slash: {std_min}–{std_max} (avg {std_avg})</text>
    <rect x="442" y="104" width="210" height="5" rx="2.5" fill="#1C201E"/>
    <rect x="442" y="104" width="{std_w}" height="5" rx="2.5" fill="#9CC084"/>

    <text x="442" y="126" class="r-mono" font-size="11" fill="#B399EE">Sorganeil 2.2x + Crit: {bnd_min}–{bnd_max}</text>
    <rect x="442" y="132" width="210" height="5" rx="2.5" fill="#1C201E"/>
    <rect x="442" y="132" width="{bound_w}" height="5" rx="2.5" fill="#B399EE"/>

    <text x="442" y="152" class="r-mono" font-size="11" fill="#E5C068">Empathy 3/3 Peak True Cleave: {emp_min}–{emp_max}</text>

    <line x1="764" y1="64" x2="764" y2="152" stroke="#D4A843" stroke-opacity="0.22" stroke-width="1"/>

    <!-- Col 3: Turns to Kill -->
    <text x="788" y="74" class="r-h" font-size="10" fill="#E5C068">LETHAL FORECAST</text>
    <text x="788" y="114" class="r-num" font-size="32" fill="#F4EFE6">{ttk_opt} <tspan class="r-body" font-size="14" fill="#9CC084">optimal turns</tspan></text>
    <text x="788" y="144" class="r-it" font-size="13.5" fill="#C8C2B4">Standard rotation: {ttk_std} turns to shatter</text>

    <line x1="974" y1="64" x2="974" y2="152" stroke="#D4A843" stroke-opacity="0.22" stroke-width="1"/>

    <!-- Col 4: Mimic Detection -->
    <text x="996" y="74" class="r-h" font-size="10" fill="#B399EE">MIMIC ORACLE</text>
    <text x="996" y="104" class="r-num" font-size="22" fill="#D4886A">{mimic_pct:.1}% <tspan class="r-body" font-size="13" fill="#8E887A">trap risk</tspan></text>
    <text x="996" y="128" class="r-body" font-size="13.5" fill="#C8C2B4">Next Mimic aura:</text>
    <text x="996" y="148" class="r-mono" font-size="11.5" fill="#E5C068">{mimic_slot}</text>
  </g>
</svg>"##,
        storage_col = storage_col,
        storage_lbl = storage_lbl,
        boss_label = boss_label,
        boss_hp = rep.boss_hp,
        boss_max_hp = rep.boss_max_hp,
        armor = rep.boss_armor_pct,
        empathy = rep.empathy,
        verdict = verdict,
        slash_bonus = rep.slash_bonus,
        std_min = rep.standard_slash.min,
        std_max = rep.standard_slash.max,
        std_avg = rep.standard_slash.avg,
        std_w = std_w.min(210),
        bnd_min = rep.perfect_bound_slash.min,
        bnd_max = rep.perfect_bound_slash.max,
        bound_w = bound_w.min(210),
        emp_min = rep.empathy_true_cleave.min,
        emp_max = rep.empathy_true_cleave.max,
        ttk_opt = rep.turns_to_kill_optimal,
        ttk_std = rep.turns_to_kill_standard,
        mimic_pct = rep.mimic_trap_pct,
        mimic_slot = mimic_slot,
    )
}

async fn handler(req: Request) -> Result<Response<ResponseBody>, Error> {
    let query = parse_query(req.uri().query());
    let (mut state, storage) = fetch_redis_state().await;

    if let Some(st) = query.get("stage").and_then(|v| v.parse::<usize>().ok()) {
        state.stage_idx = st % BOSS_ROSTER.len();
        state.boss_hp = BOSS_ROSTER[state.stage_idx].max_hp;
        state.ending_reached = false;
    }
    if let Some(sb) = query.get("slash").and_then(|v| v.parse::<u32>().ok()) {
        state.slash_bonus = sb.clamp(0, 42);
    }
    if let Some(emp) = query.get("empathy").and_then(|v| v.parse::<u32>().ok()) {
        state.empathy = emp.min(3);
    }

    let report = compute_oracle(&state, storage);
    let wants_json = query.get("format").map(|s| s == "json").unwrap_or(false);

    if wants_json {
        let body = serde_json::to_string(&report)?;
        let res = Response::builder()
            .status(200)
            .header("Content-Type", "application/json; charset=utf-8")
            .header(
                "Cache-Control",
                "no-cache, no-store, must-revalidate, max-age=0, s-maxage=0",
            )
            .header("CDN-Cache-Control", "no-store")
            .header("Vercel-CDN-Cache-Control", "no-store")
            .body(ResponseBody::from(body))?;
        return Ok(res);
    }

    let svg = render_svg(&report);
    let res = Response::builder()
        .status(200)
        .header("Content-Type", "image/svg+xml; charset=utf-8")
        .header(
            "Cache-Control",
            "no-cache, no-store, must-revalidate, max-age=0, s-maxage=0",
        )
        .header("CDN-Cache-Control", "no-store")
        .header("Vercel-CDN-Cache-Control", "no-store")
        .body(ResponseBody::from(svg))?;
    Ok(res)
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    let service = service_fn(handler);
    run(service).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_armor_and_empathy_damage_projection() {
        let state = RedisArenaState {
            stage_idx: 1, // Sense Replica (220 HP, 20% armor)
            boss_hp: 220,
            slash_bonus: 6,
            empathy: 3,
            boss_bound: true,
            turn: 12,
            ending_reached: false,
        };
        let rep = compute_oracle(&state, "memory-fallback".to_string());
        assert_eq!(rep.boss_armor_pct, 20);
        // Min standard slash: round((38 + 6 + 0) * 0.8) = round(35.2) = 35
        assert_eq!(rep.standard_slash.min, 35);
        // Min Empathy + Bound + Crit: round(44 * 1.0 * 2.2 * 1.25) + 35 = 121 + 35 = 156
        assert_eq!(rep.empathy_true_cleave.min, 156);
        assert_eq!(rep.next_mimic_slot, "Sanctum Coffer II");
        assert!(rep.tactical_verdict.contains("LETHAL WINDOW"));
    }

    #[test]
    fn test_svg_rendering_and_xml_escape() {
        let state = RedisArenaState::default();
        let rep = compute_oracle(&state, "upstash".to_string());
        let svg = render_svg(&rep);
        assert!(svg.starts_with("<svg "));
        assert!(svg.ends_with("</svg>"));
        assert!(svg.contains("UPSTASH SYNCED"));
        assert_eq!(xml_escape("A & <B> \"C\""), "A &amp; &lt;B&gt; &quot;C&quot;");
    }

    #[test]
    fn test_query_parser() {
        let q = parse_query(Some("format=json&stage=3&slash=18"));
        assert_eq!(q.get("format").map(String::as_str), Some("json"));
        assert_eq!(q.get("stage").map(String::as_str), Some("3"));
        assert_eq!(q.get("slash").map(String::as_str), Some("18"));
    }
}
