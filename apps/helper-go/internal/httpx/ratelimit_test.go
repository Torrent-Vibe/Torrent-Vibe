package httpx

import (
	"testing"
	"time"
)

func TestAttemptLimiterBlocksAfterLimitAndClearsAfterWindow(t *testing.T) {
	clock := time.Unix(0, 0)
	limiter := newAttemptLimiter(3, 100, time.Minute)
	limiter.now = func() time.Time { return clock }

	for i := 0; i < 3; i++ {
		if _, blocked := limiter.retryAfter("10.0.0.1"); blocked {
			t.Fatalf("blocked after %d failures", i)
		}
		limiter.fail("10.0.0.1")
	}

	wait, blocked := limiter.retryAfter("10.0.0.1")
	if !blocked || wait != time.Minute {
		t.Fatalf("blocked=%v wait=%v", blocked, wait)
	}

	clock = clock.Add(30 * time.Second)
	if wait, blocked := limiter.retryAfter("10.0.0.1"); !blocked || wait != 30*time.Second {
		t.Fatalf("blocked=%v wait=%v", blocked, wait)
	}

	clock = clock.Add(30 * time.Second)
	if _, blocked := limiter.retryAfter("10.0.0.1"); blocked {
		t.Fatal("still blocked after the window elapsed")
	}
}

func TestAttemptLimiterIsolatesKeys(t *testing.T) {
	limiter := newAttemptLimiter(2, 100, time.Minute)
	limiter.fail("10.0.0.1")
	limiter.fail("10.0.0.1")
	if _, blocked := limiter.retryAfter("10.0.0.1"); !blocked {
		t.Fatal("want first key blocked")
	}
	if _, blocked := limiter.retryAfter("10.0.0.2"); blocked {
		t.Fatal("second key must not be blocked")
	}
}

func TestAttemptLimiterSuccessClearsKey(t *testing.T) {
	limiter := newAttemptLimiter(2, 100, time.Minute)
	limiter.fail("10.0.0.1")
	limiter.fail("10.0.0.1")
	limiter.succeed("10.0.0.1")
	if _, blocked := limiter.retryAfter("10.0.0.1"); blocked {
		t.Fatal("a successful pair must reset the key")
	}
}

func TestAttemptLimiterGlobalCapSurvivesKeyRotation(t *testing.T) {
	limiter := newAttemptLimiter(5, 4, time.Minute)
	for i := 0; i < 4; i++ {
		limiter.fail(string(rune('a' + i)))
	}
	if _, blocked := limiter.retryAfter("fresh-key"); !blocked {
		t.Fatal("global cap must block a previously unseen key")
	}
}

func TestAttemptLimiterStopsTrackingBeyondCap(t *testing.T) {
	limiter := newAttemptLimiter(1, 1<<30, time.Minute)
	for i := 0; i < pairAttemptMaxTracked+50; i++ {
		limiter.fail(string(rune(i)))
	}
	if len(limiter.perKey) > pairAttemptMaxTracked {
		t.Fatalf("tracked %d keys", len(limiter.perKey))
	}
}
