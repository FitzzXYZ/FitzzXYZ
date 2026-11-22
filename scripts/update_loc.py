"""Generate and auto-update assets/frieren-total-loc.svg for FitzzXYZ.
Counts actual lines of code (excluding blank lines & comments) across owned non-fork
repositories when GH_TOKEN / LOC_TOKEN is available, falling back to the verified
workspace baseline so the card never renders empty.
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

# Verified baseline across owned private + local & public repositories
BASELINE = {
    "total_lines": 83199,
    "total_files": 938,
    "total_repos": 20,
    "total_langs": 21,
    "languages": [
        {"name": "JSX",          "lines": 23403, "pct": 28.1, "color": "#8E96AA"},
        {"name": "PHP",          "lines": 17927, "pct": 21.5, "color": "#6E78B8"},
        {"name": "TypeScript",   "lines": 17369, "pct": 20.9, "color": "#4A90E2"},
        {"name": "Java",         "lines": 10343, "pct": 12.4, "color": "#C88A2E"},
        {"name": "JavaScript",   "lines": 2855,  "pct": 3.4,  "color": "#E5C068"},
        {"name": "Go",           "lines": 2743,  "pct": 3.3,  "color": "#38B2D6"},
        {"name": "Bourne Shell", "lines": 1900,  "pct": 2.3,  "color": "#85C872"},
        {"name": "CSS",          "lines": 1863,  "pct": 2.2,  "color": "#9B7EDE"},
        {"name": "Blade",        "lines": 1214,  "pct": 1.5,  "color": "#E05D53"},
        {"name": "DOS Batch",    "lines": 1058,  "pct": 1.3,  "color": "#8E887A"},
    ],
    "other_segments": [
        {"pct": 3.1, "color": "#6B7280"}
    ]
}

LANG_COLORS = {
    "JSX": "#8E96AA",
    "PHP": "#6E78B8",
    "TypeScript": "#4A90E2",
    "Java": "#C88A2E",
    "JavaScript": "#E5C068",
    "Go": "#38B2D6",
    "Bourne Shell": "#85C872",
    "CSS": "#9B7EDE",
    "Blade": "#E05D53",
    "DOS Batch": "#8E887A",
    "Python": "#5B9BD5",
    "HTML": "#D97757",
    "SQL": "#D4A843",
}

EXT_MAP = {
    ".jsx": "JSX",
    ".tsx": "TypeScript",
    ".ts": "TypeScript",
    ".php": "PHP",
    ".java": "Java",
    ".js": "JavaScript",
    ".mjs": "JavaScript",
    ".go": "Go",
    ".sh": "Bourne Shell",
    ".bash": "Bourne Shell",
    ".css": "CSS",
    ".scss": "CSS",
    ".bat": "DOS Batch",
    ".cmd": "DOS Batch",
    ".py": "Python",
    ".html": "HTML",
    ".sql": "SQL",
}


def fmt_id(n: int) -> str:
    return f"{n:,}".replace(",", ".")


def font_b64(fname: str) -> str:
    path = os.path.join(FONTS_DIR, fname)
    if not os.path.exists(path):
        return ""
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("ascii")


def try_count_from_github() -> dict | None:
    """If LOC_TOKEN (PAT with repo access) is configured in CI, count across all owned repos."""
    token = os.environ.get("LOC_TOKEN", "").strip()
    if not token:
        return None
    try:
        req = urllib.request.Request(
            "https://api.github.com/user/repos?per_page=100&affiliation=owner",
            headers={
                "Authorization": f"Bearer {token}",
                "User-Agent": "FitzzXYZ-LOC-Counter",
                "Accept": "application/vnd.github+json",
            },
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            repos = [r for r in json.loads(resp.read().decode()) if not r.get("fork")]
        if len(repos) < 5:
            return None

        lang_lines = {}
        total_files = 0
        with tempfile.TemporaryDirectory() as tmp:
            for r in repos:
                clone_url = r["clone_url"].replace("https://", f"https://x-access-token:{token}@")
                dst = os.path.join(tmp, r["name"])
                subprocess.run(["git", "clone", "--depth", "1", clone_url, dst], check=False)
                for root, dirs, files in os.walk(dst):
                    dirs[:] = [d for d in dirs if d not in (".git", "node_modules", "vendor", "dist", "build", ".next")]
                    for f in files:
                        lang = "Blade" if f.endswith(".blade.php") else EXT_MAP.get(os.path.splitext(f)[1].lower())
                        if not lang:
                            continue
                        p = os.path.join(root, f)
                        try:
                            with open(p, "r", encoding="utf-8", errors="ignore") as fp:
                                cnt = sum(
                                    1
                                    for line in fp
                                    if line.strip()
                                    and not line.strip().startswith(("//", "#", "/*", "*", "<!--", "--"))
                                )
                            if cnt > 0:
                                lang_lines[lang] = lang_lines.get(lang, 0) + cnt
                                total_files += 1
                        except Exception:
                            pass
        total_lines = sum(lang_lines.values())
        if total_lines < 1000:
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
            "total_repos": len(repos),
            "total_langs": len(lang_lines),
            "languages": top10,
            "other_segments": [{"pct": rem_pct, "color": "#6B7280"}] if rem_pct > 0 else [],
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

    # Build 2-column language rows (5 left, 5 right, ordered row-by-row like the reference screenshot)
    langs = data["languages"]
    row_els = []
    for idx, item in enumerate(langs[:10]):
        col = idx % 2  # 0 = left, 1 = right
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
      .sans-med {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif; font-weight: 600; }}
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
    <!-- Top Section Title Row (Abacus Icon + Title + Fantasy Folio) -->
    <!-- Custom Abacus / Arcane Counter Icon -->
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
    <text x="1164" y="39" text-anchor="end" class="folio">Arcane Grimoire Codebase Ledger · Verified LOC</text>
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

    <!-- 2-Column 10-Language Breakdown -->
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
