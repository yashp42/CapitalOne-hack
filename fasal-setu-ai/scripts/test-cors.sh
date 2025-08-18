#!/usr/bin/env bash

# CORS Testing Script for DigitalOcean Deployments
# Usage: ./test-cors.sh https://your-api-server.com https://your-frontend-domain.com

API_SERVER=$1
FRONTEND_DOMAIN=$2

if [ -z "$API_SERVER" ] || [ -z "$FRONTEND_DOMAIN" ]; then
  echo "Usage: $0 <api-server-url> <frontend-domain>"
  echo "Example: $0 https://api.fasalsetu.com https://fasalsetu.vercel.app"
  exit 1
fi

echo "🔍 Testing CORS configuration between $FRONTEND_DOMAIN and $API_SERVER"
echo

# Test 1: OPTIONS preflight request
echo "Test 1: OPTIONS preflight request (browser preflight check)"
echo "---------------------------------------------------------"
curl -i -X OPTIONS "$API_SERVER/health" \
  -H "Origin: $FRONTEND_DOMAIN" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization"
echo -e "\n"

# Test 2: GET request with Origin header
echo "Test 2: GET request with Origin header (simple request)"
echo "------------------------------------------------------"
curl -i -X GET "$API_SERVER/health" -H "Origin: $FRONTEND_DOMAIN"
echo -e "\n"

# Test 3: GET request with credentials
echo "Test 3: GET request with credentials (cookie request)"
echo "----------------------------------------------------"
curl -i -X GET "$API_SERVER/health" \
  -H "Origin: $FRONTEND_DOMAIN" \
  -H "Cookie: test=value" \
  --cookie "test=value" \
  -c /tmp/cookies.txt
echo -e "\n"

# Test 4: OPTIONS request with a complex request (PUT, with JSON)
echo "Test 4: OPTIONS preflight for complex request (PUT with JSON)"
echo "-----------------------------------------------------------"
curl -i -X OPTIONS "$API_SERVER/api/users/profile" \
  -H "Origin: $FRONTEND_DOMAIN" \
  -H "Access-Control-Request-Method: PUT" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization"
echo -e "\n"

# Test 5: CORS debug endpoint
echo "Test 5: Checking CORS debug endpoint"
echo "----------------------------------"
curl -i -X GET "$API_SERVER/cors-debug" -H "Origin: $FRONTEND_DOMAIN" 
echo -e "\n"

echo "✅ Testing complete"
echo 
echo "Common issues:"
echo "1. Missing 'Access-Control-Allow-Origin' header in response"
echo "2. Access-Control-Allow-Origin: * (doesn't work with credentials)"
echo "3. Missing 'Access-Control-Allow-Credentials: true' when using cookies"
echo "4. Access-Control-Allow-Headers doesn't include what the browser requested"
echo "5. Digital Ocean App Platform may need 'httpOnly: true' for cookies"
