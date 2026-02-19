#!/usr/bin/env bash
set -euo pipefail

# Install + enable Mission Control (LAN) + Convex local deployment as systemd services.
# Run on the host with sudo.

SRC_DIR="/home/ivan/clawd/mission-control/systemd"

sudo cp "$SRC_DIR/convex-dev.service" /etc/systemd/system/convex-dev.service
sudo cp "$SRC_DIR/mission-control.lan.service" /etc/systemd/system/mission-control.lan.service

sudo systemctl daemon-reload
sudo systemctl enable --now convex-dev.service
sudo systemctl enable --now mission-control.lan.service

echo "OK. Status:"
sudo systemctl --no-pager --full status convex-dev.service mission-control.lan.service | sed -n '1,160p'

echo "Ports:"
ss -ltnp | grep -E ':(3000|3210|3211)\\b' || true

echo "Try: curl -s http://127.0.0.1:3000/api/activity/ingest (POST required)"
