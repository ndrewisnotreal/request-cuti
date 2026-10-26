#!/bin/sh
# Usage: sh generate-env.sh <PREFIX> <OUTPUT_FILE>
# Menulis CI variable ber-prefix ke file tanpa prefix. Hanya nama key yang di-log.
set -eu

prefix="$1"
output="$2"

umask 077
printenv | grep "^${prefix}" | sed "s/^${prefix}//" > "$output" || true

if [ ! -s "$output" ]; then
  echo "Tidak ada variable ${prefix}* untuk environment '${CI_ENVIRONMENT_NAME:-?}'."
  exit 1
fi

echo "$output dibuat dengan key:"
sed 's/=.*//' "$output"
