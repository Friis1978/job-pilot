#!/usr/bin/env bash
# Master the recorded lines and mux them onto the walkthrough video.
#
# Run after scripts/record-voiceover.sh. Any line you have not recorded is
# simply left silent, so you can build a partial pass and fill gaps later.
set -uo pipefail
cd "$(dirname "$0")/.."

SRT="docs/walkthrough.srt"
VO="docs/vo-human"
VIDEO="docs/walkthrough.mp4"
OUT="docs/walkthrough-voiced.mp4"

[ -d "$VO" ] || { echo "no recordings in $VO — run scripts/record-voiceover.sh first"; exit 1; }
[ -f "$VIDEO" ] || { echo "missing $VIDEO"; exit 1; }

# Mastering: trim the silence either side, gate the room tone, compress for
# density, lift presence for consonants, keep some chest, then normalise so
# every line sits at the same level regardless of how close you were to the mic.
MASTER="silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.06,\
areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.10,areverse,\
highpass=f=75,\
acompressor=threshold=-20dB:ratio=3:attack=8:release=180:makeup=2,\
equalizer=f=110:t=q:w=1.0:g=2,\
equalizer=f=300:t=q:w=1.0:g=-2,\
equalizer=f=3200:t=q:w=1.2:g=3,\
loudnorm=I=-16:TP=-1.5:LRA=11"

# Cue start times, in seconds, straight from the srt.
STARTS=$(grep -E '^[0-9]{2}:[0-9]{2}:[0-9]{2},[0-9]{3} -->' "$SRT" \
  | sed -E 's/ -->.*//' \
  | awk -F'[:,]' '{ printf "%.3f\n", $1*3600 + $2*60 + $3 + $4/1000 }')

INPUTS=(); FILTERS=(); LABELS=(); n=0; used=0
while IFS= read -r START; do
  n=$((n + 1))
  f=$(printf "%s/line-%02d.wav" "$VO" "$n")
  [ -f "$f" ] || { printf "  line %02d  — not recorded, leaving silent\n" "$n"; continue; }
  used=$((used + 1))
  m=$(printf "/tmp/vo-m-%02d.wav" "$n")
  ffmpeg -hide_banner -loglevel error -y -i "$f" -af "$MASTER" "$m" 2>/dev/null
  DUR=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$m")
  printf "  line %02d  at %6.2fs  %5.2fs long\n" "$n" "$START" "$DUR"
  MS=$(awk -v s="$START" 'BEGIN{ printf "%d", s*1000 }')
  INPUTS+=(-i "$m")
  FILTERS+=("[${used}:a]adelay=${MS}|${MS}[a${used}]")
  LABELS+=("[a${used}]")
done <<< "$STARTS"

[ "$used" -gt 0 ] || { echo "no recorded lines found"; exit 1; }

FC=$(IFS=';'; echo "${FILTERS[*]}")
LB=$(IFS=''; echo "${LABELS[*]}")
ffmpeg -hide_banner -loglevel error -y -i "$VIDEO" "${INPUTS[@]}" \
  -filter_complex "${FC};${LB}amix=inputs=${used}:normalize=0:dropout_transition=0[mix]" \
  -map 0:v -map "[mix]" -c:v copy -c:a aac -b:a 192k -shortest "$OUT"

rm -f /tmp/vo-m-*.wav
echo
echo "Wrote $OUT  ($used of $n lines)"
ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$OUT" \
  | awk '{ printf "Duration %.1fs\n", $1 }'
echo "Commit and push to publish — GitHub Pages serves it automatically."
