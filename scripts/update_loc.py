"""Generate and auto-update assets/frieren-total-loc.svg for FitzzXYZ.
Counts actual lines of code (excluding blank lines & comments) across all owned
non-fork repositories (including private repos) when LOC_TOKEN is configured in
GitHub Actions, falling back to the verified FitzzXYZ owned-repo snapshot.
"""
import base64
from datetime import datetime, timezone, timedelta
import json
import os
import subprocess
import tempfile
import urllib.request

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_DIR = os.path.join(REPO_ROOT, "assets")
FONTS_DIR = os.path.join(ASSETS_DIR, "fonts")
OUT_SVG = os.path.join(ASSETS_DIR, "frieren-total-loc.svg")

# Verified snapshot of FitzzXYZ's own repositories:
# FitzzXYZ, Lomba-UI-UX, RPL-Web, Portofolio, WEB-Gondrong-Rental (excluding blank lines & comments)
BASELINE = {
    "total_lines": 26303,
    "total_files": 151,
    "total_repos": 5,
    "total_langs": 9,
    "languages": [
        {"name": "TypeScript", "lines": 14551, "pct": 55.3, "color": "#4A90E2"},
        {"name": "JSX",        "lines": 3692,  "pct": 14.0, "color": "#8E96AA"},
        {"name": "JavaScript", "lines": 3013,  "pct": 11.5, "color": "#E5C068"},
        {"name": "CSS",        "lines": 2074,  "pct": 7.9,  "color": "#9B7EDE"},
        {"name": "PHP",        "lines": 1678,  "pct": 6.4,  "color": "#6E78B8"},
        {"name": "HTML",       "lines": 417,   "pct": 1.6,  "color": "#D97757"},
        {"name": "SQL",        "lines": 372,   "pct": 1.4,  "color": "#D4A843"},
        {"name": "Python",     "lines": 296,   "pct": 1.1,  "color": "#5B9BD5"},
        {"name": "Blade",      "lines": 210,   "pct": 0.8,  "color": "#E05D53"},
    ],
    "other_segments": [],
}

LANG_COLORS = {
    "TypeScript": "#4A90E2",
    "JSX": "#8E96AA",
    "JavaScript": "#E5C068",
    "CSS": "#9B7EDE",
    "SCSS": "#C084FC",
    "PHP": "#6E78B8",
    "HTML": "#D97757",
    "SQL": "#D4A843",
    "Python": "#5B9BD5",
    "Blade": "#E05D53",
    "Java": "#C88A2E",
    "Go": "#38B2D6",
    "Bourne Shell": "#85C872",
    "DOS Batch": "#8E887A",
    "PowerShell": "#60A5FA",
    "Vue": "#42B883",
    "Svelte": "#FF3E00",
    "Rust": "#DEA584",
}

EXT_MAP = {
    ".tsx": "TypeScript",
    ".ts": "TypeScript",
    ".jsx": "JSX",
    ".js": "JavaScript",
    ".mjs": "JavaScript",
    ".cjs": "JavaScript",
    ".php": "PHP",
    ".java": "Java",
    ".py": "Python",
    ".html": "HTML",
    ".htm": "HTML",
    ".css": "CSS",
    ".scss": "SCSS",
    ".sql": "SQL",
    ".sh": "Bourne Shell",
    ".bash": "Bourne Shell",
    ".bat": "DOS Batch",
    ".cmd": "DOS Batch",
    ".ps1": "PowerShell",
    ".go": "Go",
    ".rs": "Rust",
    ".vue": "Vue",
    ".svelte": "Svelte",
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
    """When LOC_TOKEN (PAT with repo scope) is configured in CI, count across all owned non-fork repos."""
    token = os.environ.get("LOC_TOKEN", "").strip()
    if not token:
        return None
    try:
        repos = []
        page = 1
        while True:
            req = urllib.request.Request(
                f"https://api.github.com/user/repos?per_page=100&affiliation=owner&page={page}",
                headers={
                    "Authorization": f"Bearer {token}",
                    "User-Agent": "FitzzXYZ-LOC-Counter",
                    "Accept": "application/vnd.github+json",
                },
            )
            with urllib.request.urlopen(req, timeout=20) as resp:
                batch = json.loads(resp.read().decode())
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
    except Exception:
        return None


def build_svg(data: dict) -> str:
    cinzel_600 = font_b64("cinzel-600.woff")
    cinzel_800 = font_b64("cinzel-800.woff")
    cormorant_600 = font_b64("cormorant-600.woff")
    cormorant_500i = font_b64("cormorant-italic-500.woff")

    wib = timezone(timedelta(hours=7))
    updated_str = datetime.now(wib).strftime("Diperbarui %d-%m-%Y")

    # Build proportional horizontal bar segments (x=56 to x=1144, total width = 1088)
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

    # Build 2-column language rows (up to 10 languages: 5 left, up to 5 right)
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
      <stop offset="0%" stop-color="#131722"/>
      <stop offset="50%" stop-color="#19182C"/>
      <stop offset="100%" stop-color="#1F1B38"/>
    </linearGradient>
    <linearGradient id="loc_border" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#D4A843" stop-opacity="0.6"/>
      <stop offset="50%" stop-color="#8BA872" stop-opacity="0.65"/>
      <stop offset="100%" stop-color="#A78BFA" stop-opacity="0.6"/>
    </linearGradient>
    <radialGradient id="loc_glow" cx="80%" cy="20%" r="60%">
      <stop offset="0%" stop-color="#A78BFA" stop-opacity="0.16"/>
      <stop offset="55%" stop-color="#8BA872" stop-opacity="0.06"/>
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
      .cinzel {{ font-family: 'Cinzel', Georgia, serif; font-weight: 600; fill: #F4EFE6; }}
      .folio {{ font-family: 'CormorantItalic', Georgia, serif; font-style: italic; font-size: 14.5px; fill: #D4A843; }}
      .sans-bold {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif; font-weight: 700; }}
      .sans-reg {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif; font-weight: 400; }}
      .mono-stat {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif; font-variant-numeric: tabular-nums; }}
    </style>
  </defs>

  <!-- Outer Illuminated Grimoire Frame -->
  <rect x="0.5" y="0.5" width="1199" height="455" rx="15.5" fill="url(#loc_outer_bg)" stroke="url(#loc_border)" stroke-width="1.2"/>
  <rect x="6.5" y="6.5" width="1187" height="443" rx="11" fill="none" stroke="#D4A843" stroke-width="0.7" stroke-opacity="0.28"/>
  <polygon points="16,12 20,16 16,20 12,16" fill="#D4A843" fill-opacity="0.65"/>
  <polygon points="1184,12 1188,16 1184,20 1180,16" fill="#D4A843" fill-opacity="0.65"/>
  <polygon points="16,444 20,440 16,436 12,440" fill="#D4A843" fill-opacity="0.65"/>
  <polygon points="1184,444 1188,440 1184,436 1180,440" fill="#D4A843" fill-opacity="0.65"/>

  <g clip-path="url(#loc_clip)">
    <!-- Top Section Title Row -->
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
    <text x="70" y="39" class="sans-bold" font-size="20" fill="#F4EFE6">Total Kode yang Sudah Saya Tulis</text>
    <text x="1164" y="39" text-anchor="end" class="folio">FitzzXYZ Owned Repositories · Verified LOC</text>
    <line x1="36" y1="54" x2="1164" y2="54" stroke="#D4A843" stroke-opacity="0.28" stroke-width="1"/>

    <!-- Inner Nocturnal Sanctuary Card -->
    <rect x="28" y="68" width="1144" height="362" rx="14" fill="url(#loc_card_bg)" stroke="#A78BFA" stroke-opacity="0.28" stroke-width="1"/>
    <rect x="28" y="68" width="1144" height="362" rx="14" fill="url(#loc_glow)"/>

    <!-- Eyebrow Header -->
    <text x="56" y="102" class="sans-bold" font-size="13" fill="#4DE1D3" letter-spacing="1.8">TOTAL KODE YANG SUDAH DITULIS</text>

    <!-- Big Hero Number + "baris kode" -->
    <text x="56" y="148" class="sans-bold" font-size="44" fill="#FFFFFF">{total_lines_str} <tspan font-size="20" font-weight="600" fill="#C8C2B4">baris kode</tspan></text>

    <!-- Subtitle: files · repos · languages -->
    <text x="56" y="172" class="sans-reg" font-size="15" fill="#9CA3AF">{meta_str}</text>

    <!-- Multi-Segment Proportional Language Bar -->
    <g clip-path="url(#loc_bar_clip)">
      {bar_svg}
    </g>

    <!-- 2-Column Language Breakdown -->
    <line x1="598" y1="224" x2="598" y2="392" stroke="#D4A843" stroke-opacity="0.16" stroke-width="1"/>
    {rows_svg}

    <!-- Bottom Caption & Timestamp -->
    <text x="56" y="414" class="folio" font-size="13.5" fill="#8E887A">Dihitung dari semua repo milik sendiri (termasuk private, tanpa fork), kode aktual tanpa baris kosong &amp; komentar.</text>
    <text x="1144" y="414" text-anchor="end" class="sans-reg" font-size="13" fill="#8E96AA">{updated_str}</text>
  </g>
</svg>'''


def main():
    live = try_count_from_github()
    data = live if live else BASELINE
    svg = build_svg(data)
    os.makedirs(ASSETS_DIR, exist_ok=True)
    with open(OUT_SVG, "w", encoding="utf-8") as f:
        f.write(svg)
    print(f"Generated {OUT_SVG} ({os.path.getsize(OUT_SVG)/1024:.1f} KB)")


if __name__ == "__main__":
    main()
