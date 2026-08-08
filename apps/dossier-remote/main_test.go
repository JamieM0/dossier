package main

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"

	"tailscale.com/ipn"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (function roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return function(request)
}

type fakeServeConfigClient struct {
	config   *ipn.ServeConfig
	setCalls int
}

func (client *fakeServeConfigClient) GetServeConfig(context.Context) (*ipn.ServeConfig, error) {
	return client.config, nil
}

func (client *fakeServeConfigClient) SetServeConfig(_ context.Context, config *ipn.ServeConfig) error {
	client.config = config
	client.setCalls++
	return nil
}

func TestClearStaleFunnelRegistrationOnlyRemovesDossierEndpoint(t *testing.T) {
	client := &fakeServeConfigClient{config: &ipn.ServeConfig{AllowFunnel: map[ipn.HostPort]bool{
		"dossier.example.ts.net:443": true,
		"other.example.ts.net:443":   true,
	}}}

	cleared, err := clearStaleFunnelRegistration(context.Background(), client, "dossier.example.ts.net")
	if err != nil {
		t.Fatalf("clear stale Funnel registration: %v", err)
	}
	if !cleared || client.setCalls != 1 {
		t.Fatalf("expected one persisted change, cleared=%v calls=%d", cleared, client.setCalls)
	}
	if client.config.AllowFunnel["dossier.example.ts.net:443"] {
		t.Fatal("Dossier endpoint was not removed")
	}
	if !client.config.AllowFunnel["other.example.ts.net:443"] {
		t.Fatal("unrelated Funnel endpoint was removed")
	}
}

func TestClearStaleFunnelRegistrationDoesNotWriteWhenAbsent(t *testing.T) {
	client := &fakeServeConfigClient{config: &ipn.ServeConfig{}}
	cleared, err := clearStaleFunnelRegistration(context.Background(), client, "dossier.example.ts.net")
	if err != nil {
		t.Fatalf("clear absent Funnel registration: %v", err)
	}
	if cleared || client.setCalls != 0 {
		t.Fatalf("expected no persisted change, cleared=%v calls=%d", cleared, client.setCalls)
	}
}

func TestWaitForPublicHTTPSWaitsForHealthyEndpoint(t *testing.T) {
	client := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		if request.URL.String() != "https://dossier.example/health" {
			t.Fatalf("unexpected verification URL %q", request.URL.String())
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(strings.NewReader("ok")),
			Header:     make(http.Header),
		}, nil
	})}

	if err := waitForPublicHTTPS(context.Background(), "https://dossier.example", make(chan error), []*http.Client{client}, nil); err != nil {
		t.Fatalf("expected healthy endpoint, got %v", err)
	}
}

func TestWaitForPublicHTTPSReportsListenerFailure(t *testing.T) {
	listenerErr := errors.New("listener stopped")
	serveErr := make(chan error, 1)
	serveErr <- listenerErr

	client := &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		return nil, errors.New("not ready")
	})}
	err := waitForPublicHTTPS(context.Background(), "https://dossier.example", serveErr, []*http.Client{client}, nil)
	if !errors.Is(err, listenerErr) {
		t.Fatalf("expected listener error, got %v", err)
	}
}

func TestAcquireHelperLockPreventsConcurrentIdentityUse(t *testing.T) {
	stateDir := t.TempDir()
	first, err := acquireHelperLock(stateDir)
	if err != nil {
		t.Fatalf("acquire first lock: %v", err)
	}

	if _, err := acquireHelperLock(stateDir); err == nil {
		t.Fatal("expected a concurrent helper to be rejected")
	}

	if err := first.Unlock(); err != nil {
		t.Fatalf("release first lock: %v", err)
	}
	second, err := acquireHelperLock(stateDir)
	if err != nil {
		t.Fatalf("reacquire helper lock: %v", err)
	}
	defer second.Unlock()
}
