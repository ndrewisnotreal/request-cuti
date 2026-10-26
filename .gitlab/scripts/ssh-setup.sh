# Di-source (bukan dieksekusi) agar ssh-agent dan helper tetap ada di shell job.
# Wajib: SSH_HOST, DEPLOYER, SSH_PRIVATE_KEY
# Opsional: SSH_KNOWN_HOSTS

for _var in SSH_HOST DEPLOYER SSH_PRIVATE_KEY; do
  eval "_val=\${$_var:-}"
  if [ -z "$_val" ]; then
    echo "Variable $_var kosong. Cek CI/CD variables untuk environment '${ENV_NAME:-?}'."
    exit 1
  fi
done
unset _var _val

mkdir -p ~/.ssh
chmod 700 ~/.ssh
eval "$(ssh-agent -s)" >/dev/null
printf '%s\n' "$SSH_PRIVATE_KEY" | tr -d '\r' | ssh-add - >/dev/null

if [ -n "${SSH_KNOWN_HOSTS:-}" ]; then
  printf '%s\n' "$SSH_KNOWN_HOSTS" > ~/.ssh/known_hosts
else
  echo "SSH_KNOWN_HOSTS tidak di-set, fallback ke ssh-keyscan."
  ssh-keyscan -H "$SSH_HOST" >> ~/.ssh/known_hosts 2>/dev/null
fi
chmod 644 ~/.ssh/known_hosts

remote_run() {
  _script="$1"
  shift
  _env=""
  for _kv in "$@"; do
    _key="${_kv%%=*}"
    _value=$(printf '%s' "${_kv#*=}" | sed "s/'/'\\\\''/g")
    _env="$_env $_key='$_value'"
  done
  ssh "$DEPLOYER@$SSH_HOST" "env$_env bash -s" < "$_script"
}

remote_copy() {
  scp -q "$1" "$DEPLOYER@$SSH_HOST:$2"
}

remote_docker_login() {
  printf '%s' "$REGISTRY_PASSWORD" \
    | ssh "$DEPLOYER@$SSH_HOST" "docker login '$REGISTRY_URL' -u '$REGISTRY_USER' --password-stdin"
}
