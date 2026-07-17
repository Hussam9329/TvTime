#!/bin/bash
# Live audit script for TvTime

echo "=== 1. Homepage HTTP check ==="
curl -sI https://tvtime-iota.vercel.app/ | head -30
echo ""

echo "=== 2. Homepage timing ==="
curl -o /dev/null -s -w "DNS: %{time_namelookup}s | Connect: %{time_connect}s | TLS: %{time_appconnect}s | TTFB: %{time_starttransfer}s | Total: %{time_total}s | Size: %{size_download} bytes\n" https://tvtime-iota.vercel.app/

echo ""
echo "=== 3. API root check ==="
curl -sI https://tvtime-iota.vercel.app/api | head -10

echo ""
echo "=== 4. Media endpoint check ==="
curl -s -w "\nHTTP: %{http_code} | Time: %{time_total}s\n" "https://tvtime-iota.vercel.app/api/media?userId=cinetrack_default&limit=5" | head -50

echo ""
echo "=== 5. TMDB proxy check (exposes API key?) ==="
curl -s -w "\nHTTP: %{http_code} | Time: %{time_total}s\n" "https://tvtime-iota.vercel.app/api/tmdb/trending" | head -30

echo ""
echo "=== 6. Admin endpoint without secret ==="
curl -s -w "\nHTTP: %{http_code}\n" "https://tvtime-iota.vercel.app/api/admin/repair-posters"

echo ""
echo "=== 7. User endpoint (returns what?) ==="
curl -s -w "\nHTTP: %{http_code}\n" "https://tvtime-iota.vercel.app/api/user" | head -30

echo ""
echo "=== 8. Library stats ==="
curl -s -w "\nHTTP: %{http_code}\n" "https://tvtime-iota.vercel.app/api/library/stats?userId=cinetrack_default" | head -50

echo ""
echo "=== 9. Library export (data exfiltration test) ==="
curl -s -w "\nHTTP: %{http_code}\n" "https://tvtime-iota.vercel.app/api/library/export?userId=cinetrack_default" | head -20

echo ""
echo "=== 10. Library clear endpoint check (POST) ==="
curl -s -w "\nHTTP: %{http_code}\n" -X POST "https://tvtime-iota.vercel.app/api/library/clear?userId=cinetrack_default" -H "Content-Type: application/json" -d '{}' | head -20

echo ""
echo "=== 11. TV Tracking endpoint ==="
curl -s -w "\nHTTP: %{http_code} | Time: %{time_total}s\n" "https://tvtime-iota.vercel.app/api/tv-tracking?userId=cinetrack_default" | head -50

echo ""
echo "=== 12. Check security headers ==="
curl -sI https://tvtime-iota.vercel.app/ | grep -iE "x-frame|x-content|referrer|permissions|strict-transport|content-security"

echo ""
echo "=== 13. Try accessing admin endpoint with random secret ==="
curl -s -w "\nHTTP: %{http_code}\n" "https://tvtime-iota.vercel.app/api/admin/repair-posters?secret=test123"

echo ""
echo "=== 14. Find or create media (writes to DB!) ==="
curl -s -w "\nHTTP: %{http_code}\n" -X POST "https://tvtime-iota.vercel.app/api/media/find-or-create?userId=cinetrack_default" -H "Content-Type: application/json" -d '{"title":"AUDIT_TEST_DELETE_ME","type":"movie","tmdbId":999999999}' | head -30

echo ""
echo "=== 15. Homepage HTML checks for SEO ==="
curl -s https://tvtime-iota.vercel.app/ | grep -E "(<title>|<meta name=\"description\"|<meta name=\"viewport\"|<html lang=|og:|twitter:)" | head -10

echo ""
echo "=== 16. Test random userId injection (multi-tenant leak test) ==="
curl -s -w "\nHTTP: %{http_code}\n" "https://tvtime-iota.vercel.app/api/media?userId=HACKED_USER_ID&limit=5" | head -20

echo ""
echo "=== 17. Try sql-injection style userId ==="
curl -s -w "\nHTTP: %{http_code}\n" "https://tvtime-iota.vercel.app/api/media?userId=cinetrack_default%27%20OR%201%3D1--&limit=5" | head -10
