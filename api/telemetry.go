package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"math"
	"net/http"
	"os"
	"strings"
	"time"
)

const ArenaRedisKey = "fitzz:arena:v4"

type ArenaSnapshot struct {
	UbelHP          int    `json:"ubelHp"`
	UbelMaxHP       int    `json:"ubelMaxHp"`
	UbelMP          int    `json:"ubelMp"`
	UbelMaxMP       int    `json:"ubelMaxMp"`
	SlashBonus      int    `json:"slashBonus"`
	StageIdx        int    `json:"stageIdx"`
	BossHP          int    `json:"bossHp"`
	BossMaxHP       int    `json:"bossMaxHp"`
	EndingReached   bool   `json:"endingReached"`
	FrierenTrapped  bool   `json:"frierenTrapped"`
	ChapterTitle    string `json:"chapterTitle"`
	ActiveRelic     string `json:"activeRelic"`
	Wins            int    `json:"wins"`
	GrimoiresFound  int    `json:"grimoiresFound"`
	MimicsTriggered int    `json:"mimicsTriggered"`
	RescuesCount    int    `json:"rescuesCount"`
	Turn            int    `json:"turn"`
	UpdatedAt       string `json:"updatedAt"`
}

type TelemetryReport struct {
	Runtime       string        `json:"runtime"`
	Storage       string        `json:"storage"`
	ActiveChamber string        `json:"activeChamber"`
	Appraisals    int           `json:"appraisals"`
	GrimoireRate  float64       `json:"grimoireRate"`
	MimicRate     float64       `json:"mimicRate"`
	Snapshot      ArenaSnapshot `json:"snapshot"`
}

type upstashGetResponse struct {
	Result *string `json:"result"`
}

var chamberNames = [4]string{
	"I. Übel Replica",
	"II. Sense Replica",
	"III. Lernen Replica",
	"IV. Spiegel Frieren",
}

func DefaultSnapshot() ArenaSnapshot {
	return ArenaSnapshot{
		UbelHP:          100,
		UbelMaxHP:       100,
		UbelMP:          88,
		UbelMaxMP:       100,
		SlashBonus:      6,
		StageIdx:        0,
		BossHP:          108,
		BossMaxHP:       160,
		EndingReached:   false,
		FrierenTrapped:  false,
		ChapterTitle:    "Act I: The Mirror in the Torchlight",
		ActiveRelic:     "Blue Moon Blossom (+8 MP/turn)",
		Wins:            14,
		GrimoiresFound:  24,
		MimicsTriggered: 9,
		RescuesCount:    6,
		Turn:            12,
		UpdatedAt:       "",
	}
}

func resolveUpstashEnv() (string, string) {
	url := strings.TrimSpace(os.Getenv("UPSTASH_REDIS_REST_URL"))
	if url == "" {
		url = strings.TrimSpace(os.Getenv("KV_REST_API_URL"))
	}
	token := strings.TrimSpace(os.Getenv("UPSTASH_REDIS_REST_TOKEN"))
	if token == "" {
		token = strings.TrimSpace(os.Getenv("KV_REST_API_TOKEN"))
	}
	return strings.TrimRight(url, "/"), token
}

func FetchSnapshot(ctx context.Context, client *http.Client, baseURL, token string) (ArenaSnapshot, string) {
	snap := DefaultSnapshot()
	if baseURL == "" || token == "" {
		return snap, "memory-fallback"
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+"/get/"+ArenaRedisKey, nil)
	if err != nil {
		return snap, "memory-fallback"
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := client.Do(req)
	if err != nil {
		return snap, "memory-fallback"
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return snap, "memory-fallback"
	}

	raw, err := io.ReadAll(io.LimitReader(resp.Body, 1<<18))
	if err != nil {
		return snap, "memory-fallback"
	}

	var envelope upstashGetResponse
	if err := json.Unmarshal(raw, &envelope); err != nil || envelope.Result == nil || *envelope.Result == "" {
		return snap, "upstash-empty"
	}

	if err := json.Unmarshal([]byte(*envelope.Result), &snap); err != nil {
		return DefaultSnapshot(), "memory-fallback"
	}
	if snap.BossMaxHP <= 0 {
		snap.BossMaxHP = 160
	}
	if snap.UbelMaxHP <= 0 {
		snap.UbelMaxHP = 100
	}
	return snap, "upstash"
}

func BuildReport(snap ArenaSnapshot, storage string) TelemetryReport {
	appraisals := snap.GrimoiresFound + snap.MimicsTriggered
	grimoireRate := 0.0
	mimicRate := 0.0
	if appraisals > 0 {
		grimoireRate = math.Round((float64(snap.GrimoiresFound)/float64(appraisals))*1000) / 10
		mimicRate = math.Round((float64(snap.MimicsTriggered)/float64(appraisals))*1000) / 10
	}

	chamber := "V. Epilogue · Serie"
	if !snap.EndingReached {
		idx := snap.StageIdx
		if idx < 0 {
			idx = 0
		}
		chamber = chamberNames[idx%len(chamberNames)]
	}

	return TelemetryReport{
		Runtime:       "go",
		Storage:       storage,
		ActiveChamber: chamber,
		Appraisals:    appraisals,
		GrimoireRate:  grimoireRate,
		MimicRate:     mimicRate,
		Snapshot:      snap,
	}
}

func clampPct(val, maxVal int) float64 {
	if maxVal <= 0 {
		return 0
	}
	p := float64(val) / float64(maxVal)
	if p < 0 {
		return 0
	}
	if p > 1 {
		return 1
	}
	return p
}

func RenderSVG(rep TelemetryReport) string {
	s := rep.Snapshot
	storageBadge := "Upstash Redis (iad1)"
	storageCol := "#9CC084"
	if rep.Storage != "upstash" {
		storageBadge = "Memory Fallback"
		storageCol = "#E5C068"
	}

	const barMaxW = 684.0
	grimBarW := int(math.Round(clampPct(s.GrimoiresFound, maxInt(1, rep.Appraisals)) * barMaxW))
	mimicBarW := int(math.Round(clampPct(s.MimicsTriggered, maxInt(1, rep.Appraisals)) * barMaxW))
	bossBarW := int(math.Round(clampPct(s.BossHP, maxInt(1, s.BossMaxHP)) * barMaxW))

	statusNote := fmt.Sprintf("Sever +%d active", s.SlashBonus)
	if s.EndingReached {
		statusNote = fmt.Sprintf("First-Class Privilege granted (+%d Sever)", s.SlashBonus)
	} else if s.FrierenTrapped {
		statusNote = "Frieren trapped inside a Mimic coffer"
	}

	chamberEsc := html.EscapeString(rep.ActiveChamber)
	relicEsc := html.EscapeString(truncate(s.ActiveRelic, 29))
	statusEsc := html.EscapeString(truncate(statusNote, 42))

	return fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 184" width="100%%" height="100%%" role="img" aria-label="Global Dungeon Telemetry — Go Serverless Ledger">
  <defs>
    <linearGradient id="go_bg" x1="0%%" y1="0%%" x2="100%%" y2="100%%">
      <stop offset="0%%" stop-color="#091314"/>
      <stop offset="50%%" stop-color="#0F1C1C"/>
      <stop offset="100%%" stop-color="#171426"/>
    </linearGradient>
    <radialGradient id="go_orb1" cx="14%%" cy="18%%" r="46%%">
      <stop offset="0%%" stop-color="#45D496" stop-opacity="0.24"/>
      <stop offset="100%%" stop-color="#45D496" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="go_orb2" cx="88%%" cy="84%%" r="46%%">
      <stop offset="0%%" stop-color="#7DA8E6" stop-opacity="0.22"/>
      <stop offset="100%%" stop-color="#7DA8E6" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="go_frost" x1="0%%" y1="0%%" x2="100%%" y2="100%%">
      <stop offset="0%%" stop-color="#F0FAF5" stop-opacity="0.095"/>
      <stop offset="40%%" stop-color="#DDF2E8" stop-opacity="0.028"/>
      <stop offset="100%%" stop-color="#E5C068" stop-opacity="0.05"/>
    </linearGradient>
    <linearGradient id="go_rim" x1="0%%" y1="0%%" x2="100%%" y2="100%%">
      <stop offset="0%%" stop-color="#F2FBF6" stop-opacity="0.54"/>
      <stop offset="32%%" stop-color="#8DD4A8" stop-opacity="0.38"/>
      <stop offset="68%%" stop-color="#7DA8E6" stop-opacity="0.30"/>
      <stop offset="100%%" stop-color="#E5C068" stop-opacity="0.34"/>
    </linearGradient>
    <linearGradient id="go_glint" x1="0%%" y1="0%%" x2="100%%" y2="0%%">
      <stop offset="0%%" stop-color="#F2FBF6" stop-opacity="0"/>
      <stop offset="22%%" stop-color="#F2FBF6" stop-opacity="0.56"/>
      <stop offset="58%%" stop-color="#A8E8C2" stop-opacity="0.25"/>
      <stop offset="100%%" stop-color="#E5C068" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="go_clip"><rect x="0" y="0" width="1200" height="184" rx="14"/></clipPath>
    <style>
      .t-title { font-family: 'Cinzel', Georgia, serif; font-weight: 600; }
      .t-num { font-family: 'Cinzel', Georgia, serif; font-weight: 800; font-variant-numeric: tabular-nums; }
      .t-body { font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 600; }
      .t-it { font-family: 'Cormorant Garamond', Georgia, serif; font-style: italic; font-weight: 500; }
      .t-mono { font-family: ui-monospace, 'JetBrains Mono', monospace; font-weight: 600; font-variant-numeric: tabular-nums; }
    </style>
  </defs>

  <g clip-path="url(#go_clip)">
    <rect x="0" y="0" width="1200" height="184" fill="url(#go_bg)"/>
    <rect x="0" y="0" width="1200" height="184" fill="url(#go_orb1)"/>
    <rect x="0" y="0" width="1200" height="184" fill="url(#go_orb2)"/>
    <polygon points="0,0 260,0 144,184 0,184" fill="#76C99A" fill-opacity="0.06"/>
    <polygon points="940,0 1200,0 1200,184 1044,184" fill="#7DA8E6" fill-opacity="0.06"/>
    <line x1="260" y1="0" x2="144" y2="184" stroke="#EBF9F2" stroke-opacity="0.11" stroke-width="0.8"/>
    <rect x="0" y="0" width="1200" height="184" fill="url(#go_frost)"/>
    <line x1="18" y1="1.1" x2="760" y2="1.1" stroke="url(#go_glint)" stroke-width="1.4"/>
    <rect x="0" y="0" width="3.5" height="184" fill="#7DA8E6" fill-opacity="0.82"/>

    <!-- Editorial Header (Title Case, Arcane Crystal Glass Bevel) -->
    <text x="32" y="34" class="t-title" font-size="16" fill="#F4EFE6">Global Dungeon Ledger</text>
    <text x="242" y="34" class="t-it" font-size="14" fill="#9AA49E">Go Serverless runtime</text>
    <text x="1166" y="34" text-anchor="end" class="t-mono" font-size="11.5" fill="%s">%s</text>
    <line x1="32" y1="46" x2="1166" y2="46" stroke="#E6F5ED" stroke-opacity="0.18" stroke-width="1"/>

    <!-- Asymmetric Left Anchor (34%% width: Primary Victory Figure + Smoked Glass Well) -->
    <text x="32" y="72" class="t-body" font-size="13.5" fill="#9EE0B4">Chambers cleared across all visitors</text>
    <text x="32" y="118" class="t-num" font-size="44" fill="#F4EFE6">%d</text>
    <text x="130" y="108" class="t-it" font-size="15.5" fill="#F0CD78">%s</text>
    <text x="130" y="125" class="t-body" font-size="13" fill="#D2D8D4">Relic: %s</text>

    <rect x="32" y="138" width="388" height="28" rx="7" fill="#081414" fill-opacity="0.58" stroke="#E8F6EE" stroke-opacity="0.18" stroke-width="0.9"/>
    <text x="44" y="156" class="t-mono" font-size="11.5" fill="#D2D8D4">%d turns cast</text>
    <text x="408" y="156" text-anchor="end" class="t-mono" font-size="11.5" fill="#9EE0B4">%d Frieren rescues</text>

    <line x1="448" y1="60" x2="448" y2="166" stroke="#E6F5ED" stroke-opacity="0.16" stroke-width="1"/>

    <!-- Asymmetric Right Comparative Ledger (62%% width: 3 Horizontal Manuscript Rows) -->
    <text x="480" y="72" class="t-body" font-size="14" fill="#F4EFE6">Authentic grimoire discoveries</text>
    <text x="1164" y="72" text-anchor="end" class="t-mono" font-size="12" fill="#9EE0B4">%.1f%% (%d found)</text>
    <rect x="480" y="80" width="684" height="6" rx="3" fill="#0B1919" fill-opacity="0.72"/>
    <rect x="480" y="80" width="%d" height="6" rx="3" fill="#7EE8B2"/>

    <text x="480" y="112" class="t-body" font-size="14" fill="#F4EFE6">Mimic trap encounters <tspan class="t-it" font-size="13" fill="#9AA49E">(Frieren claims 99%% safe)</tspan></text>
    <text x="1164" y="112" text-anchor="end" class="t-mono" font-size="12" fill="#D4886A">%.1f%% (%d traps)</text>
    <rect x="480" y="120" width="684" height="6" rx="3" fill="#0B1919" fill-opacity="0.72"/>
    <rect x="480" y="120" width="%d" height="6" rx="3" fill="#D4886A"/>

    <text x="480" y="152" class="t-body" font-size="14" fill="#F4EFE6">Spiegel boss integrity <tspan class="t-it" font-size="13" fill="#D2D8D4">— %s</tspan></text>
    <text x="1164" y="152" text-anchor="end" class="t-mono" font-size="12" fill="#F0CD78">%d / %d HP</text>
    <rect x="480" y="160" width="684" height="6" rx="3" fill="#0B1919" fill-opacity="0.72"/>
    <rect x="480" y="160" width="%d" height="6" rx="3" fill="#F0CD78"/>
  </g>
  <rect x="0.6" y="0.6" width="1198.8" height="182.8" rx="13.4" fill="none" stroke="url(#go_rim)" stroke-width="1.2"/>
</svg>`,
		storageCol, storageBadge,
		s.Wins, chamberEsc, relicEsc,
		s.Turn, s.RescuesCount,
		rep.GrimoireRate, s.GrimoiresFound, grimBarW,
		rep.MimicRate, s.MimicsTriggered, mimicBarW,
		statusEsc, s.BossHP, s.BossMaxHP, bossBarW,
	)
}

func truncate(s string, maxLen int) string {
	runes := []rune(s)
	if len(runes) <= maxLen {
		return s
	}
	return string(runes[:maxLen-1]) + "…"
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func Handler(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2500*time.Millisecond)
	defer cancel()

	url, token := resolveUpstashEnv()
	client := &http.Client{Timeout: 2500 * time.Millisecond}
	snap, storage := FetchSnapshot(ctx, client, url, token)
	rep := BuildReport(snap, storage)

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0, s-maxage=0")
	w.Header().Set("CDN-Cache-Control", "no-store")
	w.Header().Set("Vercel-CDN-Cache-Control", "no-store")

	if r.URL.Query().Get("format") == "json" {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(rep)
		return
	}

	w.Header().Set("Content-Type", "image/svg+xml; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = io.WriteString(w, RenderSVG(rep))
}
