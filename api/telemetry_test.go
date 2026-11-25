package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestFetchSnapshotFallbackWhenNoEnv(t *testing.T) {
	snap, storage := FetchSnapshot(context.Background(), http.DefaultClient, "", "")
	if storage != "memory-fallback" {
		t.Fatalf("expected memory-fallback, got %s", storage)
	}
	if snap.Wins != 14 {
		t.Fatalf("expected default wins 14, got %d", snap.Wins)
	}
}

func TestFetchSnapshotFromMockUpstash(t *testing.T) {
	live := DefaultSnapshot()
	live.Wins = 42
	live.StageIdx = 3
	live.BossHP = 120
	live.BossMaxHP = 340
	live.ActiveRelic = "Flamme & <Serie> Folio"
	innerBytes, err := json.Marshal(live)
	if err != nil {
		t.Fatal(err)
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer test-secret" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		if r.URL.Path != "/get/"+ArenaRedisKey {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]string{"result": string(innerBytes)})
	}))
	defer srv.Close()

	snap, storage := FetchSnapshot(context.Background(), srv.Client(), srv.URL, "test-secret")
	if storage != "upstash" {
		t.Fatalf("expected upstash storage, got %s", storage)
	}
	if snap.Wins != 42 || snap.StageIdx != 3 {
		t.Fatalf("unexpected hydrated snapshot: %+v", snap)
	}

	rep := BuildReport(snap, storage)
	svg := RenderSVG(rep)
	if !strings.HasPrefix(svg, "<svg ") || !strings.HasSuffix(svg, "</svg>") {
		t.Fatal("rendered output is not a valid SVG root")
	}
	if strings.Contains(svg, "<Serie>") {
		t.Fatal("XML special characters in ActiveRelic were not escaped")
	}
	if !strings.Contains(svg, "UPSTASH REDIS") {
		t.Fatal("expected live Upstash badge in SVG")
	}
}

func TestHandlerJSONResponse(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/telemetry?format=json", nil)
	rec := httptest.NewRecorder()
	Handler(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if !strings.Contains(rec.Header().Get("Content-Type"), "application/json") {
		t.Fatalf("expected json content-type, got %s", rec.Header().Get("Content-Type"))
	}
	var out TelemetryReport
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("invalid JSON response: %v", err)
	}
	if out.Runtime != "go" {
		t.Fatalf("expected runtime=go, got %s", out.Runtime)
	}
}
