package store_test

import (
	"testing"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/store"
)

func TestOrganizedStoreRoundTrip(t *testing.T) {
	dir := t.TempDir()
	s := store.NewOrganizedStore(dir)
	if err := s.Put(store.OrganizedRecord{
		Hash: "AA", Status: store.OrganizeStatusOK, LibraryRelPath: "Movies/X/X.mkv", TmdbID: 1,
	}); err != nil {
		t.Fatal(err)
	}
	got, ok, err := store.NewOrganizedStore(dir).Get("aa")
	if err != nil || !ok || got.Status != store.OrganizeStatusOK || got.TmdbID != 1 {
		t.Fatalf("%+v %v %v", got, ok, err)
	}
}

func TestOrganizedPutIfAbsentAndBaseline(t *testing.T) {
	dir := t.TempDir()
	s := store.NewOrganizedStore(dir)
	added, err := s.PutIfAbsent(store.OrganizedRecord{Hash: "h1", Status: store.OrganizeStatusDeferred})
	if err != nil || !added {
		t.Fatalf("%v %v", added, err)
	}
	added, err = s.PutIfAbsent(store.OrganizedRecord{Hash: "h1", Status: store.OrganizeStatusOK})
	if err != nil || added {
		t.Fatalf("overwrote: %v %v", added, err)
	}
	if err := s.MarkBaselined(); err != nil {
		t.Fatal(err)
	}
	ok, err := store.NewOrganizedStore(dir).Baselined()
	if err != nil || !ok {
		t.Fatalf("%v %v", ok, err)
	}
}
