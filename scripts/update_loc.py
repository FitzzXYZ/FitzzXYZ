"""Daily auto-updater for FitzzXYZ GitHub Profile SVGs:
1. assets/frieren-total-loc.svg      — Total Lines of Code across all owned non-fork repos (private + public with LOC_TOKEN/GH_TOKEN)
2. assets/mana-contribution-grid.svg — Live 52-week GitHub contribution calendar
3. assets/frieren-telemetry-ledger.svg — Live GitHub contributions, followers, following & repo count
"""
import base64
from datetime import datetime, timezone, timedelta
import json
import os
import re
import subprocess
import tempfile
import urllib.request

USERNAME = os.environ.get("GITHUB_USERNAME", "FitzzXYZ")
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_DIR = os.path.join(REPO_ROOT, "assets")
FONTS_DIR = os.path.join(ASSETS_DIR, "fonts")
OUT_LOC_SVG = os.path.join(ASSETS_DIR, "frieren-total-loc.svg")
OUT_GRID_SVG = os.path.join(ASSETS_DIR, "mana-contribution-grid.svg")
OUT_LEDGER_SVG = os.path.join(ASSETS_DIR, "frieren-telemetry-ledger.svg")

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


def try_count_from_github() -> dict | None:
    """When LOC_TOKEN or GH_TOKEN (PAT with repo scope) is configured in CI, count across all owned non-fork repos."""
    token = (os.environ.get("LOC_TOKEN") or os.environ.get("GH_TOKEN") or "").strip()
    if not token:
        return None
    try:
        repos = []
        page = 1
        while True:
            raw = http_get(
                f"https://api.github.com/user/repos?per_page=100&affiliation=owner&page={page}",
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

        lang_lines = {}
        total_files = 0
        counted_repos = 0
        with tempfile.TemporaryDirectory() as tmp:
            for r in repos:
                clone_url = r["clone_url"].replace("https://", f"https://x-access-token:{token}@")
                dst = os.path.join(tmp, r["name"])
                res = subprocess.run(["git", "clone", "--depth", "1", clone_url, dst], check=False)
                if res.returncode != 0 or not os.path.exists(dst):
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
            "total_repos": counted_repos or len(repos),
            "total_langs": len(lang_lines),
            "languages": top10,
            "other_segments": [{"pct": rem_pct, "color": "#6B7280"}] if rem_pct >= 0.1 else [],
        }
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
      <circle cx="7" cy="7" r="2" fill="#E05D53"/>
      <circle cx="12" cy="7" r="2" fill="#E5C068"/>
      <circle cx="17" cy="7" r="2" fill="#9CC084"/>
      <circle cx="9" cy="12" r="2" fill="#4A90E2"/>
      <circle cx="15" cy="12" r="2" fill="#B399EE"/>
      <circle cx="7" cy="17" r="2" fill="#E5C068"/>
      <circle cx="13" cy="17" r="2" fill="#9CC084"/>
    </g>
    <text x="70" y="39" class="cinzel" font-size="18.5" fill="#F4EFE6" letter-spacing="0.8">TOTAL KODE YANG SUDAH SAYA TULIS</text>
    <text x="1164" y="39" text-anchor="end" class="folio" fill="#D4A843">FitzzXYZ Owned Repositories · Verified LOC</text>
    <line x1="36" y1="54" x2="1164" y2="54" stroke="#D4A843" stroke-opacity="0.28" stroke-width="1"/>

    <rect x="28" y="68" width="1144" height="362" rx="12" fill="url(#loc_card_bg)" stroke="#D4A843" stroke-opacity="0.24" stroke-width="1"/>
    <rect x="28" y="68" width="1144" height="362" rx="12" fill="url(#loc_glow)"/>

    <text x="56" y="102" class="cinzel" font-size="12.5" fill="#9CC084" letter-spacing="1.6">TOTAL KODE YANG SUDAH DITULIS</text>
    <text x="56" y="148" class="cinzel" font-size="42" font-weight="800" fill="#F4EFE6">{total_lines_str} <tspan class="folio" font-size="21" fill="#E5C068">baris kode</tspan></text>
    <text x="56" y="172" class="folio" font-size="15.5" fill="#C8C2B4">{meta_str}</text>

    <g clip-path="url(#loc_bar_clip)">
      {bar_svg}
    </g>

    <line x1="598" y1="224" x2="598" y2="392" stroke="#D4A843" stroke-opacity="0.22" stroke-width="1"/>
    {rows_svg}

    <text x="56" y="414" class="folio" font-size="13.5" fill="#8E887A">Dihitung dari semua repo milik sendiri (termasuk private, tanpa fork), kode aktual tanpa baris kosong &amp; komentar.</text>
    <text x="1144" y="414" text-anchor="end" class="folio" font-size="13.5" fill="#D4A843">{updated_str}</text>
  </g>
</svg>'''


def update_live_github_widgets():
    """Update mana-contribution-grid.svg and frieren-telemetry-ledger.svg directly from GitHub."""
    token = (os.environ.get("LOC_TOKEN") or os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN") or "").strip()
    total_contribs = None
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
            rects = "".join(
                f'<rect x="{58 + int(c) * 21}" y="{72 + int(r) * 21}" width="15" height="15" rx="3" fill="{level_colors.get(int(lvl), "#171D19")}"/>'
                for _, r, c, lvl in cells
            )
            with open(OUT_GRID_SVG, "r", encoding="utf-8") as f:
                grid_svg = f.read()
            grid_svg = re.sub(r"<g>(<rect [^>]+/>)+</g>", f"<g>{rects}</g>", grid_svg, count=1)
            if total_contribs is not None:
                grid_svg = re.sub(
                    r"\d+\s+inscriptions recorded in the current cycle",
                    f"{total_contribs} inscriptions recorded in the current cycle",
                    grid_svg,
                )
            with open(OUT_GRID_SVG, "w", encoding="utf-8") as f:
                f.write(grid_svg)
            print(f"Updated {OUT_GRID_SVG} ({total_contribs} contributions, {len(cells)} cells)")
    except Exception as exc:
        print(f"[warn] Contribution grid live update skipped: {exc}")

    try:
        profile = json.loads(http_get(f"https://api.github.com/users/{USERNAME}", token=token))
        followers = profile.get("followers")
        following = profile.get("following")
        pub_repos = profile.get("public_repos")
        if os.path.exists(OUT_LEDGER_SVG):
            with open(OUT_LEDGER_SVG, "r", encoding="utf-8") as f:
                ledger = f.read()
            if total_contribs is not None:
                ledger = re.sub(
                    r'(<text x="36" y="86" class="cinzel-bold" font-size="34" fill="#F4EFE6">)\d+(</text>)',
                    rf"\g<1>{total_contribs}\g<2>",
                    ledger,
                )
            if pub_repos is not None:
                ledger = re.sub(r"\d+\s+public repos", f"{pub_repos} public repos", ledger)
            if followers is not None and following is not None:
                ledger = re.sub(
                    r'(<text x="936" y="86" class="cinzel-bold" font-size="34" fill="#F4EFE6">)\d+(</text>)',
                    rf"\g<1>{followers}\g<2>",
                    ledger,
                )
                ledger = re.sub(r"followers · \d+ following", f"followers · {following} following", ledger)
            with open(OUT_LEDGER_SVG, "w", encoding="utf-8") as f:
                f.write(ledger)
            print(f"Updated {OUT_LEDGER_SVG} (contribs={total_contribs}, followers={followers}, repos={pub_repos})")
    except Exception as exc:
        print(f"[warn] Telemetry ledger live update skipped: {exc}")


def main():
    live = try_count_from_github()
    data = live if live else BASELINE
    svg = build_loc_svg(data)
    os.makedirs(ASSETS_DIR, exist_ok=True)
    with open(OUT_LOC_SVG, "w", encoding="utf-8") as f:
        f.write(svg)
    print(f"Generated {OUT_LOC_SVG} ({os.path.getsize(OUT_LOC_SVG)/1024:.1f} KB, source={'github-live' if live else 'baseline'})")
    update_live_github_widgets()


if __name__ == "__main__":
    main()
