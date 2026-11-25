package handler

import (
	"net/http"

	"github.com/FitzzXYZ/FitzzXYZ/internal/telemetry"
)

func Handler(w http.ResponseWriter, r *http.Request) {
	telemetry.Handle(w, r)
}
