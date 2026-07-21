#!/usr/bin/env bash
# Clear anything blocking `next dev` before it starts.
#
# Two distinct failure modes, both of which look like "localhost won't load":
#
#   1. A process squats on the port, so Next silently starts on 3001 instead and
#      localhost:3000 serves whatever stale thing is still bound there.
#   2. Next 16 refuses to start at all when another dev server is running for the
#      same project directory — "Another next dev server is already running" —
#      even when that server is on a *different* port. It records the offender in
#      .next/dev/lock, which is what we read here.
#
# Runs as npm `predev`. Never fails the dev command: worst case it does nothing.
set -uo pipefail

PORT="${PORT:-3000}"
LOCK=".next/dev/lock"

kill_pid() {
  local pid="$1"
  [ -z "$pid" ] && return 0
  kill "$pid" 2>/dev/null || true
}

# --- 1. Stale dev server for this project directory (any port) ---------------
if [ -f "$LOCK" ]; then
  lock_pid=$(grep -o '"pid":[0-9]*' "$LOCK" 2>/dev/null | head -1 | cut -d: -f2)
  lock_port=$(grep -o '"port":[0-9]*' "$LOCK" 2>/dev/null | head -1 | cut -d: -f2)

  if [ -n "${lock_pid:-}" ] && ps -p "$lock_pid" >/dev/null 2>&1; then
    echo "Stale next dev server running (PID $lock_pid, port ${lock_port:-?}) — stopping it."
    # Kill the wrapper parent too, or npm respawns / leaves an orphan behind.
    parent=$(ps -o ppid= -p "$lock_pid" 2>/dev/null | tr -d ' ')
    if [ -n "${parent:-}" ] && ps -p "$parent" -o command= 2>/dev/null | grep -q "next"; then
      kill_pid "$parent"
    fi
    kill_pid "$lock_pid"
  fi

  # A lock pointing at a dead process still trips Next's check on some versions.
  if [ -n "${lock_pid:-}" ] && ! ps -p "$lock_pid" >/dev/null 2>&1; then
    rm -f "$LOCK" 2>/dev/null || true
  fi
fi

# --- 2. Whatever is listening on the target port -----------------------------
# -sTCP:LISTEN so a browser tab holding an open connection is not mistaken for
# a server and killed.
pids=$(lsof -ti:"$PORT" -sTCP:LISTEN 2>/dev/null || true)

if [ -n "$pids" ]; then
  echo "Port $PORT in use by PID(s):$(echo " $pids" | tr '\n' ' ')— freeing it."
  for pid in $pids; do kill_pid "$pid"; done
fi

# --- 3. Wait for release, then escalate --------------------------------------
for _ in $(seq 1 20); do
  still=$(lsof -ti:"$PORT" -sTCP:LISTEN 2>/dev/null || true)
  lock_alive=""
  if [ -f "$LOCK" ]; then
    lp=$(grep -o '"pid":[0-9]*' "$LOCK" 2>/dev/null | head -1 | cut -d: -f2)
    [ -n "${lp:-}" ] && ps -p "$lp" >/dev/null 2>&1 && lock_alive="$lp"
  fi
  [ -z "$still" ] && [ -z "$lock_alive" ] && exit 0
  sleep 0.25
done

for pid in $(lsof -ti:"$PORT" -sTCP:LISTEN 2>/dev/null || true); do
  kill -9 "$pid" 2>/dev/null || true
done
if [ -f "$LOCK" ]; then
  lp=$(grep -o '"pid":[0-9]*' "$LOCK" 2>/dev/null | head -1 | cut -d: -f2)
  [ -n "${lp:-}" ] && kill -9 "$lp" 2>/dev/null || true
  rm -f "$LOCK" 2>/dev/null || true
fi
sleep 0.5

exit 0
