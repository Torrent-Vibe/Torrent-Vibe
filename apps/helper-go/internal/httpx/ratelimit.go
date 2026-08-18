package httpx

import (
	"net"
	"net/http"
	"sync"
	"time"
)

const (
	pairAttemptLimit       = 5
	pairGlobalAttemptLimit = 50
	pairAttemptWindow      = time.Minute
	pairAttemptMaxTracked  = 1024
)

type attemptWindow struct {
	count int
	start time.Time
}

type attemptLimiter struct {
	mu          sync.Mutex
	perKey      map[string]*attemptWindow
	global      attemptWindow
	limit       int
	globalLimit int
	window      time.Duration
	now         func() time.Time
}

func newAttemptLimiter(limit, globalLimit int, window time.Duration) *attemptLimiter {
	return &attemptLimiter{
		perKey:      map[string]*attemptWindow{},
		limit:       limit,
		globalLimit: globalLimit,
		window:      window,
		now:         time.Now,
	}
}

func (l *attemptLimiter) retryAfter(key string) (time.Duration, bool) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	if wait, blocked := l.blockedFor(&l.global, l.globalLimit, now); blocked {
		return wait, true
	}
	if window, ok := l.perKey[key]; ok {
		if wait, blocked := l.blockedFor(window, l.limit, now); blocked {
			return wait, true
		}
	}
	return 0, false
}

func (l *attemptLimiter) fail(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	l.bump(&l.global, now)
	window, ok := l.perKey[key]
	if !ok {
		l.prune(now)
		if len(l.perKey) >= pairAttemptMaxTracked {
			return
		}
		window = &attemptWindow{}
		l.perKey[key] = window
	}
	l.bump(window, now)
}

func (l *attemptLimiter) succeed(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.perKey, key)
}

func (l *attemptLimiter) blockedFor(window *attemptWindow, limit int, now time.Time) (time.Duration, bool) {
	if window.count < limit {
		return 0, false
	}
	elapsed := now.Sub(window.start)
	if elapsed >= l.window {
		return 0, false
	}
	return l.window - elapsed, true
}

func (l *attemptLimiter) bump(window *attemptWindow, now time.Time) {
	if window.count == 0 || now.Sub(window.start) >= l.window {
		window.start = now
		window.count = 0
	}
	window.count++
}

func (l *attemptLimiter) prune(now time.Time) {
	if len(l.perKey) < pairAttemptMaxTracked {
		return
	}
	for key, window := range l.perKey {
		if now.Sub(window.start) >= l.window {
			delete(l.perKey, key)
		}
	}
}

func clientKey(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
