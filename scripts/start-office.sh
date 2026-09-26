#!/bin/sh
set -eu

action=start
port=${AI_OFFICE_PORT:-${CHELEBY_PORT:-4317}}
timeout=45
while [ "$#" -gt 0 ]; do
  case "$1" in
    --action|--port|--timeout)
      [ "$#" -ge 2 ] || { printf 'Eksik secenek degeri: %s\n' "$1" >&2; exit 2; }
      case "$1" in
        --action) action=$2 ;;
        --port) port=$2 ;;
        --timeout) timeout=$2 ;;
      esac
      shift 2 ;;
    --help)
      printf '%s\n' 'AI Office (Linux/WSL)' 'sh scripts/start-office.sh [--action start|stop|status] [--port 4317] [--timeout 45]' 'JSON sonucundaki URL adresini tarayicida ac. Varsayilan kaynak: Linux ~/.codex; AI_OFFICE_CODEX_HOME ile acikca degistirilebilir.'
      exit 0 ;;
    *) printf 'Bilinmeyen secenek: %s\n' "$1" >&2; exit 2 ;;
  esac
done
case "$action" in start|stop|status) ;; *) printf '%s\n' 'Gecersiz ofis komutu.' >&2; exit 2 ;; esac
command -v node >/dev/null 2>&1 || { printf '%s\n' 'Linux Node.js 24.13 veya daha yeni bir 24.x gerekli. Windows node.exe bu baslaticida kullanilmaz.' >&2; exit 1; }
node --input-type=module -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (process.platform !== "linux" || major !== 24 || minor < 13) { console.error("Linux Node.js 24.13 veya daha yeni bir 24.x gerekli; macOS henuz dogrulanmadi."); process.exit(1); }'
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec node "$script_dir/office-runtime.mjs" "$action" "$port" "$timeout"
