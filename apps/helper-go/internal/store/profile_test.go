package store_test

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/store"
)

func TestProfileStoreAppliesOnlyExplicitMutationsAndPersistsSecrets(t *testing.T) {
	dir := t.TempDir()
	profile := store.NewProfileStore(dir)

	first, err := profile.Apply(0, "desktop", []store.ProfileMutation{
		{Operation: "set", Key: "ai.openai.apiKey", Value: "secret-key", Secret: true},
		{Operation: "set", Key: "ai.openai.model", Value: "gpt-5", Secret: false},
	})
	if err != nil {
		t.Fatal(err)
	}
	if first.Revision != 1 || len(first.Records) != 2 {
		t.Fatalf("%+v", first)
	}

	second, err := profile.Apply(1, "iphone", []store.ProfileMutation{
		{Operation: "set", Key: "discover.mteam.apiKey", Value: "mteam-key", Secret: true},
	})
	if err != nil {
		t.Fatal(err)
	}
	if second.Revision != 2 || len(second.Records) != 3 {
		t.Fatalf("%+v", second)
	}

	reloaded, err := store.NewProfileStore(dir).Load()
	if err != nil {
		t.Fatal(err)
	}
	if reloaded.Revision != 2 || len(reloaded.Records) != 3 {
		t.Fatalf("%+v", reloaded)
	}
	var mteam store.ProfileRecord
	for _, record := range reloaded.Records {
		if record.Key == "discover.mteam.apiKey" {
			mteam = record
		}
	}
	if mteam.Value != "mteam-key" || !mteam.Secret || mteam.UpdatedBy != "iphone" || mteam.UpdatedAt == "" {
		t.Fatalf("%+v", mteam)
	}

	info, err := os.Stat(filepath.Join(dir, "profile.json"))
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("mode=%o", info.Mode().Perm())
	}
}

func TestProfileStoreRejectsStaleRevisionWithoutOverwriting(t *testing.T) {
	profile := store.NewProfileStore(t.TempDir())
	current, err := profile.Apply(0, "desktop", []store.ProfileMutation{
		{Operation: "set", Key: "metadata.tmdb.apiKey", Value: "first", Secret: true},
	})
	if err != nil {
		t.Fatal(err)
	}

	conflict, err := profile.Apply(0, "iphone", []store.ProfileMutation{
		{Operation: "set", Key: "metadata.tmdb.apiKey", Value: "stale", Secret: true},
	})
	if !errors.Is(err, store.ErrProfileRevisionConflict) {
		t.Fatalf("err=%v", err)
	}
	if conflict.Revision != current.Revision || len(conflict.Records) != 1 || conflict.Records[0].Value != "first" {
		t.Fatalf("%+v", conflict)
	}
}
