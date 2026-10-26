#!/usr/bin/env bash
# Env: DEPLOY_PATH, APPS_NAME, IMAGE_NAME, IMAGE_TAG
set -euo pipefail

cd "$DEPLOY_PATH"
export IMAGE_NAME
export IMAGE_TAG
export COMPOSE_IGNORE_ORPHANS=1

echo "Pull image $IMAGE_NAME:$IMAGE_TAG"
docker compose -f docker-compose.yaml --env-file .env pull "$APPS_NAME"
