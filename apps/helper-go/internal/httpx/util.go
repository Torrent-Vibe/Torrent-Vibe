package httpx

import (
	"crypto/subtle"
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"
)

const maxBody = 1 << 20

func writeJSON(w http.ResponseWriter, status int, body any) {
	raw, err := json.Marshal(body)
	if err != nil {
		http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("content-type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_, _ = w.Write(raw)
}

func readJSON(w http.ResponseWriter, r *http.Request) (map[string]any, bool) {
	limited := io.LimitReader(r.Body, maxBody+1)
	raw, err := io.ReadAll(limited)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return nil, false
	}
	if len(raw) > maxBody {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return nil, false
	}
	if len(bytesTrim(raw)) == 0 {
		return map[string]any{}, true
	}
	var body map[string]any
	if err := json.Unmarshal(raw, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return nil, false
	}
	return body, true
}

func bytesTrim(raw []byte) []byte {
	return []byte(strings.TrimSpace(string(raw)))
}

func bearerToken(r *http.Request) (string, bool) {
	header := r.Header.Get("authorization")
	if !strings.HasPrefix(header, "Bearer ") {
		return "", false
	}
	token := strings.TrimSpace(header[len("Bearer "):])
	if token == "" {
		return "", false
	}
	return token, true
}

func queryUint64(r *http.Request, key string) uint64 {
	v, err := strconv.ParseUint(r.URL.Query().Get(key), 10, 64)
	if err != nil {
		return 0
	}
	return v
}

func queryInt(r *http.Request, key string) int {
	v, err := strconv.Atoi(r.URL.Query().Get(key))
	if err != nil {
		return 0
	}
	return v
}

func safeEqual(left, right string) bool {
	a := []byte(left)
	b := []byte(right)
	if len(a) != len(b) {
		return false
	}
	return subtle.ConstantTimeCompare(a, b) == 1
}
