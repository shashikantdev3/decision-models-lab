"""Hello World for decision models in Python. Standard library only.

Usage:
    OPENROUTER_API_KEY=sk-or-... python hello.py [model] [--raw]

model defaults to typesafe/jev-1.14; try microsoft/microsoft-decision-1-20261009.
Costs a fraction of a cent. Output tokens are free.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request

MODEL = next((a for a in sys.argv[1:] if not a.startswith("--")), "typesafe/jev-1.14")
KEY = os.environ.get("OPENROUTER_API_KEY")
if not KEY:
    sys.exit("Set OPENROUTER_API_KEY first.")

body = {
    "model": MODEL,
    "state": ["Ticket: Checkout returns HTTP 500 for all users since 10:05."],
    "questions": {
        "urgent": {
            "type": "noul",
            "instructions": "Does this need someone right now?",
            "criteria": {"true": "Customers are blocked or data is at risk", "false": "It can wait for normal hours"},
        },
        "team": {
            "type": "choice",
            "instructions": "Which team should own this?",
            "criteria": {"payments": "Checkout and billing", "auth": "Login and access", "infra": "Servers, network and outages"},
        },
        "severity": {
            "type": "score",
            "instructions": "How severe is the impact?",
            "criteria": ["Cosmetic", "Minor", "Major", "Critical"],
        },
    },
}

req = urllib.request.Request(
    "https://openrouter.ai/api/alpha/decisions",
    data=json.dumps(body).encode(),
    headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
)
start = time.perf_counter()
try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.load(resp)
except urllib.error.HTTPError as e:
    sys.exit(f"HTTP {e.code}: {e.read().decode()}")
elapsed_ms = (time.perf_counter() - start) * 1000

if "--raw" in sys.argv:
    print(json.dumps(data, indent=2))
    sys.exit(0)

answers = data["answers"]
levels = body["questions"]["severity"]["criteria"]
team = answers["team"]
others = ", ".join(f"{k} {v:.2f}" for k, v in sorted(team["probabilities"].items(), key=lambda kv: -kv[1]))
top_idx, top_p = max(answers["severity"]["probabilities"].items(), key=lambda kv: kv[1])
usage = data.get("usage", {})
print(f"model     {data.get('model')}")
print(f"urgent    yes {answers['urgent']['noul']:.2f}")
print(f"team      {team['choice']} {team['probabilities'][team['choice']]:.2f}   confidence {team.get('confidence', 0):.2f}   ({others})")
print(f"severity  {levels[int(top_idx)]} {top_p:.2f}   position {answers['severity']['score']:.2f} on 0 to 3")
print(f"cost      ${usage.get('cost', 0):.7f} for {usage.get('input_tokens')} input tokens (output is free)")
print(f"time      {elapsed_ms:.0f} ms")
