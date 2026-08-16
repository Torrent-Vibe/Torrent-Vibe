package main

import (
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"sync"
	"syscall"
	"time"

	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/bangumi"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/config"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/httpx"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/loop"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/mdns"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/mikan"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/protocol"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/qb"
	"github.com/Torrent-Vibe/Torrent-Vibe/apps/helper-go/internal/store"
)

const version = "0.0.1"

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	port := flag.Int("port", atoiDefault(os.Getenv("PORT"), 17890), "")
	dataDir := flag.String("data-dir", envOr("DATA_DIR", "./data"), "")
	libraryRoot := flag.String("library-root", os.Getenv("LIBRARY_ROOT"), "")
	qbitURL := flag.String("qbit-url", envOr("QBIT_URL", "http://127.0.0.1:8080"), "")
	qbitUser := flag.String("qbit-user", envOr("QBIT_USER", "admin"), "")
	qbitPass := flag.String("qbit-pass", os.Getenv("QBIT_PASS"), "")
	pollMs := flag.Int("poll-interval", atoiDefault(os.Getenv("POLL_INTERVAL_MS"), 600000), "")
	flag.Parse()

	pairing, err := store.LoadPairing(*dataDir)
	if err != nil {
		return err
	}
	base := config.DefaultsFromEnv(envMap())
	if *libraryRoot != "" {
		base.LibraryRoot = *libraryRoot
	}
	base.QbitURL = firstNonEmpty(*qbitURL, base.QbitURL)
	base.QbitUser = firstNonEmpty(*qbitUser, base.QbitUser)
	if *qbitPass != "" {
		base.QbitPass = *qbitPass
	}
	if *pollMs > 0 {
		base.PollIntervalMs = *pollMs
	}
	cfg, err := config.Load(*dataDir, base)
	if err != nil {
		return err
	}
	code, err := store.GeneratePairingCode()
	if err != nil {
		return err
	}

	st := store.New(*dataDir)
	bgm := bangumi.New(nil, nil)
	var mu sync.Mutex
	var stopLoop func()
	makeDeps := func(next config.File) loop.Deps {
		return loop.Deps{
			Store:       st,
			QB:          qb.NewClient(next.QbitURL, next.QbitUser, next.QbitPass, nil),
			LibraryRoot: next.LibraryRoot,
			Category:    next.Category,
			FetchRSS:    fetchURL,
			ResolveTitle: func(replica protocol.Replica, item mikan.RssEpisode, parsed mikan.ParsedTitle) mikan.ParsedTitle {
				return bangumi.Resolve(bgm, replica.BangumiSubjectID, item, parsed)
			},
		}
	}
	startLoop := func(next config.File) {
		mu.Lock()
		defer mu.Unlock()
		if stopLoop != nil {
			stopLoop()
		}
		stopLoop = loop.Start(makeDeps(next), time.Duration(next.PollIntervalMs)*time.Millisecond)
	}
	startLoop(cfg)

	rt := &httpx.Runtime{}
	*rt = httpx.Runtime{
		Version:        version,
		Port:           *port,
		AdvertisedQbit: cfg.QbitURL,
		PairingCode:    code,
		Token:          pairing.Token,
		Bound:          pairing.Bound,
		Store:          st,
		DataDir:        *dataDir,
		Config:         cfg,
		OnBackfill: func(bangumiID, subgroupID string, episodes []mikan.RssEpisode) ([]store.Episode, error) {
			mu.Lock()
			deps := makeDeps(rt.Config)
			mu.Unlock()
			return loop.Backfill(deps, bangumiID, subgroupID, episodes)
		},
		ProbeQbit: func(rawURL, user, pass string) error {
			client := qb.NewClient(rawURL, user, pass, nil)
			_, err := client.ListTorrents()
			return err
		},
		ApplyConfig: func(next config.File) {
			startLoop(next)
		},
	}

	server := &http.Server{Addr: fmt.Sprintf(":%d", *port), Handler: httpx.New(rt)}
	var advert *mdns.Advertiser
	if os.Getenv("MIKAN_HELPER_DISABLE_MDNS") != "1" {
		advert, err = mdns.Start(*port, version)
		if err != nil {
			fmt.Fprintf(os.Stderr, "[helper] mdns: %v\n", err)
		}
	}

	fmt.Printf("[helper] listening on :%d\n", *port)
	fmt.Printf("[helper] pairing code: %s\n", code)
	fmt.Printf("[helper] advertised qBittorrent: %s\n", cfg.QbitURL)

	errCh := make(chan error, 1)
	go func() {
		errCh <- server.ListenAndServe()
	}()

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	select {
	case err := <-errCh:
		return err
	case <-sig:
	}

	mu.Lock()
	if stopLoop != nil {
		stopLoop()
	}
	mu.Unlock()
	advert.Stop()
	return server.Close()
}

func fetchURL(rawURL string) (string, error) {
	res, err := http.Get(rawURL)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	if res.StatusCode >= 400 {
		return "", fmt.Errorf("rss %d", res.StatusCode)
	}
	raw, err := io.ReadAll(res.Body)
	if err != nil {
		return "", err
	}
	return string(raw), nil
}

func envOr(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

func atoiDefault(raw string, fallback int) int {
	n, err := strconv.Atoi(raw)
	if err != nil || n <= 0 {
		return fallback
	}
	return n
}

func envMap() map[string]string {
	out := map[string]string{}
	for _, key := range []string{"LIBRARY_ROOT", "QBIT_URL", "QBIT_USER", "QBIT_PASS", "POLL_INTERVAL_MS"} {
		if value, ok := os.LookupEnv(key); ok {
			out[key] = value
		}
	}
	return out
}
