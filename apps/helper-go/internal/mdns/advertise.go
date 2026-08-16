package mdns

import (
	"fmt"
	"os"

	"github.com/grandcat/zeroconf"
)

type Advertiser struct {
	server *zeroconf.Server
}

func Start(port int, version string) (*Advertiser, error) {
	host, err := os.Hostname()
	if err != nil || host == "" {
		host = "helper"
	}
	server, err := zeroconf.Register(
		fmt.Sprintf("torrent-vibe-helper-%s", host),
		"_torrentvibe-helper._tcp",
		"local.",
		port,
		[]string{"version=" + version},
		nil,
	)
	if err != nil {
		return nil, err
	}
	return &Advertiser{server: server}, nil
}

func (a *Advertiser) Stop() {
	if a != nil && a.server != nil {
		a.server.Shutdown()
	}
}
