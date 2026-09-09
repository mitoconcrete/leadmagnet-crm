#!/usr/bin/env bash
# 웹 오리진(3000)만 확인한다. API 계약은 Bruno가 담당.
set -euo pipefail
WEB=${WEB_BASE_URL:-http://localhost:3000}

body=$(curl -fsS "$WEB/login")
echo "$body" | grep -qi '<form' || { echo "login page has no <form>"; exit 1; }

code=$(curl -s -o /dev/null -w '%{http_code}' "$WEB/api/admin/auth/me")
[ "$code" = "401" ] || { echo "expected 401 from web->api rewrite, got $code"; exit 1; }

echo "smoke ok"
