#!/usr/bin/env bash
set -euo pipefail

BACKEND_URL="${BACKEND_URL:-https://backend-production-8727.up.railway.app}"
EMAIL="smoke-$(date +%s)@example.com"
PASSWORD="${PASSWORD:-chatbridge-demo}"

echo "Checking backend health at ${BACKEND_URL}"
curl -fsS "${BACKEND_URL}/healthz" >/dev/null

echo "Registering smoke user ${EMAIL}"
REGISTER_RESPONSE="$(curl -fsS -X POST "${BACKEND_URL}/api/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")"

TOKEN="$(printf '%s' "${REGISTER_RESPONSE}" | node -e "let data='';process.stdin.on('data',d=>data+=d);process.stdin.on('end',()=>{const parsed=JSON.parse(data); if(!parsed.token){process.exit(1)}; process.stdout.write(parsed.token)})")"

echo "Checking protected apps route"
APPS_RESPONSE="$(curl -fsS "${BACKEND_URL}/api/apps" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Accept: application/json')"

printf '%s' "${APPS_RESPONSE}" | node -e "let data='';process.stdin.on('data',d=>data+=d);process.stdin.on('end',()=>{const parsed=JSON.parse(data); const names=(parsed.apps||[]).map((app)=>app.appId); if(!names.includes('chess-v1')||!names.includes('weather-v1')){process.exit(1)}})"

echo "Backend smoke passed"
