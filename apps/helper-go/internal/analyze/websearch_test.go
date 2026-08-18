package analyze

import (
	"strings"
	"testing"
)

func TestParseDuckDuckGoHTML(t *testing.T) {
	raw := `
<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fen.wikipedia.org%2Fwiki%2FThe_Matrix">The Matrix (1999 film)</a>
<a class="result__snippet">A computer hacker learns about the true nature of reality.</a>
<a class="result__a" href="https://www.imdb.com/title/tt0133093/">The Matrix (1999) - IMDb</a>
<a class="result__snippet">Directed by the Wachowskis.</a>`
	hits := parseDuckDuckGoHTML(raw, 5)
	if len(hits) != 2 || hits[0].Title != "The Matrix (1999 film)" {
		t.Fatalf("%+v", hits)
	}
	if !strings.Contains(hits[0].URL, "wikipedia.org/wiki/The_Matrix") || hits[0].Snippet == "" {
		t.Fatalf("%+v", hits[0])
	}
	if hits[1].URL != "https://www.imdb.com/title/tt0133093/" {
		t.Fatalf("%+v", hits[1])
	}
}
