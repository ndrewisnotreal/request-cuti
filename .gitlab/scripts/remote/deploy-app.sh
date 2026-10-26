#!/usr/bin/env bash
# Env: DEPLOY_PATH, APPS_NAME, DEPLOY_MODE, IMAGE_TAG, IMAGE_NAME
set -euo pipefail

cd "$DEPLOY_PATH"
export IMAGE_TAG
export COMPOSE_IGNORE_ORPHANS=1

COMPOSE_FILE_APP="docker-compose.yaml"
PREVIOUS_FILE=".previous-image"
SWARM_SERVICE="${APPS_NAME}_${APPS_NAME}"

for file in .env "$COMPOSE_FILE_APP"; do
  if [ ! -f "$file" ]; then
    echo "File $file tidak ditemukan di $DEPLOY_PATH"
    exit 1
  fi
done

image_tag_of() {
  local ref="${1%@*}"
  printf '%s' "${ref##*:}"
}

save_previous_tag() {
  local image="$1"
  if [ -z "$image" ]; then
    rm -f "$PREVIOUS_FILE"
    echo "Tidak ada image sebelumnya (deploy pertama)"
    return
  fi
  image_tag_of "$image" > "$PREVIOUS_FILE"
  echo "Image berjalan: $IMAGE_NAME:$(cat "$PREVIOUS_FILE")"
}

rollback() {
  local prev=""
  if [ -s "$PREVIOUS_FILE" ]; then
    prev=$(cat "$PREVIOUS_FILE")
  fi
  if [ -z "$prev" ] || [ "$prev" = "$IMAGE_TAG" ]; then
    echo "Rollback tidak bisa dijalankan (tidak ada tag commit sebelumnya)"
    return 1
  fi
  echo "Rollback ke $IMAGE_NAME:$prev"
  IMAGE_TAG="$prev"
  export IMAGE_TAG
  if [ "$DEPLOY_MODE" = "swarm" ]; then
    docker service update --detach=false --with-registry-auth \
      --update-order start-first --update-parallelism 1 \
      --update-failure-action rollback \
      --image "$IMAGE_NAME:$prev" \
      "$SWARM_SERVICE"
  else
    docker compose -f "$COMPOSE_FILE_APP" --env-file .env up -d --no-deps "$APPS_NAME"
  fi
}

wait_healthy() {
  local id="$1"
  local status health
  for _ in $(seq 1 24); do
    status=$(docker inspect -f '{{.State.Status}}' "$id" 2>/dev/null || echo missing)
    health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$id" 2>/dev/null || echo missing)
    echo "$id status=$status health=$health"
    if [ "$status" = "running" ] && [ "$health" = "healthy" ]; then
      return 0
    fi
    if [ "$status" = "exited" ] || [ "$status" = "dead" ] || [ "$health" = "unhealthy" ]; then
      return 1
    fi
    sleep 5
  done
  return 1
}

deploy_compose() {
  echo "Deploy via Docker Compose (image $IMAGE_TAG)"
  local old_ids old_image new_id
  old_ids=$(docker compose -f "$COMPOSE_FILE_APP" --env-file .env ps -q "$APPS_NAME" || true)
  if [ -z "$old_ids" ]; then
    docker compose -f "$COMPOSE_FILE_APP" --env-file .env up -d --no-deps "$APPS_NAME"
    new_id=$(docker compose -f "$COMPOSE_FILE_APP" --env-file .env ps -q "$APPS_NAME")
    wait_healthy "$new_id" || { docker logs --tail 100 "$new_id" || true; exit 1; }
    return
  fi

  old_image=$(docker inspect -f '{{.Config.Image}}' "$(printf '%s\n' "$old_ids" | head -1)")
  save_previous_tag "$old_image"

  docker compose -f "$COMPOSE_FILE_APP" --env-file .env up -d --no-deps \
    --scale "$APPS_NAME=2" --no-recreate "$APPS_NAME"

  new_id=""
  for id in $(docker compose -f "$COMPOSE_FILE_APP" --env-file .env ps -q "$APPS_NAME"); do
    if ! printf '%s\n' "$old_ids" | grep -qx "$id"; then
      new_id="$id"
    fi
  done
  if [ -z "$new_id" ]; then
    echo "Container baru tidak terbentuk. Container lama tetap melayani."
    exit 1
  fi
  if ! wait_healthy "$new_id"; then
    docker logs --tail 100 "$new_id" || true
    docker rm -f "$new_id"
    echo "Container baru tidak sehat dan sudah dihapus. Traffic tetap ke image sebelumnya."
    exit 1
  fi

  for id in $old_ids; do
    docker stop "$id" >/dev/null
    docker rm "$id" >/dev/null
  done
  docker compose -f "$COMPOSE_FILE_APP" --env-file .env up -d --no-deps \
    --scale "$APPS_NAME=1" --no-recreate "$APPS_NAME"
}

deploy_swarm() {
  echo "Deploy via Docker Swarm (image $IMAGE_TAG)"
  if ! docker info --format '{{.Swarm.LocalNodeState}} {{.Swarm.ControlAvailable}}' | grep -q '^active true$'; then
    echo "Server bukan Swarm manager"
    exit 1
  fi

  local current
  current=$(docker service inspect -f '{{.Spec.TaskTemplate.ContainerSpec.Image}}' "$SWARM_SERVICE" 2>/dev/null || true)
  save_previous_tag "$current"

  local resolved
  resolved=$(mktemp)
  trap 'rm -f "$resolved"' EXIT
  docker compose -f "$COMPOSE_FILE_APP" --env-file .env config > "$resolved"
  sed -i '/^name:/d' "$resolved"

  docker stack deploy --with-registry-auth -c "$resolved" "$APPS_NAME"

  local state
  for _ in $(seq 1 36); do
    state=$(docker service inspect -f '{{if .UpdateStatus}}{{.UpdateStatus.State}}{{else}}completed{{end}}' "$SWARM_SERVICE" 2>/dev/null || echo missing)
    echo "Update status: $state"
    case "$state" in
      completed) break ;;
      paused|rollback_paused|rollback_completed)
        rollback || true
        exit 1
        ;;
    esac
    sleep 5
  done

  current=$(docker service inspect -f '{{.Spec.TaskTemplate.ContainerSpec.Image}}' "$SWARM_SERVICE")
  if [ "$(image_tag_of "$current")" != "$IMAGE_TAG" ]; then
    echo "Service tidak berjalan di $IMAGE_TAG (sekarang $(image_tag_of "$current"))"
    rollback || true
    exit 1
  fi
  docker stack services "$APPS_NAME"
}

case "$DEPLOY_MODE" in
  compose) deploy_compose ;;
  swarm) deploy_swarm ;;
  *)
    echo "Unknown DEPLOY_MODE: $DEPLOY_MODE"
    exit 1
    ;;
esac

echo "Deploy $APPS_NAME:$IMAGE_TAG selesai"
