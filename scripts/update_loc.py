"""Daily auto-updater for FitzzXYZ GitHub Profile SVGs:
1. assets/frieren-total-loc.svg      — Total Lines of Code across all owned non-fork repos (private + public with LOC_TOKEN/GH_TOKEN)
2. assets/mana-contribution-grid.svg — Live 52-week GitHub contribution calendar
3. assets/frieren-telemetry-ledger.svg — Live GitHub contributions, followers, following & repo count
"""
import base64
from datetime import datetime, timezone, timedelta
import html as html_lib
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.request

USERNAME = os.environ.get("GITHUB_USERNAME", "FitzzXYZ")
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_DIR = os.path.join(REPO_ROOT, "assets")
FONTS_DIR = os.path.join(ASSETS_DIR, "fonts")
README_PATH = os.path.join(REPO_ROOT, "README.md")
OUT_LOC_SVG = os.path.join(ASSETS_DIR, "frieren-total-loc.svg")
OUT_GRID_SVG = os.path.join(ASSETS_DIR, "mana-contribution-grid.svg")
OUT_LEDGER_SVG = os.path.join(ASSETS_DIR, "frieren-telemetry-ledger.svg")
OUT_GRAPH_SVG = os.path.join(ASSETS_DIR, "frieren-activity-graph.svg")
OUT_ADV_SVG = os.path.join(ASSETS_DIR, "frieren-adventurer-card.svg")
OUT_DASH_SVG = os.path.join(ASSETS_DIR, "developer-dashboard.svg")
OUT_CLOCK_SVG = os.path.join(ASSETS_DIR, "frieren-clock.svg")
AUTHOR_PATTERN = os.environ.get("GIT_AUTHOR_PATTERN", r"FitzzXYZ\|achmadhafizmaulana290307")

# Owned local repositories + parent folders scanned (1 level) for any FitzzXYZ/* repos
LOCAL_OWNED_REPOS = [
    REPO_ROOT,
    r"C:\Users\T4N0C\OneDrive\Documents\Pak Gondrong",
]
SCAN_PARENTS = [
    r"D:\\",
    r"C:\Users\T4N0C\OneDrive\Documents",
    r"C:\Users\T4N0C\.gemini\antigravity\scratch",
    r"C:\xampp\htdocs",
    r"C:\Users\T4N0C\Documents",
]

# Verified snapshot of FitzzXYZ's own repositories:
# FitzzXYZ, Lomba-UI-UX, RPL-Web, Portofolio, WEB-Gondrong-Rental (excluding blank lines & comments)
BASELINE = {
    "total_lines": 26303,
    "total_files": 151,
    "total_repos": 5,
    "total_langs": 9,
    "languages": [
        {"name": "TypeScript", "lines": 14551, "pct": 55.3, "color": "#7DA8E6"},
        {"name": "JSX",        "lines": 3692,  "pct": 14.0, "color": "#9CC084"},
        {"name": "JavaScript", "lines": 3013,  "pct": 11.5, "color": "#E5C068"},
        {"name": "CSS",        "lines": 2074,  "pct": 7.9,  "color": "#B399EE"},
        {"name": "PHP",        "lines": 1678,  "pct": 6.4,  "color": "#8E96C8"},
        {"name": "HTML",       "lines": 417,   "pct": 1.6,  "color": "#D4886A"},
        {"name": "SQL",        "lines": 372,   "pct": 1.4,  "color": "#C8A252"},
        {"name": "Python",     "lines": 296,   "pct": 1.1,  "color": "#6EA8A6"},
        {"name": "Blade",      "lines": 210,   "pct": 0.8,  "color": "#C96D68"},
    ],
    "other_segments": [],
}

LANG_COLORS = {
    "TypeScript": "#7DA8E6",
    "JSX": "#9CC084",
    "JavaScript": "#E5C068",
    "CSS": "#B399EE",
    "SCSS": "#C4A7F2",
    "PHP": "#8E96C8",
    "HTML": "#D4886A",
    "SQL": "#C8A252",
    "Python": "#6EA8A6",
    "Blade": "#C96D68",
    "Java": "#C48F47",
    "Go": "#6BB5C9",
    "Bourne Shell": "#7EA876",
    "DOS Batch": "#8E887A",
    "PowerShell": "#7DA8E6",
    "Vue": "#85B890",
    "Svelte": "#D4886A",
    "Rust": "#C98D6B",
}

EXT_MAP = {
    ".tsx": "TypeScript", ".ts": "TypeScript",
    ".jsx": "JSX",
    ".js": "JavaScript", ".mjs": "JavaScript", ".cjs": "JavaScript",
    ".php": "PHP", ".java": "Java", ".py": "Python",
    ".html": "HTML", ".htm": "HTML", ".css": "CSS", ".scss": "SCSS",
    ".sql": "SQL", ".sh": "Bourne Shell", ".bash": "Bourne Shell",
    ".bat": "DOS Batch", ".cmd": "DOS Batch", ".ps1": "PowerShell",
    ".go": "Go", ".rs": "Rust", ".vue": "Vue", ".svelte": "Svelte",
}

SKIP_DIRS = {
    ".git", "node_modules", "vendor", ".next", "dist", "build",
    ".settings", "bin", ".metadata", "__pycache__", ".venv", "venv",
    "target", "out", ".vscode", ".idea", "storage", "bootstrap", "cache",
}


def fmt_id(n: int) -> str:
    return f"{n:,}".replace(",", ".")


def font_b64(fname: str) -> str:
    path = os.path.join(FONTS_DIR, fname)
    if not os.path.exists(path):
        return ""
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("ascii")


def http_get(url: str, token: str = "") -> str:
    headers = {"User-Agent": "FitzzXYZ-Profile-AutoUpdater"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
        headers["Accept"] = "application/vnd.github+json"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.read().decode("utf-8", errors="ignore")


def count_file_lines(path: str) -> int:
    cnt = 0
    in_block = False
    with open(path, "r", encoding="utf-8", errors="ignore") as fp:
        for line in fp:
            s = line.strip()
            if not s:
                continue
            if in_block:
                if "*/" in s:
                    in_block = False
                continue
            if s.startswith("/*"):
                if "*/" not in s:
                    in_block = True
                continue
            if s.startswith(("//", "#", "--", "<!--", "*")):
                continue
            cnt += 1
    return cnt


def summarize_dirs(repo_dirs: list[str]) -> dict | None:
    """Count actual source code lines (no blank lines/comments) across a list of repository directories."""
    lang_lines = {}
    total_files = 0
    counted_repos = 0
    for dst in repo_dirs:
        if not os.path.isdir(dst):
            continue
        repo_has_code = False
        for root, dirs, files in os.walk(dst):
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")]
            for f in files:
                if f.endswith((".min.js", ".min.css", ".d.ts")):
                    continue
                lang = "Blade" if f.endswith(".blade.php") else EXT_MAP.get(os.path.splitext(f)[1].lower())
                if not lang:
                    continue
                p = os.path.join(root, f)
                try:
                    if os.path.getsize(p) > 500_000:
                        continue
                    cnt = count_file_lines(p)
                    if cnt > 0:
                        lang_lines[lang] = lang_lines.get(lang, 0) + cnt
                        total_files += 1
                        repo_has_code = True
                except Exception:
                    pass
        if repo_has_code:
            counted_repos += 1

    total_lines = sum(lang_lines.values())
    if total_lines == 0:
        return None

    sorted_langs = sorted(lang_lines.items(), key=lambda x: -x[1])
    top10 = []
    used_pct = 0.0
    for name, lns in sorted_langs[:10]:
        pct = round(lns * 100.0 / total_lines, 1)
        used_pct += pct
        top10.append({
            "name": name,
            "lines": lns,
            "pct": pct,
            "color": LANG_COLORS.get(name, "#8BA872"),
        })
    rem_pct = max(0.0, round(100.0 - used_pct, 1))
    return {
        "total_lines": total_lines,
        "total_files": total_files,
        "total_repos": counted_repos,
        "total_langs": len(lang_lines),
        "languages": top10,
        "other_segments": [{"pct": rem_pct, "color": "#6B7280"}] if rem_pct >= 0.1 else [],
    }


def count_author_commits(repo_dir: str) -> int:
    try:
        out = subprocess.check_output(
            ["git", "-C", repo_dir, "rev-list", "--count", f"--author={AUTHOR_PATTERN}", "HEAD"],
            stderr=subprocess.DEVNULL, text=True,
        ).strip()
        return int(out) if out.isdigit() else 0
    except Exception:
        return 0


def discover_local_owned_repos() -> list[str]:
    """Discover all local Git repos owned by OR contributed to by USERNAME (1-level fast scan)."""
    found = [os.path.normpath(p) for p in LOCAL_OWNED_REPOS if os.path.isdir(os.path.join(p, ".git"))]
    owner_needle = f"github.com/{USERNAME.lower()}/"
    for parent in SCAN_PARENTS:
        if not os.path.isdir(parent):
            continue
        try:
            entries = os.listdir(parent)
        except OSError:
            continue
        for name in entries:
            p = os.path.normpath(os.path.join(parent, name))
            if p in found or not os.path.isdir(os.path.join(p, ".git")):
                continue
            try:
                url = subprocess.check_output(
                    ["git", "-C", p, "remote", "get-url", "origin"],
                    stderr=subprocess.DEVNULL, text=True,
                ).strip().lower()
            except Exception:
                url = ""
            if owner_needle in url or count_author_commits(p) > 0:
                found.append(p)
    return found


def try_count_local_repos() -> dict | None:
    """When running locally on the developer's machine, recount live across all owned & contributed repos."""
    existing = discover_local_owned_repos()
    if len(existing) < 2:
        return None
    data = summarize_dirs(existing)
    if data:
        data["total_commits"] = sum(count_author_commits(p) for p in existing)
    return data


def try_count_from_github() -> dict | None:
    """When LOC_TOKEN or GH_TOKEN (PAT with repo scope) is configured in CI, count across owned & contributed non-fork repos."""
    token = (os.environ.get("LOC_TOKEN") or os.environ.get("GH_TOKEN") or "").strip()
    if not token:
        return None
    try:
        repos = []
        page = 1
        while True:
            raw = http_get(
                f"https://api.github.com/user/repos?per_page=100&affiliation=owner,collaborator&page={page}",
                token=token,
            )
            batch = json.loads(raw)
            if not batch:
                break
            repos.extend(r for r in batch if not r.get("fork"))
            if len(batch) < 100:
                break
            page += 1

        if not repos:
            return None

        with tempfile.TemporaryDirectory() as tmp:
            cloned = []
            for r in repos:
                clone_url = r["clone_url"].replace("https://", f"https://x-access-token:{token}@")
                dst = os.path.join(tmp, r["name"])
                res = subprocess.run(["git", "clone", "--depth", "1", clone_url, dst], check=False)
                if res.returncode == 0 and os.path.isdir(dst):
                    cloned.append(dst)
            return summarize_dirs(cloned)
    except Exception as exc:
        print(f"[warn] GitHub private LOC fetch skipped: {exc}")
        return None


def build_loc_svg(data: dict) -> str:
    cinzel_600 = font_b64("cinzel-600.woff")
    cinzel_800 = font_b64("cinzel-800.woff")
    cormorant_600 = font_b64("cormorant-600.woff")
    cormorant_500i = font_b64("cormorant-italic-500.woff")

    wib = timezone(timedelta(hours=7))
    updated_str = datetime.now(wib).strftime("Diperbarui %d-%m-%Y")

    bar_x = 56.0
    bar_w = 1088.0
    bar_y = 186
    bar_h = 16

    all_segs = list(data["languages"]) + list(data.get("other_segments", []))
    total_pct = sum(s["pct"] for s in all_segs) or 100.0
    cur_x = bar_x
    seg_rects = []
    for i, seg in enumerate(all_segs):
        w = (seg["pct"] / total_pct) * bar_w
        if i == len(all_segs) - 1:
            w = max(0.0, (bar_x + bar_w) - cur_x)
        seg_rects.append(
            f'<rect x="{cur_x:.2f}" y="{bar_y}" width="{w + 0.6:.2f}" height="{bar_h}" fill="{seg["color"]}"/>'
        )
        cur_x += w
    bar_svg = "\n      ".join(seg_rects)

    langs = data["languages"][:10]
    row_els = []
    for idx, item in enumerate(langs):
        col = idx % 2
        row = idx // 2
        cx = 64 if col == 0 else 638
        tx = 84 if col == 0 else 658
        rx = 562 if col == 0 else 1144
        ry = 242 + row * 36

        lines_str = fmt_id(item["lines"])
        pct_str = f"{item['pct']:.1f}%"

        row_els.append(f'''
      <circle cx="{cx}" cy="{ry - 5}" r="6" fill="{item["color"]}"/>
      <text x="{tx}" y="{ry}" class="sans-bold" font-size="16" fill="#F4EFE6">{item["name"]}</text>
      <text x="{rx}" y="{ry}" text-anchor="end" class="mono-stat" font-size="15.5" fill="#C8C2B4">{lines_str} baris  ·  <tspan fill="{item["color"]}" font-weight="600">{pct_str}</tspan></text>''')

    rows_svg = "\n".join(row_els)
    total_lines_str = fmt_id(data["total_lines"])
    meta_str = f'{fmt_id(data["total_files"])} file  ·  {data["total_repos"]} repo  ·  {data["total_langs"]} bahasa'

    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 456" width="100%" height="100%">
  <defs>
    <linearGradient id="loc_outer_bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0E1310"/>
      <stop offset="50%" stop-color="#131815"/>
      <stop offset="100%" stop-color="#16131E"/>
    </linearGradient>
    <linearGradient id="loc_card_bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#101512"/>
      <stop offset="55%" stop-color="#141916"/>
      <stop offset="100%" stop-color="#171420"/>
    </linearGradient>
    <linearGradient id="loc_border" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#D4A843" stop-opacity="0.55"/>
      <stop offset="50%" stop-color="#8BA872" stop-opacity="0.65"/>
      <stop offset="100%" stop-color="#A78BFA" stop-opacity="0.55"/>
    </linearGradient>
    <radialGradient id="loc_glow" cx="85%" cy="18%" r="60%">
      <stop offset="0%" stop-color="#8BA872" stop-opacity="0.10"/>
      <stop offset="55%" stop-color="#D4A843" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="#0E1310" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="loc_clip"><rect x="0" y="0" width="1200" height="456" rx="16"/></clipPath>
    <clipPath id="loc_bar_clip"><rect x="{bar_x}" y="{bar_y}" width="{bar_w}" height="{bar_h}" rx="8"/></clipPath>
    <linearGradient id="loc_sheen" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#F4EFE6" stop-opacity="0"/>
      <stop offset="50%" stop-color="#F4EFE6" stop-opacity="0.32"/>
      <stop offset="100%" stop-color="#F4EFE6" stop-opacity="0"/>
    </linearGradient>
    <style>
      @font-face {{
        font-family: 'Cinzel';
        font-style: normal;
        font-weight: 600;
        src: url("data:font/woff;base64,{cinzel_600}") format("woff");
      }}
      @font-face {{
        font-family: 'Cinzel';
        font-style: normal;
        font-weight: 800;
        src: url("data:font/woff;base64,{cinzel_800}") format("woff");
      }}
      @font-face {{
        font-family: 'Cormorant';
        font-style: normal;
        font-weight: 600;
        src: url("data:font/woff;base64,{cormorant_600}") format("woff");
      }}
      @font-face {{
        font-family: 'CormorantItalic';
        font-style: italic;
        font-weight: 500;
        src: url("data:font/woff;base64,{cormorant_500i}") format("woff");
      }}
      .cinzel {{ font-family: 'Cinzel', Georgia, serif; font-weight: 600; }}
      .folio {{ font-family: 'CormorantItalic', Georgia, serif; font-style: italic; font-size: 14.5px; }}
      .sans-bold {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif; font-weight: 700; }}
      .sans-reg {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif; font-weight: 400; }}
      .mono-stat {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif; font-variant-numeric: tabular-nums; }}
    </style>
  </defs>

  <rect x="0.5" y="0.5" width="1199" height="455" rx="15.5" fill="url(#loc_outer_bg)" stroke="url(#loc_border)" stroke-width="1.2"/>
  <rect x="6.5" y="6.5" width="1187" height="443" rx="11" fill="none" stroke="#D4A843" stroke-width="0.7" stroke-opacity="0.28"/>
  <polygon points="16,12 20,16 16,20 12,16" fill="#D4A843" fill-opacity="0.65"/>
  <polygon points="1184,12 1188,16 1184,20 1180,16" fill="#D4A843" fill-opacity="0.65"/>
  <polygon points="16,444 20,440 16,436 12,440" fill="#D4A843" fill-opacity="0.65"/>
  <polygon points="1184,444 1188,440 1184,436 1180,440" fill="#D4A843" fill-opacity="0.65"/>

  <g clip-path="url(#loc_clip)">
    <g transform="translate(36, 20)">
      <rect x="0" y="0" width="24" height="24" rx="4" fill="#1A1512" stroke="#D4A843" stroke-width="1.4"/>
      <line x1="3" y1="7" x2="21" y2="7" stroke="#8E887A" stroke-width="1.2"/>
      <line x1="3" y1="12" x2="21" y2="12" stroke="#8E887A" stroke-width="1.2"/>
      <line x1="3" y1="17" x2="21" y2="17" stroke="#8E887A" stroke-width="1.2"/>
      <circle cx="7" cy="7" r="2" fill="#E05D53"><animate attributeName="cx" values="7;9;7" dur="5.2s" repeatCount="indefinite"/></circle>
      <circle cx="12" cy="7" r="2" fill="#E5C068"><animate attributeName="opacity" values="0.7;1;0.7" dur="3.6s" repeatCount="indefinite"/></circle>
      <circle cx="17" cy="7" r="2" fill="#9CC084"/>
      <circle cx="9" cy="12" r="2" fill="#4A90E2"><animate attributeName="cx" values="9;7;9" dur="6.0s" repeatCount="indefinite"/></circle>
      <circle cx="15" cy="12" r="2" fill="#B399EE"><animate attributeName="opacity" values="0.65;1;0.65" dur="4.0s" repeatCount="indefinite"/></circle>
      <circle cx="7" cy="17" r="2" fill="#E5C068"/>
      <circle cx="13" cy="17" r="2" fill="#9CC084"><animate attributeName="cx" values="13;16;13" dur="5.6s" repeatCount="indefinite"/></circle>
    </g>
    <text x="70" y="39" class="cinzel" font-size="18.5" fill="#F4EFE6" letter-spacing="0.8">TOTAL KODE YANG SUDAH SAYA TULIS</text>
    <text x="1164" y="39" text-anchor="end" class="folio" fill="#D4A843">FitzzXYZ Owned &amp; Contributed Repos · Verified LOC</text>
    <line x1="36" y1="54" x2="1164" y2="54" stroke="#D4A843" stroke-opacity="0.28" stroke-width="1"/>

    <rect x="28" y="68" width="1144" height="362" rx="12" fill="url(#loc_card_bg)" stroke="#D4A843" stroke-opacity="0.24" stroke-width="1"/>
    <rect x="28" y="68" width="1144" height="362" rx="12" fill="url(#loc_glow)"/>

    <text x="56" y="102" class="cinzel" font-size="12.5" fill="#9CC084" letter-spacing="1.6">TOTAL KODE YANG SUDAH DITULIS</text>
    <text x="1144" y="102" text-anchor="end" class="cinzel" font-size="11.5" fill="#D4A843" letter-spacing="1.4">LIVE VERIFIED CODEBASE</text>
    <text x="56" y="148" class="cinzel" font-size="42" font-weight="800" fill="#F4EFE6">{total_lines_str} <tspan class="folio" font-size="21" fill="#E5C068">baris kode</tspan></text>
    <text x="1144" y="144" text-anchor="end" class="cinzel" font-size="22" fill="#E5C068">{data["total_repos"]} <tspan class="folio" font-size="16" fill="#C8C2B4">active repos  ·  </tspan>{data["total_langs"]} <tspan class="folio" font-size="16" fill="#C8C2B4">languages</tspan></text>
    <text x="56" y="172" class="folio" font-size="15.5" fill="#C8C2B4">{meta_str}</text>
    <text x="1144" y="172" text-anchor="end" class="folio" font-size="14" fill="#9CC084">Auto-synced on every commit &amp; hourly</text>

    <g clip-path="url(#loc_bar_clip)">
      {bar_svg}
      <rect x="-220" y="{bar_y}" width="220" height="{bar_h}" fill="url(#loc_sheen)">
        <animate attributeName="x" values="-220;1320" dur="6.5s" repeatCount="indefinite"/>
      </rect>
    </g>

    <line x1="598" y1="224" x2="598" y2="392" stroke="#D4A843" stroke-opacity="0.22" stroke-width="1"/>
    {rows_svg}

    <text x="56" y="414" class="folio" font-size="13.5" fill="#8E887A">Dihitung dari repo milik sendiri &amp; kontribusi GitHub (termasuk private, tanpa fork), kode aktual tanpa baris kosong &amp; komentar.</text>
    <text x="1144" y="414" text-anchor="end" class="folio" font-size="13.5" fill="#D4A843">{updated_str}</text>
  </g>
</svg>'''


def build_activity_graph_svg(daily_points: list[tuple[str, int]]) -> str:
    """Build a 31-day smooth monotone cubic contribution graph matching the Frieren x Ubel Grimoire palette."""
    cinzel_600 = font_b64("cinzel-600.woff")
    cormorant_500i = font_b64("cormorant-italic-500.woff")
    wib = timezone(timedelta(hours=7))
    updated_str = datetime.now(wib).strftime("Diperbarui %d-%m-%Y")

    pts = daily_points[-31:]
    n = len(pts)
    vals = [c for _, c in pts]
    raw_max = max(vals) if vals else 1
    # Clean integer Y-axis ceiling and tick step
    if raw_max <= 9:
        y_max, y_step = max(raw_max, 5), 1
    elif raw_max <= 20:
        y_max = ((raw_max + 1) // 2) * 2
        y_step = 2
    else:
        y_step = max(5, ((raw_max // 5) + 4) // 5 * 5)
        y_max = ((raw_max + y_step - 1) // y_step) * y_step

    gx0, gy0 = 96.0, 84.0
    gx1, gy1 = 1152.0, 290.0
    gw, gh = gx1 - gx0, gy1 - gy0

    coords = []
    for i, (_, v) in enumerate(pts):
        x = gx0 + (i / max(1, n - 1)) * gw
        y = gy1 - (v / max(1, y_max)) * gh
        coords.append((x, y, v))

    # Fritsch-Carlson monotone Hermite cubic spline (smooth curves without undershooting below 0)
    slopes = [0.0] * n
    secants = [(coords[i + 1][1] - coords[i][1]) / max(1e-6, coords[i + 1][0] - coords[i][0]) for i in range(n - 1)]
    slopes[0] = secants[0] if n > 1 else 0.0
    slopes[-1] = secants[-1] if n > 1 else 0.0
    for i in range(1, n - 1):
        if secants[i - 1] * secants[i] <= 0:
            slopes[i] = 0.0
        else:
            slopes[i] = (secants[i - 1] + secants[i]) * 0.5
    for i in range(n - 1):
        if abs(secants[i]) < 1e-9:
            slopes[i] = 0.0
            slopes[i + 1] = 0.0
        else:
            a = slopes[i] / secants[i]
            b = slopes[i + 1] / secants[i]
            h = (a * a + b * b) ** 0.5
            if h > 3.0:
                t = 3.0 / h
                slopes[i] = t * a * secants[i]
                slopes[i + 1] = t * b * secants[i]

    path_parts = [f"M {coords[0][0]:.2f} {coords[0][1]:.2f}"]
    for i in range(n - 1):
        x0, y0, _ = coords[i]
        x1, y1, _ = coords[i + 1]
        dx = x1 - x0
        cp1x = x0 + dx / 3.0
        cp1y = min(gy1, max(gy0 - 4, y0 + slopes[i] * dx / 3.0))
        cp2x = x1 - dx / 3.0
        cp2y = min(gy1, max(gy0 - 4, y1 - slopes[i + 1] * dx / 3.0))
        path_parts.append(f"C {cp1x:.2f} {cp1y:.2f}, {cp2x:.2f} {cp2y:.2f}, {x1:.2f} {y1:.2f}")

    line_d = " ".join(path_parts)
    area_d = f"{line_d} L {coords[-1][0]:.2f} {gy1:.2f} L {coords[0][0]:.2f} {gy1:.2f} Z"

    # Gridlines & axis labels
    grid_lines = []
    for tick in range(0, y_max + 1, y_step):
        ty = gy1 - (tick / max(1, y_max)) * gh
        grid_lines.append(
            f'<line x1="{gx0:.1f}" y1="{ty:.1f}" x2="{gx1:.1f}" y2="{ty:.1f}" stroke="#D4A843" stroke-opacity="0.14" stroke-width="1" stroke-dasharray="3 4"/>'
            f'<text x="{gx0 - 14:.1f}" y="{ty + 4:.1f}" text-anchor="end" class="axis-num">{tick}</text>'
        )

    x_labels = []
    dots = []
    peak_val = max(vals) if vals else 0
    for i, ((dt, v), (x, y, _)) in enumerate(zip(pts, coords)):
        day_num = str(int(dt.split("-")[2]))
        grid_lines.append(
            f'<line x1="{x:.1f}" y1="{gy0:.1f}" x2="{x:.1f}" y2="{gy1:.1f}" stroke="#D4A843" stroke-opacity="0.08" stroke-width="1" stroke-dasharray="3 4"/>'
        )
        x_labels.append(f'<text x="{x:.1f}" y="{gy1 + 22:.1f}" text-anchor="middle" class="axis-num">{day_num}</text>')
        if v > 0 and v == peak_val:
            dots.append(
                f'<circle cx="{x:.1f}" cy="{y:.1f}" r="8" fill="#E5C068" fill-opacity="0.32">'
                f'<animate attributeName="r" values="6;16;6" dur="3.4s" repeatCount="indefinite"/>'
                f'<animate attributeName="fill-opacity" values="0.38;0.04;0.38" dur="3.4s" repeatCount="indefinite"/>'
                f'</circle>'
            )
            dots.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="4.5" fill="#F4EFE6" stroke="#E5C068" stroke-width="1.8"/>')
        elif v > 0:
            dots.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="4.2" fill="#F4EFE6" stroke="#B399EE" stroke-width="1.6"/>')
        else:
            dots.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="3.4" fill="#F4EFE6" stroke="#8BA872" stroke-width="1.1" fill-opacity="0.9"/>')

    period_total = sum(vals)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 364" width="100%" height="100%">
  <defs>
    <linearGradient id="ag_bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0E1310"/>
      <stop offset="50%" stop-color="#131815"/>
      <stop offset="100%" stop-color="#16131E"/>
    </linearGradient>
    <linearGradient id="ag_border" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#D4A843" stop-opacity="0.55"/>
      <stop offset="50%" stop-color="#8BA872" stop-opacity="0.65"/>
      <stop offset="100%" stop-color="#A78BFA" stop-opacity="0.55"/>
    </linearGradient>
    <linearGradient id="ag_line" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#9CC084"/>
      <stop offset="55%" stop-color="#B399EE"/>
      <stop offset="100%" stop-color="#E5C068"/>
    </linearGradient>
    <linearGradient id="ag_area" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#B399EE" stop-opacity="0.34"/>
      <stop offset="65%" stop-color="#9CC084" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#0E1310" stop-opacity="0.0"/>
    </linearGradient>
    <clipPath id="ag_clip"><rect x="0" y="0" width="1200" height="364" rx="16"/></clipPath>
    <style>
      @font-face {{
        font-family: 'Cinzel';
        font-style: normal;
        font-weight: 600;
        src: url("data:font/woff;base64,{cinzel_600}") format("woff");
      }}
      @font-face {{
        font-family: 'CormorantItalic';
        font-style: italic;
        font-weight: 500;
        src: url("data:font/woff;base64,{cormorant_500i}") format("woff");
      }}
      .cinzel {{ font-family: 'Cinzel', Georgia, serif; font-weight: 600; }}
      .folio {{ font-family: 'CormorantItalic', Georgia, serif; font-style: italic; }}
      .axis-num {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif; font-size: 12px; fill: #9CC084; font-variant-numeric: tabular-nums; }}
      .axis-title {{ font-family: 'Cinzel', Georgia, serif; font-size: 11.5px; fill: #D4A843; letter-spacing: 1.4px; }}
    </style>
  </defs>

  <rect x="0.5" y="0.5" width="1199" height="363" rx="15.5" fill="url(#ag_bg)" stroke="url(#ag_border)" stroke-width="1.2"/>
  <rect x="6.5" y="6.5" width="1187" height="351" rx="11" fill="none" stroke="#D4A843" stroke-width="0.7" stroke-opacity="0.28"/>
  <polygon points="16,12 20,16 16,20 12,16" fill="#D4A843" fill-opacity="0.65"/>
  <polygon points="1184,12 1188,16 1184,20 1180,16" fill="#D4A843" fill-opacity="0.65"/>
  <polygon points="16,352 20,348 16,344 12,348" fill="#D4A843" fill-opacity="0.65"/>
  <polygon points="1184,352 1188,348 1184,344 1180,348" fill="#D4A843" fill-opacity="0.65"/>

  <g clip-path="url(#ag_clip)">
    <text x="36" y="42" class="cinzel" font-size="18.5" fill="#F4EFE6" letter-spacing="0.8">{USERNAME.upper()}’S CONTRIBUTION GRAPH</text>
    <text x="1164" y="42" text-anchor="end" class="folio" font-size="14.5" fill="#D4A843">{period_total} contributions in the last 31 days  ·  {updated_str}</text>
    <line x1="36" y1="56" x2="1164" y2="56" stroke="#D4A843" stroke-opacity="0.28" stroke-width="1"/>

    <text x="34" y="188" text-anchor="middle" transform="rotate(-90 34 188)" class="axis-title">CONTRIBUTIONS</text>
    <text x="624" y="340" text-anchor="middle" class="axis-title">DAYS</text>

    {"".join(grid_lines)}
    {"".join(x_labels)}

    <path d="{area_d}" fill="url(#ag_area)"/>
    <path id="ag_curve_path" d="{line_d}" fill="none" stroke="url(#ag_line)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <circle r="5" fill="#E5C068" fill-opacity="0.35">
      <animateMotion dur="8.5s" repeatCount="indefinite" path="{line_d}"/>
    </circle>
    <circle r="2.6" fill="#F4EFE6">
      <animateMotion dur="8.5s" repeatCount="indefinite" path="{line_d}"/>
    </circle>
    {"".join(dots)}
  </g>
</svg>'''


def update_live_github_widgets(loc_data: dict | None = None):
    """Update contribution grid, 31-day activity graph, telemetry ledger, and adventurer card directly from GitHub."""
    token = (os.environ.get("LOC_TOKEN") or os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN") or "").strip()
    total_contribs = None
    best_streak = None
    try:
        html = http_get(f"https://github.com/users/{USERNAME}/contributions")
        m_tot = re.search(r"([\d,]+)\s+contributions?\s+in\s+the\s+last\s+year", html)
        if m_tot:
            total_contribs = int(m_tot.group(1).replace(",", ""))
        cells = re.findall(
            r'data-date="(\d{4}-\d{2}-\d{2})"[^>]*id="contribution-day-component-(\d+)-(\d+)"[^>]*data-level="(\d)"',
            html,
        )
        if cells and os.path.exists(OUT_GRID_SVG):
            level_colors = {0: "#171D19", 1: "#35523A", 2: "#5F7A50", 3: "#8BA872", 4: "#E5C068"}
            rect_parts = []
            for idx, (_, r, c, lvl) in enumerate(cells):
                lv = int(lvl)
                col = level_colors.get(lv, "#171D19")
                rx, ry = 58 + int(c) * 21, 72 + int(r) * 21
                if lv >= 3:
                    dur = 3.2 + (idx % 4) * 0.6
                    rect_parts.append(
                        f'<rect x="{rx}" y="{ry}" width="15" height="15" rx="3" fill="{col}">'
                        f'<animate attributeName="opacity" values="0.72;1;0.72" dur="{dur:.1f}s" repeatCount="indefinite"/>'
                        f'</rect>'
                    )
                else:
                    rect_parts.append(f'<rect x="{rx}" y="{ry}" width="15" height="15" rx="3" fill="{col}"/>')
            rects = "".join(rect_parts)
            with open(OUT_GRID_SVG, "r", encoding="utf-8") as f:
                grid_svg = f.read()
            grid_svg = re.sub(r"<g>(<rect [^>]+(?:/>|>.*?</rect>))+</g>", f"<g>{rects}</g>", grid_svg, count=1)
            if total_contribs is not None:
                grid_svg = re.sub(
                    r"\d+\s+inscriptions recorded in the current cycle",
                    f"{total_contribs} inscriptions recorded in the current cycle",
                    grid_svg,
                )
            with open(OUT_GRID_SVG, "w", encoding="utf-8") as f:
                f.write(grid_svg)
            print(f"Updated {OUT_GRID_SVG} ({total_contribs} contributions, {len(cells)} cells)")

        # Build 31-day live contribution spline graph + compute annual best streak
        day_ids = dict(re.findall(r'data-date="(\d{4}-\d{2}-\d{2})"[^>]*id="(contribution-day-component-\d+-\d+)"', html))
        tips = dict(re.findall(r'for="(contribution-day-component-\d+-\d+)"[^>]*>([^<]+)<', html))
        all_daily = []
        best_streak = cur = 0
        for dt, cid in sorted(day_ids.items()):
            m_day = re.match(r"(\d+)\s+contribution", tips.get(cid, "").strip())
            cnt = int(m_day.group(1)) if m_day else 0
            all_daily.append((dt, cnt))
            if cnt > 0:
                cur += 1
                best_streak = max(best_streak, cur)
            else:
                cur = 0
        daily_points = all_daily[-31:]
        if daily_points:
            graph_svg = build_activity_graph_svg(daily_points)
            with open(OUT_GRAPH_SVG, "w", encoding="utf-8") as f:
                f.write(graph_svg)
            print(f"Generated {OUT_GRAPH_SVG} ({os.path.getsize(OUT_GRAPH_SVG)/1024:.1f} KB, 31-day sum={sum(c for _, c in daily_points)}, streak={best_streak})")
    except Exception as exc:
        print(f"[warn] Contribution grid/graph live update skipped: {exc}")

    try:
        profile = json.loads(http_get(f"https://api.github.com/users/{USERNAME}", token=token))
        followers = profile.get("followers")
        following = profile.get("following")
        pub_repos = profile.get("public_repos")
        commits = (loc_data or {}).get("total_commits")
        if os.path.exists(OUT_LEDGER_SVG):
            with open(OUT_LEDGER_SVG, "r", encoding="utf-8") as f:
                ledger = f.read()
            if total_contribs is not None:
                ledger = re.sub(
                    r'(<text x="36" y="86" class="cinzel-bold" font-size="34" fill="#F4EFE6">)\d+(</text>)',
                    rf"\g<1>{total_contribs}\g<2>",
                    ledger,
                )
            if commits:
                ledger = re.sub(
                    r'(<text x="340" y="86" class="cinzel-bold" font-size="34" fill="#F4EFE6">)\d+(</text>)',
                    rf"\g<1>{commits}\g<2>",
                    ledger,
                )
            if pub_repos is not None:
                ledger = re.sub(r"\d+\s+public repos", f"{pub_repos} public repos", ledger)
            wib = timezone(timedelta(hours=7))
            live_date = datetime.now(wib).strftime("Live · %d %b %Y · GitHub")
            ledger = re.sub(r"(?:May – Nov 2026|Live · \d{2} [A-Za-z]{3} \d{4}) · GitHub", live_date, ledger)
            if followers is not None and following is not None:
                ledger = re.sub(
                    r'(<text x="936" y="86" class="cinzel-bold" font-size="34" fill="#F4EFE6">)\d+(</text>)',
                    rf"\g<1>{followers}\g<2>",
                    ledger,
                )
                ledger = re.sub(r"followers · \d+ following", f"followers · {following} following", ledger)
            with open(OUT_LEDGER_SVG, "w", encoding="utf-8") as f:
                f.write(ledger)
            print(f"Updated {OUT_LEDGER_SVG} (contribs={total_contribs}, commits={commits}, followers={followers}, repos={pub_repos})")

        if os.path.exists(OUT_ADV_SVG):
            with open(OUT_ADV_SVG, "r", encoding="utf-8") as f:
                adv = f.read()
            if commits:
                adv = re.sub(r"\d+\s+repository commits", f"{commits} repository commits", adv)
            if followers is not None and following is not None:
                adv = re.sub(r"\d+\s+guild followers · \d+\s+following", f"{followers} guild followers · {following} following", adv)
            if best_streak is not None and total_contribs is not None:
                adv = re.sub(r"\d+\s+day best streak · \d+\s+contributions", f"{best_streak} day best streak · {total_contribs} contributions", adv)
            if total_contribs is not None:
                lv = 3 if total_contribs >= 50 else 2
                cap = 100 if total_contribs >= 50 else 50
                xp = min(total_contribs, cap) if total_contribs < 100 else (total_contribs % 100)
                if total_contribs >= 100:
                    lv = 3 + (total_contribs // 100)
                bar_w = max(36, int(round((xp / float(cap)) * 686)))
                adv = re.sub(r"LV \d+  &gt;  \d+", f"LV {lv}  &gt;  {lv + 1}", adv)
                adv = re.sub(r"\d+ / \d+ mana xp", f"{xp} / {cap} mana xp", adv)
                adv = re.sub(
                    r'(<rect x="418" y="470" width=")\d+(" height="14" rx="5" fill="url\(#manaXpGrad\)"/>)',
                    rf"\g<1>{bar_w}\g<2>",
                    adv,
                )
            with open(OUT_ADV_SVG, "w", encoding="utf-8") as f:
                f.write(adv)
            print(f"Updated {OUT_ADV_SVG} (contribs={total_contribs}, streak={best_streak}, commits={commits})")

        # Live-sync most recently pushed public repository into developer-dashboard.svg
        if os.path.exists(OUT_DASH_SVG):
            pub_list = json.loads(
                http_get(f"https://api.github.com/users/{USERNAME}/repos?sort=pushed&per_page=10", token=token)
            )
            latest = next((r for r in pub_list if not r.get("fork") and r.get("name", "").lower() != USERNAME.lower()), None)
            if latest:
                rname = html_lib.escape(latest["name"][:34])
                rlang = html_lib.escape((latest.get("language") or "Full-Stack").upper())
                rpush = (latest.get("pushed_at") or "")[:10]
                rdesc = (latest.get("description") or f"Latest active quest · pushed {rpush}")[:48]
                rdesc = html_lib.escape(rdesc)
                with open(OUT_DASH_SVG, "r", encoding="utf-8") as f:
                    dash = f.read()
                dash = re.sub(
                    r'(<text x="424" y="92" class="cinzel" font-size="11.5" fill="#9CC084" letter-spacing="1">)[^<]+(</text>)',
                    rf"\g<1>LIVE LATEST QUEST · {rlang}\g<2>",
                    dash,
                    count=1,
                )
                dash = re.sub(
                    r'(<text x="424" y="114" class="title">)[^<]+(</text>)',
                    rf"\g<1>{rname}\g<2>",
                    dash,
                    count=1,
                )
                dash = re.sub(
                    r'(<text x="424" y="136" class="body" font-size="14.5">)[^<]+(</text>)',
                    rf"\g<1>{rdesc}\g<2>",
                    dash,
                    count=1,
                )
                with open(OUT_DASH_SVG, "w", encoding="utf-8") as f:
                    f.write(dash)
                print(f"Updated {OUT_DASH_SVG} (latest quest={latest['name']}, pushed={rpush})")
    except Exception as exc:
        print(f"[warn] Telemetry/Adventurer/Dashboard live update skipped: {exc}")


def sync_readme_alt(data: dict) -> bool:
    """Keep README.md LOC image alt text synced with the generated SVG."""
    if not os.path.exists(README_PATH):
        return False
    new_alt = (
        f'alt="Total Kode yang Sudah Saya Tulis — {fmt_id(data["total_lines"])} baris kode '
        f'({fmt_id(data["total_files"])} file · {data["total_repos"]} repo · {data["total_langs"]} bahasa)"'
    )
    with open(README_PATH, "r", encoding="utf-8") as f:
        text = f.read()
    updated, n = re.subn(r'alt="Total Kode yang Sudah Saya Tulis — [^"]*"', new_alt, text, count=1)
    if n and updated != text:
        with open(README_PATH, "w", encoding="utf-8") as f:
            f.write(updated)
        return True
    return False


def install_post_commit_hooks(extra_repos: list[str] | None = None):
    """Install lightweight non-blocking post-commit hooks into owned repositories."""
    py_posix = sys.executable.replace("\\", "/")
    script_posix = os.path.abspath(__file__).replace("\\", "/")
    hook_body = (
        "#!/bin/sh\n"
        "# Auto-sync FitzzXYZ profile README Total Kode on every commit (ignores bot commits)\n"
        'MSG="$(git log -1 --pretty=%B 2>/dev/null)"\n'
        'case "$MSG" in\n'
        '  *"[skip ci]"*|"chore(auto):"*) exit 0 ;;\n'
        "esac\n"
        f'"{py_posix}" -c "import subprocess, sys; '
        f"flags = 0x08000008 if sys.platform == 'win32' else 0; "
        f"subprocess.Popen([sys.executable, '{script_posix}', '--auto-push'], "
        f'creationflags=flags, close_fds=True, start_new_session=(sys.platform != \'win32\'))" '
        ">/dev/null 2>&1\n"
    )
    targets = discover_local_owned_repos() + [os.path.normpath(os.path.abspath(p)) for p in (extra_repos or [])]
    for repo in dict.fromkeys(targets):
        hooks_dir = os.path.join(repo, ".git", "hooks")
        if not os.path.isdir(hooks_dir):
            continue
        hook_path = os.path.join(hooks_dir, "post-commit")
        with open(hook_path, "w", encoding="utf-8", newline="\n") as f:
            f.write(hook_body)
        try:
            os.chmod(hook_path, 0o755)
        except OSError:
            pass
        print(f"Installed post-commit hook -> {hook_path}")


def build_clock_svg() -> str:
    """Build the animated Frieren x Ubel Celestial Astrolabe WIB Clock SVG (pure SMIL ticking)."""
    import math
    cinzel_600 = font_b64("cinzel-600.woff")
    cinzel_800 = font_b64("cinzel-800.woff")
    cormorant_500i = font_b64("cormorant-italic-500.woff")

    wib = timezone(timedelta(hours=7))
    now = datetime.now(wib)
    h, m, s = now.hour, now.minute, now.second

    sec_deg = s * 6.0
    min_deg = m * 6.0 + s * 0.1
    hour_deg = (h % 12) * 30.0 + m * 0.5 + s * (0.5 / 60.0)

    if 5 <= h < 11:
        phase, phase_col = "Dawn Expedition Watch", "#9CC084"
    elif 11 <= h < 15:
        phase, phase_col = "High Sun Meridian", "#E5C068"
    elif 15 <= h < 19:
        phase, phase_col = "Aureole Dusk Horizon", "#D4A843"
    else:
        phase, phase_col = "Nocturnal Grimoire Study", "#B399EE"

    ticks = []
    for i in range(12):
        a = math.radians(i * 30 - 90)
        r1 = 35 if i % 3 == 0 else 38
        r2 = 43
        x1, y1 = 84 + math.cos(a) * r1, 70 + math.sin(a) * r1
        x2, y2 = 84 + math.cos(a) * r2, 70 + math.sin(a) * r2
        col = "#E5C068" if i % 3 == 0 else "#8BA872"
        sw = "1.8" if i % 3 == 0 else "1.1"
        ticks.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{col}" stroke-width="{sw}" stroke-linecap="round"/>')

    tens_svg = "".join(
        f'<text x="290" y="88" class="clock-sec" fill="#9CC084" opacity="0">{d}'
        f'<animate attributeName="opacity" values="{";".join("1" if k == d else "0" for k in range(6))}" '
        f'keyTimes="0;0.1667;0.3333;0.5;0.6667;0.8333" calcMode="discrete" dur="60s" begin="-{s}s" repeatCount="indefinite"/></text>'
        for d in range(6)
    )
    ones_svg = "".join(
        f'<text x="311" y="88" class="clock-sec" fill="#9CC084" opacity="0">{d}'
        f'<animate attributeName="opacity" values="{";".join("1" if k == d else "0" for k in range(10))}" '
        f'keyTimes="0;0.1;0.2;0.3;0.4;0.5;0.6;0.7;0.8;0.9" calcMode="discrete" dur="10s" begin="-{s % 10}s" repeatCount="indefinite"/></text>'
        for d in range(10)
    )

    day_pct = (h * 3600 + m * 60 + s) / 86400.0
    sun_x = 820 + day_pct * 310
    sun_y = 94 - math.sin(day_pct * math.pi) * 34
    date_str = now.strftime("%A, %d %B %Y")

    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 140" width="100%" height="100%">
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
      @font-face {{
        font-family: 'Cinzel';
        font-style: normal;
        font-weight: 600;
        src: url("data:font/woff;base64,{cinzel_600}") format("woff");
      }}
      @font-face {{
        font-family: 'Cinzel';
        font-style: normal;
        font-weight: 800;
        src: url("data:font/woff;base64,{cinzel_800}") format("woff");
      }}
      @font-face {{
        font-family: 'CormorantItalic';
        font-style: italic;
        font-weight: 500;
        src: url("data:font/woff;base64,{cormorant_500i}") format("woff");
      }}
      .cinzel {{ font-family: 'Cinzel', Georgia, serif; font-weight: 600; }}
      .folio {{ font-family: 'CormorantItalic', Georgia, serif; font-style: italic; }}
      .clock-main {{ font-family: 'Cinzel', Georgia, serif; font-size: 40px; font-weight: 800; letter-spacing: 2px; }}
      .clock-sec {{ font-family: 'Cinzel', Georgia, serif; font-size: 30px; font-weight: 800; }}
    </style>
  </defs>

  <rect x="0.5" y="0.5" width="1199" height="139" rx="15.5" fill="url(#clk_bg)" stroke="url(#clk_border)" stroke-width="1.2"/>
  <rect x="6.5" y="6.5" width="1187" height="127" rx="11" fill="none" stroke="#D4A843" stroke-width="0.7" stroke-opacity="0.28"/>
  <polygon points="16,12 20,16 16,20 12,16" fill="#D4A843" fill-opacity="0.65"/>
  <polygon points="1184,12 1188,16 1184,20 1180,16" fill="#D4A843" fill-opacity="0.65"/>
  <polygon points="16,128 20,124 16,120 12,124" fill="#D4A843" fill-opacity="0.65"/>
  <polygon points="1184,128 1188,124 1184,120 1180,124" fill="#D4A843" fill-opacity="0.65"/>

  <g clip-path="url(#clk_clip)">
    <circle cx="84" cy="70" r="51" fill="none" stroke="#D4A843" stroke-opacity="0.28" stroke-width="1" stroke-dasharray="4 5">
      <animateTransform attributeName="transform" type="rotate" from="0 84 70" to="360 84 70" dur="60s" repeatCount="indefinite"/>
    </circle>
    <circle cx="84" cy="70" r="45" fill="#0B0F0D" stroke="#D4A843" stroke-opacity="0.6" stroke-width="1.2"/>
    {"".join(ticks)}
    <line x1="84" y1="70" x2="84" y2="46" stroke="#F4EFE6" stroke-width="2.6" stroke-linecap="round">
      <animateTransform attributeName="transform" type="rotate" from="{hour_deg:.2f} 84 70" to="{hour_deg + 360:.2f} 84 70" dur="43200s" repeatCount="indefinite"/>
    </line>
    <line x1="84" y1="70" x2="84" y2="36" stroke="#9CC084" stroke-width="2" stroke-linecap="round">
      <animateTransform attributeName="transform" type="rotate" from="{min_deg:.2f} 84 70" to="{min_deg + 360:.2f} 84 70" dur="3600s" repeatCount="indefinite"/>
    </line>
    <line x1="84" y1="78" x2="84" y2="32" stroke="#E5C068" stroke-width="1.2" stroke-linecap="round">
      <animateTransform attributeName="transform" type="rotate" from="{sec_deg:.2f} 84 70" to="{sec_deg + 360:.2f} 84 70" dur="60s" repeatCount="indefinite"/>
    </line>
    <circle cx="84" cy="70" r="3.4" fill="#E5C068"/>

    <text x="166" y="42" class="cinzel" font-size="12" fill="#E5C068" letter-spacing="1.6">ASTRAL HOROLOGIUM  ·  ASIA / JAKARTA</text>
    <text x="166" y="88" class="clock-main" fill="#F4EFE6">{h:02d}<tspan fill="#E5C068"><animate attributeName="opacity" values="1;0.25;1" dur="1s" repeatCount="indefinite"/>:</tspan>{m:02d}<tspan font-size="30" fill="#8E887A">:</tspan></text>
    {tens_svg}
    {ones_svg}
    <text x="344" y="86" class="cinzel" font-size="13.5" fill="#D4A843" letter-spacing="1.2">WIB · UTC+7</text>
    <text x="166" y="114" class="folio" font-size="16" fill="#C8C2B4">{date_str}  ·  <tspan fill="{phase_col}">{phase}</tspan></text>

    <line x1="504" y1="24" x2="504" y2="116" stroke="#D4A843" stroke-opacity="0.25" stroke-width="1"/>

    <!-- Center-Right: Imperial Era & First-Class Registry -->
    <text x="530" y="42" class="cinzel" font-size="11.5" fill="#B399EE" letter-spacing="1.4">IMPERIAL ERA REGISTRY</text>
    <text x="530" y="76" class="cinzel" font-size="19" fill="#F4EFE6">29 Years Post-Himmel</text>
    <text x="530" y="106" class="folio" font-size="15.5" fill="#C8C2B4">Äußerst · <tspan fill="#9CC084">First-Class Mage</tspan> · Aureole</text>

    <line x1="786" y1="24" x2="786" y2="116" stroke="#D4A843" stroke-opacity="0.25" stroke-width="1"/>

    <circle cx="826" cy="36" r="4" fill="#9CC084">
      <animate attributeName="opacity" values="0.35;1;0.35" dur="2s" repeatCount="indefinite"/>
    </circle>
    <text x="838" y="40" class="cinzel" font-size="12" fill="#9CC084" letter-spacing="1.4">LIVE CELESTIAL MERIDIAN</text>
    <path d="M 820 94 Q 975 30 1130 94" fill="none" stroke="#D4A843" stroke-opacity="0.32" stroke-width="1.4" stroke-dasharray="4 4"/>
    <line x1="820" y1="94" x2="1130" y2="94" stroke="#D4A843" stroke-opacity="0.2" stroke-width="1"/>
    <circle cx="{sun_x:.1f}" cy="{sun_y:.1f}" r="9" fill="{phase_col}" fill-opacity="0.24">
      <animate attributeName="r" values="6;13;6" dur="3.4s" repeatCount="indefinite"/>
      <animate attributeName="fill-opacity" values="0.35;0.05;0.35" dur="3.4s" repeatCount="indefinite"/>
    </circle>
    <circle cx="{sun_x:.1f}" cy="{sun_y:.1f}" r="4.5" fill="#F4EFE6" stroke="{phase_col}" stroke-width="1.5"/>
    <text x="820" y="113" class="folio" font-size="12.5" fill="#8E887A">00:00</text>
    <text x="975" y="113" text-anchor="middle" class="folio" font-size="12.5" fill="#E5C068">12:00</text>
    <text x="1130" y="113" text-anchor="end" class="folio" font-size="12.5" fill="#8E887A">23:59</text>
  </g>
</svg>'''


def auto_commit_and_push(include_readme: bool):
    """Stage only auto-generated profile assets, commit with [skip ci], and push (rebasing if bot pushed earlier)."""
    files = [
        "assets/frieren-total-loc.svg",
        "assets/mana-contribution-grid.svg",
        "assets/frieren-telemetry-ledger.svg",
        "assets/frieren-activity-graph.svg",
        "assets/frieren-adventurer-card.svg",
        "assets/developer-dashboard.svg",
        "assets/frieren-clock.svg",
    ]
    if include_readme:
        files.append("README.md")
    subprocess.run(["git", "-C", REPO_ROOT, "add", "--", *files], check=False)
    diff = subprocess.run(["git", "-C", REPO_ROOT, "diff", "--cached", "--quiet"], check=False)
    if diff.returncode == 0:
        return
    res = subprocess.run(
        ["git", "-C", REPO_ROOT, "commit", "-m", "chore(auto): update Total Kode & live stats [skip ci]"],
        check=False,
    )
    if res.returncode != 0:
        return
    push = subprocess.run(["git", "-C", REPO_ROOT, "push", "origin", "main"], check=False)
    if push.returncode != 0:
        # Handle race where GitHub Actions pushed scheduled stats to origin/main
        subprocess.run(
            ["git", "-C", REPO_ROOT, "pull", "--rebase", "--autostash", "-X", "theirs", "origin", "main"],
            check=False,
        )
        subprocess.run(["git", "-C", REPO_ROOT, "push", "origin", "main"], check=False)


def run_update(auto_push: bool = False):
    lock_path = os.path.join(tempfile.gettempdir(), "fitzzxyz_loc_sync.lock")
    if auto_push:
        # Avoid concurrent syncs or colliding with parent git index.lock right after commit
        if os.path.exists(lock_path) and (time.time() - os.path.getmtime(lock_path)) < 120:
            return
        with open(lock_path, "w", encoding="utf-8") as lf:
            lf.write(str(os.getpid()))
        time.sleep(1.5)
        # Sync with origin/main first so bot commits from GitHub Actions never block git push
        subprocess.run(
            ["git", "-C", REPO_ROOT, "pull", "--rebase", "--autostash", "origin", "main"],
            check=False,
        )

    try:
        readme_clean = True
        if auto_push:
            st = subprocess.run(
                ["git", "-C", REPO_ROOT, "status", "--porcelain", "--", "README.md"],
                capture_output=True, text=True, check=False,
            )
            readme_clean = not st.stdout.strip()

        live_gh = try_count_from_github()
        live_local = None if live_gh else try_count_local_repos()
        data = live_gh or live_local
        readme_changed = False

        if data:
            source = "github-live" if live_gh else "local-live"
            svg = build_loc_svg(data)
            os.makedirs(ASSETS_DIR, exist_ok=True)
            with open(OUT_LOC_SVG, "w", encoding="utf-8") as f:
                f.write(svg)
            print(f"Generated {OUT_LOC_SVG} ({os.path.getsize(OUT_LOC_SVG)/1024:.1f} KB, source={source}, lines={data['total_lines']}, repos={data['total_repos']})")
            if readme_clean:
                readme_changed = sync_readme_alt(data)
        elif not os.path.exists(OUT_LOC_SVG):
            svg = build_loc_svg(BASELINE)
            os.makedirs(ASSETS_DIR, exist_ok=True)
            with open(OUT_LOC_SVG, "w", encoding="utf-8") as f:
                f.write(svg)
            print(f"Generated {OUT_LOC_SVG} (source=baseline)")
        else:
            # In CI without LOC_TOKEN, keep the latest pushed LOC counts and only refresh the date
            wib = timezone(timedelta(hours=7))
            updated_str = datetime.now(wib).strftime("Diperbarui %d-%m-%Y")
            with open(OUT_LOC_SVG, "r", encoding="utf-8") as f:
                cur_svg = f.read()
            new_svg = re.sub(r"Diperbarui \d{2}-\d{2}-\d{4}", updated_str, cur_svg)
            if new_svg != cur_svg:
                with open(OUT_LOC_SVG, "w", encoding="utf-8") as f:
                    f.write(new_svg)
            print(f"Preserved existing LOC counts in {OUT_LOC_SVG} (refreshed date -> {updated_str})")

        with open(OUT_CLOCK_SVG, "w", encoding="utf-8") as f:
            f.write(build_clock_svg())
        print(f"Generated {OUT_CLOCK_SVG} ({os.path.getsize(OUT_CLOCK_SVG)/1024:.1f} KB)")

        update_live_github_widgets(data)
        if auto_push:
            auto_commit_and_push(include_readme=readme_changed)
    finally:
        if auto_push and os.path.exists(lock_path):
            try:
                os.remove(lock_path)
            except OSError:
                pass


def main():
    args = sys.argv[1:]
    if "--install-hooks" in args:
        idx = args.index("--install-hooks")
        install_post_commit_hooks(args[idx + 1:])
        return
    run_update(auto_push="--auto-push" in args)


if __name__ == "__main__":
    main()
