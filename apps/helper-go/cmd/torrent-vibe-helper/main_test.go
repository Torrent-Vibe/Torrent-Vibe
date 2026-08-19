package main

import (
	"sync"
	"testing"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/redact"
)

func TestSwapQbitPassSecretKeepsRegistryInSyncWithLivePassword(t *testing.T) {
	var mu sync.Mutex
	registry := redact.NewRegistry()
	last := "password-a"
	registry.Add(last)

	const rounds = 20000
	done := make(chan struct{})
	violation := make(chan string, 1)

	var watcher sync.WaitGroup
	watcher.Add(1)
	go func() {
		defer watcher.Done()
		for {
			select {
			case <-done:
				return
			default:
			}
			mu.Lock()
			live := last
			redacted := registry.Apply(live) == "***"
			mu.Unlock()
			if !redacted {
				select {
				case violation <- live:
				default:
				}
			}
		}
	}()

	var racers sync.WaitGroup
	racers.Add(2)
	go func() {
		defer racers.Done()
		for i := 0; i < rounds; i++ {
			swapQbitPassSecret(&mu, registry, &last, "password-b")
			swapQbitPassSecret(&mu, registry, &last, "password-a")
		}
	}()
	go func() {
		defer racers.Done()
		for i := 0; i < rounds; i++ {
			swapQbitPassSecret(&mu, registry, &last, "password-a")
			swapQbitPassSecret(&mu, registry, &last, "password-b")
		}
	}()
	racers.Wait()
	close(done)
	watcher.Wait()

	select {
	case live := <-violation:
		t.Fatalf("registry did not redact the live password %q at some point during concurrent ApplyConfig calls", live)
	default:
	}
}
