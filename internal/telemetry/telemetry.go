package telemetry

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
	storageBadge := "UPSTASH REDIS · LIVE"
	storageCol := "#9CC084"
	if rep.Storage != "upstash" {
		storageBadge = "STANDBY · MEMORY FALLBACK"
		storageCol = "#E5C068"
	}

	grimBarW := int(math.Round(clampPct(s.GrimoiresFound, maxInt(1, rep.Appraisals)) * 232))
	bossBarW := int(math.Round(clampPct(s.BossHP, maxInt(1, s.BossMaxHP)) * 232))

	statusNote := fmt.Sprintf("Boss Integrity %d/%d HP · Sever +%d", s.BossHP, s.BossMaxHP, s.SlashBonus)
	if s.EndingReached {
		statusNote = fmt.Sprintf("First-Class Privilege Granted · NG+ Sever +%d", s.SlashBonus)
	} else if s.FrierenTrapped {
		statusNote = "Alert: Frieren trapped in a Mimic coffer!"
	}

	chamberEsc := html.EscapeString(rep.ActiveChamber)
	relicEsc := html.EscapeString(truncate(s.ActiveRelic, 30))
	statusEsc := html.EscapeString(truncate(statusNote, 42))

	return fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 176" width="100%%" height="100%%">
  <defs>
    <linearGradient id="go_bg" x1="0%%" y1="0%%" x2="100%%" y2="100%%">
      <stop offset="0%%" stop-color="#0E1310"/>
      <stop offset="50%%" stop-color="#131815"/>
      <stop offset="100%%" stop-color="#16131E"/>
    </linearGradient>
    <linearGradient id="go_border" x1="0%%" y1="0%%" x2="100%%" y2="0%%">
      <stop offset="0%%" stop-color="#7DA8E6" stop-opacity="0.62"/>
      <stop offset="50%%" stop-color="#D4A843" stop-opacity="0.65"/>
      <stop offset="100%%" stop-color="#9CC084" stop-opacity="0.62"/>
    </linearGradient>
    <clipPath id="go_clip"><rect x="0" y="0" width="1200" height="176" rx="16"/></clipPath>
    <style>
      .t-h { font-family: 'Cinzel', Georgia, serif; font-weight: 700; letter-spacing: 1.4px; }
      .t-num { font-family: 'Cinzel', Georgia, serif; font-weight: 800; font-variant-numeric: tabular-nums; }
      .t-body { font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 600; }
      .t-it { font-family: 'Cormorant Garamond', Georgia, serif; font-style: italic; font-weight: 500; }
      .t-mono { font-family: ui-monospace, 'JetBrains Mono', monospace; font-weight: 600; }
    </style>
  </defs>

  <rect x="0.5" y="0.5" width="1199" height="175" rx="15.5" fill="url(#go_bg)" stroke="url(#go_border)" stroke-width="1.2"/>
  <rect x="6.5" y="6.5" width="1187" height="163" rx="11" fill="none" stroke="#D4A843" stroke-width="0.7" stroke-opacity="0.28"/>
  <polygon points="16,12 20,16 16,20 12,16" fill="#D4A843" fill-opacity="0.65"/>
  <polygon points="1184,12 1188,16 1184,20 1180,16" fill="#D4A843" fill-opacity="0.65"/>
  <polygon points="16,164 20,160 16,156 12,160" fill="#D4A843" fill-opacity="0.65"/>
  <polygon points="1184,164 1188,160 1184,156 1180,160" fill="#D4A843" fill-opacity="0.65"/>

  <g clip-path="url(#go_clip)">
    <circle cx="34" cy="34" r="3.6" fill="#7DA8E6">
      <animate attributeName="opacity" values="0.4;1;0.4" dur="2.4s" repeatCount="indefinite"/>
    </circle>
    <text x="48" y="38" class="t-h" font-size="11.5" fill="#E5C068">GLOBAL DUNGEON TELEMETRY  ·  GO SERVERLESS LEDGER</text>
    <text x="1164" y="38" text-anchor="end" class="t-mono" font-size="10.5" fill="%s">%s</text>
    <line x1="30" y1="50" x2="1170" y2="50" stroke="#D4A843" stroke-opacity="0.24" stroke-width="1"/>

    <!-- Col 1: Chambers Cleared -->
    <text x="34" y="74" class="t-h" font-size="10" fill="#9CC084">CHAMBERS CLEARED</text>
    <text x="34" y="114" class="t-num" font-size="34" fill="#F4EFE6">%d</text>
    <text x="118" y="109" class="t-it" font-size="14" fill="#8E887A">Spiegel victories</text>
    <text x="34" y="142" class="t-body" font-size="14" fill="#C8C2B4">Active: <tspan fill="#E5C068">%s</tspan></text>

    <line x1="294" y1="64" x2="294" y2="152" stroke="#D4A843" stroke-opacity="0.22" stroke-width="1"/>

    <!-- Col 2: Reliquary Audit -->
    <text x="318" y="74" class="t-h" font-size="10" fill="#E5C068">RELIQUARY APPRAISAL ODDS</text>
    <text x="318" y="104" class="t-num" font-size="22" fill="#9CC084">%.1f%% <tspan class="t-body" font-size="13.5" fill="#C8C2B4">Grimoires (%d)</tspan></text>
    <rect x="318" y="116" width="232" height="7" rx="3.5" fill="#1D1A18"/>
    <rect x="318" y="116" width="%d" height="7" rx="3.5" fill="#9CC084"/>
    <text x="318" y="144" class="t-it" font-size="13.5" fill="#D4886A">%.1f%% Mimics (%d traps) · Frieren claims 99%%</text>

    <line x1="584" y1="64" x2="584" y2="152" stroke="#D4A843" stroke-opacity="0.22" stroke-width="1"/>

    <!-- Col 3: Turns & Rescues -->
    <text x="608" y="74" class="t-h" font-size="10" fill="#B399EE">SHARED ARENA CHRONICLE</text>
    <text x="608" y="114" class="t-num" font-size="32" fill="#F4EFE6">%d</text>
    <text x="698" y="109" class="t-body" font-size="14.5" fill="#C8C2B4">total turns cast</text>
    <text x="608" y="144" class="t-body" font-size="14" fill="#C8C2B4">Frieren rescues: <tspan fill="#9CC084">%d</tspan> · Relic: <tspan fill="#E5C068">%s</tspan></text>

    <line x1="904" y1="64" x2="904" y2="152" stroke="#D4A843" stroke-opacity="0.22" stroke-width="1"/>

    <!-- Col 4: Boss & Runtime Seal -->
    <text x="928" y="74" class="t-h" font-size="10" fill="#7DA8E6">SPIEGEL INTEGRITY</text>
    <text x="928" y="104" class="t-num" font-size="22" fill="#F4EFE6">%d / %d <tspan class="t-body" font-size="13" fill="#8E887A">HP</tspan></text>
    <rect x="928" y="116" width="232" height="7" rx="3.5" fill="#1D1A18"/>
    <rect x="928" y="116" width="%d" height="7" rx="3.5" fill="#D4886A"/>
    <text x="928" y="144" class="t-it" font-size="13" fill="#C8C2B4">%s</text>
  </g>
</svg>`,
		storageCol, storageBadge,
		s.Wins, chamberEsc,
		rep.GrimoireRate, s.GrimoiresFound, grimBarW, rep.MimicRate, s.MimicsTriggered,
		s.Turn, s.RescuesCount, relicEsc,
		s.BossHP, s.BossMaxHP, bossBarW, statusEsc,
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

func Handle(w http.ResponseWriter, r *http.Request) {
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
