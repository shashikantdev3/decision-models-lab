#!/usr/bin/env bash
# Hello World for decision models. One call, three question types.
# Usage: OPENROUTER_API_KEY=sk-or-... ./curl.sh [model]
#   model defaults to typesafe/jev-1.14; try microsoft/microsoft-decision-1-20261009
# Costs a fraction of a cent. Output tokens are free.
set -euo pipefail
MODEL="${1:-typesafe/jev-1.14}"
: "${OPENROUTER_API_KEY:?Set OPENROUTER_API_KEY first}"

curl -sS https://openrouter.ai/api/alpha/decisions \
  -H "Authorization: Bearer ${OPENROUTER_API_KEY}" \
  -H "Content-Type: application/json" \
  -d @- <<JSON
{
  "model": "${MODEL}",
  "state": ["Ticket: Checkout returns HTTP 500 for all users since 10:05."],
  "questions": {
    "urgent": {
      "type": "noul",
      "instructions": "Does this need someone right now?",
      "criteria": { "true": "Customers are blocked or data is at risk", "false": "It can wait for normal hours" }
    },
    "team": {
      "type": "choice",
      "instructions": "Which team should own this?",
      "criteria": { "payments": "Checkout and billing", "auth": "Login and access", "infra": "Servers, network and outages" }
    },
    "severity": {
      "type": "score",
      "instructions": "How severe is the impact?",
      "criteria": ["Cosmetic", "Minor", "Major", "Critical"]
    }
  }
}
JSON
echo
