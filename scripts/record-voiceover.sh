#!/usr/bin/env bash
# Record the walkthrough narration in your own voice, one line at a time.
#
# Line-by-line rather than one continuous take: each line is a few seconds, a
# fluff only costs you that line, and the placement is handled afterwards — you
# never have to match a stopwatch.
#
# Recordings land in docs/vo-human/line-NN.wav. Re-run any time to redo lines.
set -uo pipefail
cd "$(dirname "$0")/.."

SRT="docs/walkthrough.srt"
OUT="docs/vo-human"
mkdir -p "$OUT"

[ -f "$SRT" ] || { echo "missing $SRT"; exit 1; }
command -v ffmpeg >/dev/null || { echo "ffmpeg not found"; exit 1; }

# ── pick an input ────────────────────────────────────────────────────────────
echo "Audio inputs:"
ffmpeg -f avfoundation -list_devices true -i "" 2>&1 \
  | sed -n '/AVFoundation audio devices/,$p' | grep -E '^\[AVFoundation' \
  | sed -E 's/.*\] \[([0-9]+)\] /  [\1] /'
echo
read -r -p "Device number [1]: " DEV
DEV="${DEV:-1}"
echo

# macOS asks for microphone permission the first time; if the level meter below
# never moves, grant it under System Settings > Privacy & Security > Microphone.
echo "Testing $DEV for 3 seconds — say something…"
ffmpeg -hide_banner -loglevel error -f avfoundation -i ":$DEV" -t 3 -y "$OUT/.test.wav" 2>/dev/null
LEVEL=$(ffmpeg -i "$OUT/.test.wav" -af volumedetect -f null - 2>&1 | grep mean_volume | awk '{print $5}')
echo "  mean level: ${LEVEL:-unknown} dB"
case "${LEVEL:-0}" in
  -9[0-9]*|-inf) echo "  That is silence — wrong device, or microphone permission is not granted."; echo "  Fix that and re-run."; exit 1 ;;
esac
rm -f "$OUT/.test.wav"
echo "  Sounds good."
echo

# ── read the lines out of the srt ────────────────────────────────────────────
# macOS ships bash 3.2, which has no mapfile — read into the array by hand.
LINES=()
while IFS= read -r __l; do LINES+=("$__l"); done < <(awk '
  /^[0-9]+$/    { n=1; next }
  /-->/         { next }
  /^[[:space:]]*$/ { if (buf != "") { print buf; buf="" } ; next }
  { buf = (buf == "" ? $0 : buf " " $0) }
  END { if (buf != "") print buf }
' "$SRT")

echo "${#LINES[@]} lines to record. ENTER starts, ENTER stops. 'r' redoes the last one, 's' skips, 'q' quits."
echo

i=0
while [ $i -lt ${#LINES[@]} ]; do
  n=$(printf "%02d" $((i + 1)))
  f="$OUT/line-$n.wav"
  echo "──────────────────────────────────────────────────────────────"
  printf "  Line %s of %s%s\n\n" "$((i + 1))" "${#LINES[@]}" "$([ -f "$f" ] && echo '   (already recorded — ENTER re-records)')"
  printf "  \033[1m%s\033[0m\n\n" "${LINES[$i]}"
  read -r -p "  ENTER to record (s=skip, q=quit): " k
  case "$k" in
    q) echo "stopped."; break ;;
    s) i=$((i + 1)); continue ;;
  esac

  ffmpeg -hide_banner -loglevel error -f avfoundation -i ":$DEV" \
    -ac 1 -ar 48000 -y "$f" >/dev/null 2>&1 &
  PID=$!
  sleep 0.35   # let the device open before they start talking
  echo "  ● recording — ENTER to stop"
  read -r _
  kill -INT "$PID" 2>/dev/null; wait "$PID" 2>/dev/null

  DUR=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$f" 2>/dev/null)
  LV=$(ffmpeg -i "$f" -af volumedetect -f null - 2>&1 | grep mean_volume | awk '{print $5}')
  printf "  saved %.1fs at %s dB\n" "${DUR:-0}" "${LV:-?}"
  read -r -p "  ENTER to continue, r to redo: " k2
  [ "$k2" = "r" ] || i=$((i + 1))
  echo
done

echo
echo "Recorded: $(ls "$OUT"/line-*.wav 2>/dev/null | wc -l | tr -d ' ') of ${#LINES[@]} lines in $OUT"
echo "Tell Claude when you're done and it will master and mux them onto the video."
