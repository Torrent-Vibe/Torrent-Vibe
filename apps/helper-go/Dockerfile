# syntax=docker/dockerfile:1
FROM golang:1.23-alpine AS build
WORKDIR /src
COPY . ./
RUN CGO_ENABLED=0 go build -o /torrent-vibe-helper ./cmd/torrent-vibe-helper

FROM scratch
COPY --from=build /torrent-vibe-helper /torrent-vibe-helper
EXPOSE 17890
ENTRYPOINT ["/torrent-vibe-helper"]
