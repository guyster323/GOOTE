#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE_DIR="$ROOT_DIR/mobile"
FLOW_FILE="$ROOT_DIR/maestro/flows/android-smoke.yaml"
RESULTS_DIR="$ROOT_DIR/test-results/maestro"
APP_ID="com.goote.goote_mobile"
START_APP=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --start-app)
      START_APP=1
      shift
      ;;
    *)
      printf 'Unknown argument: %s\n' "$1" >&2
      exit 1
      ;;
  esac
done

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

require_command adb
require_command maestro
require_command flutter

mkdir -p "$RESULTS_DIR"

DEVICE_SERIAL="$(adb devices | awk 'NR>1 && $2 == "device" { print $1; exit }')"
if [[ -z "$DEVICE_SERIAL" ]]; then
  printf 'No ADB device detected. Connect a device and enable USB debugging.\n' >&2
  exit 1
fi

printf 'Using Android device: %s\n' "$DEVICE_SERIAL"
adb -s "$DEVICE_SERIAL" wait-for-device >/dev/null

if [[ "$START_APP" -eq 1 ]]; then
  printf 'Starting Flutter app on device...\n'
  flutter -C "$MOBILE_DIR" run -d "$DEVICE_SERIAL" --debug --target lib/main.dart
fi

if ! adb -s "$DEVICE_SERIAL" shell pm list packages "$APP_ID" | tr -d '\r' | grep -q "$APP_ID"; then
  printf 'App %s is not installed on the device.\n' "$APP_ID" >&2
  printf 'Run npm run mobile:android or npm run mobile:build:apk first.\n' >&2
  exit 1
fi

printf 'Running Maestro flow %s\n' "$FLOW_FILE"
maestro --device "$DEVICE_SERIAL" test "$FLOW_FILE" --format junit --output "$RESULTS_DIR/android-smoke.xml"

printf 'Maestro results written to %s/android-smoke.xml\n' "$RESULTS_DIR"
