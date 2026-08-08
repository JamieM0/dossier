package main

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"regexp"
	"strings"
	"syscall"
	"time"

	"github.com/gofrs/flock"
	"golang.org/x/crypto/acme/autocert"
	"tailscale.com/ipn"
	"tailscale.com/tsnet"
)

type event struct {
	Type    string `json:"type"`
	Stage   string `json:"stage,omitempty"`
	URL     string `json:"url,omitempty"`
	Origin  string `json:"origin,omitempty"`
	Message string `json:"message,omitempty"`
}

var httpsURL = regexp.MustCompile(`https://[^\s]+`)

func emit(value event) {
	_ = json.NewEncoder(os.Stdout).Encode(value)
}

func cleanURL(raw string) string {
	return strings.TrimRight(raw, ".,);]\"'")
}

func acquireHelperLock(stateDir string) (*flock.Flock, error) {
	helperLock := flock.New(filepath.Join(stateDir, "remote-helper.lock"))
	locked, err := helperLock.TryLock()
	if err != nil {
		return nil, fmt.Errorf("lock Dossier's Tailscale identity: %w", err)
	}
	if !locked {
		return nil, errors.New("another Dossier remote-access helper is already running; close every other Dossier window, then retry")
	}
	return helperLock, nil
}

func proxyFor(raw string) (*httputil.ReverseProxy, error) {
	upstream, err := url.Parse(raw)
	if err != nil || upstream.Scheme != "http" || upstream.Hostname() != "127.0.0.1" {
		return nil, errors.New("upstream must be a loopback HTTP URL")
	}
	proxy := httputil.NewSingleHostReverseProxy(upstream)
	proxy.ErrorHandler = func(w http.ResponseWriter, _ *http.Request, err error) {
		http.Error(w, "Dossier gateway unavailable", http.StatusBadGateway)
		emit(event{Type: "error", Stage: "proxy", Message: err.Error()})
	}
	return proxy, nil
}

type serveConfigClient interface {
	GetServeConfig(context.Context) (*ipn.ServeConfig, error)
	SetServeConfig(context.Context, *ipn.ServeConfig) error
}

// clearStaleFunnelRegistration removes only Dossier's previous Funnel flag.
// ListenFunnel immediately recreates it, which forces a fresh false-to-true
// Hostinfo update to control and makes the new listener own its cleanup. This
// avoids reusing an ingress registration left behind by an interrupted run.
func clearStaleFunnelRegistration(ctx context.Context, client serveConfigClient, dnsName string) (bool, error) {
	config, err := client.GetServeConfig(ctx)
	if err != nil {
		return false, err
	}
	if config == nil || config.AllowFunnel == nil {
		return false, nil
	}
	endpoint := ipn.HostPort(dnsName + ":443")
	if !config.AllowFunnel[endpoint] {
		return false, nil
	}
	delete(config.AllowFunnel, endpoint)
	if err := client.SetServeConfig(ctx, config); err != nil {
		return false, err
	}
	return true, nil
}

func publicDNSHTTPSClient() *http.Client {
	resolver := &net.Resolver{
		PreferGo: true,
		Dial: func(ctx context.Context, _, _ string) (net.Conn, error) {
			dialer := &net.Dialer{Timeout: 5 * time.Second}
			return dialer.DialContext(ctx, "udp", "1.1.1.1:53")
		},
	}
	dialer := &net.Dialer{Timeout: 10 * time.Second, Resolver: resolver}
	return &http.Client{
		Timeout: 10 * time.Second,
		Transport: &http.Transport{
			Proxy:                 http.ProxyFromEnvironment,
			DialContext:           dialer.DialContext,
			ForceAttemptHTTP2:     true,
			TLSHandshakeTimeout:   10 * time.Second,
			ResponseHeaderTimeout: 10 * time.Second,
		},
	}
}

func waitForPublicHTTPS(ctx context.Context, origin string, serveErr <-chan error, clients []*http.Client, onWait func(time.Duration, error)) error {
	verifyCtx, cancel := context.WithTimeout(ctx, 10*time.Minute)
	defer cancel()
	started := time.Now()
	var lastErr error

	for {
		for _, client := range clients {
			request, err := http.NewRequestWithContext(verifyCtx, http.MethodGet, origin+"/health", nil)
			if err != nil {
				return err
			}
			response, err := client.Do(request)
			if err == nil {
				_ = response.Body.Close()
				if response.StatusCode == http.StatusOK {
					return nil
				}
				err = fmt.Errorf("endpoint returned HTTP %d", response.StatusCode)
			}
			lastErr = err
		}
		if onWait != nil {
			onWait(time.Since(started).Round(time.Second), lastErr)
		}

		select {
		case serveFailure := <-serveErr:
			if serveFailure == nil || errors.Is(serveFailure, http.ErrServerClosed) {
				return errors.New("Funnel listener stopped before its HTTPS endpoint became reachable")
			}
			return serveFailure
		case <-verifyCtx.Done():
			if errors.Is(verifyCtx.Err(), context.DeadlineExceeded) {
				return fmt.Errorf("Tailscale HTTPS did not become reachable within 10 minutes; confirm MagicDNS and HTTPS Certificates are enabled, then retry: %w", lastErr)
			}
			return verifyCtx.Err()
		case <-time.After(5 * time.Second):
		}
	}
}

func runTailscale(ctx context.Context, proxy http.Handler, stateDir string) error {
	server := &tsnet.Server{
		Dir:       filepath.Join(stateDir, "tsnet"),
		Hostname:  "dossier",
		Ephemeral: false,
		UserLogf: func(format string, args ...any) {
			message := fmt.Sprintf(format, args...)
			for _, match := range httpsURL.FindAllString(message, -1) {
				candidate := cleanURL(match)
				if strings.Contains(candidate, "login.tailscale.com") {
					emit(event{Type: "auth_url", URL: candidate})
				}
			}
		},
	}
	defer server.Close()

	emit(event{Type: "state", Stage: "starting", Message: "Starting Dossier's private Tailscale node"})
	if err := server.Start(); err != nil {
		return fmt.Errorf("start tsnet: %w", err)
	}
	emit(event{Type: "state", Stage: "authorizing", Message: "Waiting for Tailscale authorization"})
	if _, err := server.Up(ctx); err != nil {
		return fmt.Errorf("authorize tsnet: %w", err)
	}

	local, err := server.LocalClient()
	if err != nil {
		return fmt.Errorf("get tsnet local client: %w", err)
	}
	status, err := local.Status(ctx)
	if err != nil {
		return fmt.Errorf("read tsnet status: %w", err)
	}
	dnsName := strings.TrimSuffix(status.Self.DNSName, ".")
	if dnsName == "" {
		return errors.New("Tailscale did not assign Dossier a DNS name")
	}
	if cleared, err := clearStaleFunnelRegistration(ctx, local, dnsName); err != nil {
		return fmt.Errorf("refresh Funnel registration: %w", err)
	} else if cleared {
		emit(event{Type: "state", Stage: "funnel", Message: "Refreshing Dossier's Funnel registration"})
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(2 * time.Second):
		}
	}

	emit(event{Type: "state", Stage: "funnel", Message: "Enabling encrypted Funnel access"})
	var listener net.Listener
	for attempt := 0; ; attempt++ {
		listener, err = server.ListenFunnel("tcp", ":443", tsnet.FunnelOnly())
		if err == nil {
			break
		}
		message := err.Error()
		approvalFound := false
		for _, match := range httpsURL.FindAllString(message, -1) {
			approvalFound = true
			emit(event{Type: "approval_url", URL: cleanURL(match)})
		}
		if !approvalFound || attempt >= 100 {
			return fmt.Errorf("enable Funnel: %w", err)
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(3 * time.Second):
		}
	}
	defer listener.Close()

	origin := "https://" + dnsName
	serverHTTP := &http.Server{Handler: proxy, ReadHeaderTimeout: 10 * time.Second}
	serveErr := make(chan error, 1)
	go func() {
		serveErr <- serverHTTP.Serve(listener)
	}()
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = serverHTTP.Shutdown(shutdownCtx)
	}()
	emit(event{Type: "state", Stage: "funnel", Message: "Waiting for Tailscale HTTPS certificates and public DNS"})
	verificationClients := []*http.Client{
		publicDNSHTTPSClient(),
		{Timeout: 10 * time.Second},
	}
	if err := waitForPublicHTTPS(ctx, origin, serveErr, verificationClients, func(elapsed time.Duration, _ error) {
		emit(event{Type: "state", Stage: "funnel", Message: fmt.Sprintf("Tailscale HTTPS is not reachable yet — retrying automatically (%s elapsed; allow up to 10 minutes)", elapsed)})
	}); err != nil {
		return fmt.Errorf("verify Funnel HTTPS: %w", err)
	}
	emit(event{Type: "ready", Origin: origin})
	select {
	case err := <-serveErr:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			return err
		}
	case <-ctx.Done():
	}
	return nil
}

func runDirect(ctx context.Context, proxy http.Handler, stateDir, hostname, email string, port int) error {
	hostname = strings.TrimSpace(strings.ToLower(hostname))
	if hostname == "" || net.ParseIP(hostname) != nil || strings.Contains(hostname, ":") {
		return errors.New("a public DNS hostname is required for Direct HTTPS")
	}
	manager := &autocert.Manager{
		Prompt:     autocert.AcceptTOS,
		HostPolicy: autocert.HostWhitelist(hostname),
		Cache:      autocert.DirCache(filepath.Join(stateDir, "acme")),
		Email:      strings.TrimSpace(email),
	}
	listener, err := net.Listen("tcp", fmt.Sprintf(":%d", port))
	if err != nil {
		return fmt.Errorf("listen for Direct HTTPS: %w", err)
	}
	defer listener.Close()

	tlsConfig := manager.TLSConfig()
	tlsConfig.MinVersion = tls.VersionTLS12
	tlsListener := tls.NewListener(listener, tlsConfig)
	origin := "https://" + hostname
	emit(event{Type: "ready", Origin: origin})
	serverHTTP := &http.Server{Handler: proxy, ReadHeaderTimeout: 10 * time.Second}
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = serverHTTP.Shutdown(shutdownCtx)
	}()
	if err := serverHTTP.Serve(tlsListener); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

func main() {
	mode := flag.String("mode", "", "tailscale or direct")
	upstream := flag.String("upstream", "", "loopback Dossier gateway URL")
	stateDir := flag.String("state-dir", "", "persistent helper state directory")
	hostname := flag.String("hostname", "", "public hostname for Direct HTTPS")
	email := flag.String("email", "", "ACME contact email")
	port := flag.Int("port", 48732, "local Direct HTTPS port")
	flag.Parse()

	log.SetOutput(os.Stderr)
	if *stateDir == "" {
		emit(event{Type: "error", Stage: "configuration", Message: "state-dir is required"})
		os.Exit(2)
	}
	if err := os.MkdirAll(*stateDir, 0o700); err != nil {
		emit(event{Type: "error", Stage: "configuration", Message: err.Error()})
		os.Exit(2)
	}
	helperLock, err := acquireHelperLock(*stateDir)
	if err != nil {
		emit(event{Type: "error", Stage: "configuration", Message: err.Error()})
		os.Exit(1)
	}
	defer func() { _ = helperLock.Unlock() }()
	proxy, err := proxyFor(*upstream)
	if err != nil {
		emit(event{Type: "error", Stage: "configuration", Message: err.Error()})
		os.Exit(2)
	}

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	go func() {
		// The desktop backend owns this stdin pipe. EOF means the parent exited
		// unexpectedly, so tear down Funnel and release the persistent identity.
		_, _ = io.Copy(io.Discard, os.Stdin)
		cancel()
	}()
	switch *mode {
	case "tailscale":
		err = runTailscale(ctx, proxy, *stateDir)
	case "direct":
		err = runDirect(ctx, proxy, *stateDir, *hostname, *email, *port)
	default:
		err = errors.New("mode must be tailscale or direct")
	}
	if err != nil && !errors.Is(err, context.Canceled) {
		emit(event{Type: "error", Stage: *mode, Message: err.Error()})
		os.Exit(1)
	}
}
