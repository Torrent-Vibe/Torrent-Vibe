package outbound

import (
	"net/http"
	"strings"
	"testing"
)

func TestParseEmptyIsDirect(t *testing.T) {
	got, err := Parse("")
	if err != nil || got != nil {
		t.Fatalf("%+v %v", got, err)
	}
}

func TestParseHTTPAndSocks(t *testing.T) {
	httpURL, err := Parse("http://127.0.0.1:7890")
	if err != nil || httpURL.Scheme != "http" || httpURL.Host != "127.0.0.1:7890" {
		t.Fatalf("%+v %v", httpURL, err)
	}
	socks, err := Parse("socks5://127.0.0.1:7891")
	if err != nil || socks.Scheme != "socks5" {
		t.Fatalf("%+v %v", socks, err)
	}
}

func TestParseRejectsUnknownScheme(t *testing.T) {
	_, err := Parse("ftp://127.0.0.1:21")
	if err == nil || !strings.Contains(err.Error(), "scheme") {
		t.Fatalf("%v", err)
	}
}

func TestNewClientEmptyUsesDefaultTransport(t *testing.T) {
	client, err := NewClient("")
	if err != nil || client == nil || client.Transport != http.DefaultTransport {
		t.Fatalf("%+v %v", client, err)
	}
}

func TestNewClientHTTPSetsProxy(t *testing.T) {
	client, err := NewClient("http://127.0.0.1:7890")
	if err != nil {
		t.Fatal(err)
	}
	transport, ok := client.Transport.(*http.Transport)
	if !ok || transport.Proxy == nil {
		t.Fatalf("%T", client.Transport)
	}
}
