# Environments & CI/CD — cuti-frontend

## Struktur pipeline

```
.gitlab-ci.yml                 # stages, variable global, workflow (pemetaan env), include
.gitlab/ci/
  templates.yml                # rules, quality gate, .node_job, .docker_job, .remote_job
  quality.yml                  # eslint-lint, unit-test, build-sonar, clamav-scan
  build.yml                    # build_image -> scan_image -> publish_image
  deploy.yml                   # prepare_release -> deploy_application
.gitlab/scripts/
  ssh-setup.sh                 # di-source: ssh-agent, known_hosts, remote_run/remote_copy
  generate-env.sh              # CI variable ber-prefix -> file .env
  build-image.sh               # bakar XXX_VITE_* ke image, push tag commit
  remote/pull-image.sh         # docker compose pull di server
  remote/deploy-app.sh         # compose scale / swarm start-first, plus rollback
```

Frontend statis (Vite + Nginx). Tidak ada Postgres, Prisma, atau Kong.
Ingress memakai Traefik lewat label di file Compose.

## Alur job

```
eslint-lint ─┐
unit-test ───┼─ sonar + clamav (main saja) ─ build_image → scan_image → publish_image
             │                                        │
             │                                        v
             │                              prepare_release → deploy_application
```

Merge request hanya menjalankan `eslint-lint` dan `unit-test`.
Branch `development` deploy tanpa lint, test, Sonar, dan ClamAV.
`main` dan git tag menjalankan lint serta test, lalu deploy. Sonar dan ClamAV hanya di `main`.

`eslint-lint` saat ini placeholder (belum ada ESLint di repo); kualitas utama lewat `unit-test` (Vitest).

## Environment

| Environment | Trigger | Deploy mode | Target app | Compose file | Image tag | URL |
|---|---|---|---|---|---|---|
| development | push `development` | compose | `$DEV_IP` | `docker-compose.yaml` | `$CI_COMMIT_SHORT_SHA` | https://development.inalum.id/cuti |
| staging | push `main` | compose | `$STAGING_IP` | `docker-compose.yaml` | `$CI_COMMIT_SHORT_SHA` | https://staging.inalum.id/cuti |
| production | push tag | swarm | `$PROD_IP` | `docker-swarm.yaml` | `$CI_COMMIT_SHORT_SHA` | https://sicuti.inalum.id |

Image di-push ke registry dengan tag commit (`<short-sha>`), di-scan Trivy, lalu tag itu yang di-deploy.
Pipeline git tag juga men-push alias `<git tag>` setelah scan; deploy dan rollback tetap memakai short SHA.
Tag bergerak (`development`, `staging`, `latest`) tidak di-push.

Development dan staging memakai file Compose yang sama. Host dan prefix Traefik datang dari workflow `.gitlab-ci.yml`:

| Environment | `TRAEFIK_HOST` | `TRAEFIK_PREFIX` |
|---|---|---|
| development | `development.inalum.id` | `/cuti` |
| staging | `staging.inalum.id` | `/cuti` |

`prepare_release` menulis kedua nilai itu ke `.env` di server. Compose menginterpolasinya ke label Traefik.
Production memakai `docker-swarm.yaml` dengan host `sicuti.inalum.id` tanpa prefix path.

Nginx mem-proxy `/api` (dan `/cuti/api`) ke `BACKEND_URL` dari workflow, dengan strip prefix `/api` seperti Vite lokal:

| Environment | `BACKEND_URL` |
|---|---|
| development | `https://devapi.inalum.id/cuti` |
| staging | `https://stagingapi.inalum.id/cuti` |
| production | `https://rest.inalum.id/cuti` |

Bundle memakai `VITE_API_BASE_URL=/api` agar request browser tetap same-origin ke Nginx, lalu di-forward ke Kong/backend.
Nilai `VITE_*` dibakar saat `docker build`; `BACKEND_URL` runtime di container Nginx.

## Rollback

Sebelum ganti image, tag commit yang sedang berjalan disimpan di `/home/deploy/cuti-frontend/.previous-image`.
Swarm memakai update `start-first` dan `failure_action: rollback` (2 replika).
Compose menaikkan container baru lebih dulu (`--scale 2`) dan mematikan yang lama hanya setelah healthcheck lulus.
Jika rilis baru gagal, deploy mengembalikan tag di `.previous-image` dan job CI gagal.

Healthcheck memanggil `curl` ke `http://127.0.0.1/` di dalam container Nginx.

## CI/CD variables

Simpan di Settings → CI/CD → Variables. Variable `XXX_*` di-scope per environment (`development`, `staging`, `production`).

| Nama | Wajib | Masked/Protected | Keterangan |
|---|---|---|---|
| `REGISTRY_URL`, `REGISTRY_USER`, `REGISTRY_PASSWORD` | ya | password: masked | Registry internal |
| `SSH_PRIVATE_KEY` | ya | protected | Key user deploy |
| `SSH_KNOWN_HOSTS` | disarankan | - | Output `ssh-keyscan` semua server |
| `DEPLOYER` | ya | - | User SSH di server |
| `DEV_IP`, `STAGING_IP`, `PROD_IP` | ya | - | Alamat server app |
| `SONAR_HOST_URL`, `SONAR_TOKEN` | ya (main) | token: masked | SonarQube |
| `XXX_VITE_API_BASE_URL` | ya | - | Path API di browser; gunakan `/api` (Nginx proxy) |
| `XXX_VITE_APP_KEY` | ya | masked | Harus sama dengan `API_TOKEN` backend |
| `XXX_VITE_ENCRYPTION_SECRET_KEY` | ya | masked | 32 karakter untuk enkripsi localStorage |
| `XXX_VITE_BASE_URL` | ya | - | Base path Vite. Dev/staging: `/cuti/`. Production: `/` |
| `XXX_VITE_PUBLIC_APP_URL` | tidak | - | URL publik untuk QR surat cuti |
| `DOCKERFILE` | tidak | - | Default `Dockerfile` |

`BACKEND_URL` diisi dari workflow `.gitlab-ci.yml` (bukan CI variable manual) dan ditulis ke `.env` server saat `prepare_release`.

Jangan commit nilai variable di atas.

## Server

- Folder deploy: `/home/deploy/cuti-frontend`.
- Network external: `global-network` di Compose dan Swarm.
- Production harus Swarm manager.
- Compose tidak memakai `container_name`, supaya scale dan rollback bisa menjalankan dua container sekaligus.

## Runner

- Job docker memakai socket host (`/var/run/docker.sock`).
- `GIT_SSL_NO_VERIFY=1` karena sertifikat GitLab internal.
