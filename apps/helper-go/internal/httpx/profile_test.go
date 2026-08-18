package httpx_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/store"
)

func TestProfileRequiresBearer(t *testing.T) {
	srv := start(t)
	defer srv.Close()

	res, err := http.Get(srv.URL + "/profile")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusUnauthorized {
		t.Fatal(res.Status)
	}
}

func TestProfilePatchReturnsSecretsToPairedClientsAndDetectsConflicts(t *testing.T) {
	srv := start(t)
	defer srv.Close()

	patch := func(revision uint64, value string) *http.Response {
		t.Helper()
		payload, err := json.Marshal(map[string]any{
			"revision": revision,
			"mutations": []store.ProfileMutation{{
				Operation: "set",
				Key:       "discover.mteam.apiKey",
				Value:     value,
				Secret:    true,
			}},
		})
		if err != nil {
			t.Fatal(err)
		}
		req, err := http.NewRequest(http.MethodPatch, srv.URL+"/profile", bytes.NewReader(payload))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("authorization", "Bearer "+token)
		req.Header.Set("content-type", "application/json")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		return res
	}

	res := patch(0, "mteam-secret")
	if res.StatusCode != http.StatusOK {
		t.Fatal(res.Status)
	}
	body := decode(t, res)
	if body["revision"] != float64(1) {
		t.Fatalf("%+v", body)
	}

	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/profile", nil)
	req.Header.Set("authorization", "Bearer "+token)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	body = decode(t, res)
	records, _ := body["records"].([]any)
	if len(records) != 1 {
		t.Fatalf("%+v", body)
	}
	record, _ := records[0].(map[string]any)
	if record["value"] != "mteam-secret" || record["secret"] != true || record["updatedBy"] != "legacy-desktop" {
		t.Fatalf("%+v", record)
	}

	res = patch(0, "stale-secret")
	if res.StatusCode != http.StatusConflict {
		t.Fatal(res.Status)
	}
	body = decode(t, res)
	if body["revision"] != float64(1) || body["error"] != "revision conflict" {
		t.Fatalf("%+v", body)
	}
}
