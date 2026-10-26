#!/bin/sh
# Membakar variabel Vite (XXX_*) ke image, lalu push dengan tag commit.
# Nilai tidak di-log. File .env tidak masuk build context (.dockerignore).
set -eu

sh .gitlab/scripts/generate-env.sh XXX_ .env

while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    [A-Za-z_]*=*) export "$line" ;;
  esac
done < .env

for var in \
  VITE_API_BASE_URL \
  VITE_APP_KEY \
  VITE_ENCRYPTION_SECRET_KEY \
  VITE_BASE_URL
do
  eval "value=\${$var:-}"
  if [ -z "$value" ]; then
    echo "$var tidak ada. Set CI variable XXX_$var pada environment '${CI_ENVIRONMENT_NAME:-?}'."
    exit 1
  fi
done
unset value

# Opsional: QR / public URL (boleh kosong).
: "${VITE_PUBLIC_APP_URL:=}"

echo "Build $IMAGE_NAME:$CI_COMMIT_SHORT_SHA"
docker build --no-cache \
  -f "${DOCKERFILE:-Dockerfile}" \
  --build-arg VITE_API_BASE_URL \
  --build-arg VITE_APP_KEY \
  --build-arg VITE_ENCRYPTION_SECRET_KEY \
  --build-arg VITE_BASE_URL \
  --build-arg VITE_PUBLIC_APP_URL \
  --label "org.opencontainers.image.revision=$CI_COMMIT_SHA" \
  --label "org.opencontainers.image.source=$CI_PROJECT_URL" \
  -t "$IMAGE_NAME:$CI_COMMIT_SHORT_SHA" \
  .

docker push "$IMAGE_NAME:$CI_COMMIT_SHORT_SHA"
