#!/usr/bin/env bash
set -euo pipefail

FRONTEND_URL="${FRONTEND_URL:-https://frontend-production-062e.up.railway.app}"
BACKEND_URL="${BACKEND_URL:-https://backend-production-8727.up.railway.app}"

echo "Checking frontend: ${FRONTEND_URL}"
curl -I -sS "${FRONTEND_URL}" >/dev/null

echo "Checking ChatBridge settings route: ${FRONTEND_URL}/settings/chatbridge"
curl -I -sS "${FRONTEND_URL}/settings/chatbridge" >/dev/null

echo "Checking backend health: ${BACKEND_URL}/healthz"
health_json="$(curl -fsS "${BACKEND_URL}/healthz")"
echo "${health_json}" | grep -q '"ok":true'
echo "${health_json}" | grep -q '"service":"chatbridge-server"'

echo "Railway audit passed"
