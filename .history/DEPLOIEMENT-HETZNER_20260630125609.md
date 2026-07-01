# Guide de Déploiement — Qalami sur Hetzner + Docker

**Application** : Qalami School Manager (Next.js 16, React 19, PWA)
**Base de données** : Supabase self-hosted (PostgreSQL + GoTrue + PostgREST + Storage + Realtime)
**Infra** : Hetzner VPS, Docker Compose, Caddy reverse proxy, Cloudflare edge

---

## Table des matières

1. [Architecture cible](#1-architecture-cible)
2. [Prérequis](#2-prérequis)
3. [Provisionner le VPS Hetzner](#3-provisionner-le-vps-hetzner)
4. [Sécuriser le serveur](#4-sécuriser-le-serveur)
5. [Installer Docker](#5-installer-docker)
6. [Déployer Supabase self-hosted](#6-déployer-supabase-self-hosted)
7. [Déployer Qalami (Next.js)](#7-déployer-qalami-nextjs)
8. [Configurer Caddy (reverse proxy)](#8-configurer-caddy-reverse-proxy)
9. [Configurer Cloudflare](#9-configurer-cloudflare)
10. [Migrations de base de données](#10-migrations-de-base-de-données)
11. [Sauvegardes automatiques](#11-sauvegardes-automatiques)
12. [Mise à jour et redéploiement](#12-mise-à-jour-et-redéploiement)
13. [Monitoring et logs](#13-monitoring-et-logs)
14. [Checklist de production](#14-checklist-de-production)
15. [Dépannage](#15-dépannage)

---

## 1. Architecture cible

```
Internet ──HTTPS──► Cloudflare (DNS, WAF, DDoS) ──HTTPS──► Hetzner VPS
                                                              │
                                                        ┌─────┴─────┐
                                                        │   Caddy   │ ← seul conteneur exposé (80/443)
                                                        └─────┬─────┘
                                              ┌───────────────┼───────────────┐
                                              │               │               │
                                       ┌──────┴──────┐ ┌──────┴──────┐ ┌──────┴──────┐
                                       │   Qalami    │ │  Supabase   │ │  Supabase   │
                                       │  Next.js    │ │   Studio    │ │    API      │
                                       │  (SSR/PWA)  │ │  (optionnel)│ │ (PostgREST) │
                                       └─────────────┘ └─────────────┘ └──────┬──────┘
                                                                              │
                                                          ┌──────────────┬────┴────┬──────────────┐
                                                          │              │         │              │
                                                    ┌─────┴─────┐ ┌─────┴───┐ ┌───┴────┐ ┌──────┴──────┐
                                                    │ PostgreSQL│ │ GoTrue  │ │Storage │ │  Realtime   │
                                                    │   (DB)    │ │ (Auth)  │ │(S3/FS) │ │(WebSockets) │
                                                    └───────────┘ └─────────┘ └────────┘ └─────────────┘

                                              ════════════════════════════════════════
                                                    Réseau Docker privé (qalami-net)
                                                    Rien n'est exposé sauf via Caddy
```

**Ports exposés sur Internet** : uniquement 80 et 443 (via Caddy).

---

## 2. Prérequis

| Élément | Détail |
|---|---|
| **Compte Hetzner** | [hetzner.com/cloud](https://hetzner.com/cloud) |
| **Domaine** | ex. `qalami.mr` ou `app.qalami.mr` |
| **Compte Cloudflare** | gratuit suffit |
| **Clé SSH** | générée localement (`ssh-keygen -t ed25519`) |
| **Git** | le repo Qalami cloné localement |
| **Accès Supabase Cloud** (temporaire) | pour exporter le schéma/données si migration depuis le cloud |

### VPS recommandé

| Charge | Type Hetzner | vCPU | RAM | Disque | Prix ~€/mois |
|---|---|---|---|---|---|
| Dev / test | CX22 | 2 | 4 Go | 40 Go | ~4 € |
| Production < 500 élèves | CX32 | 4 | 8 Go | 80 Go | ~8 € |
| Production > 500 élèves | CX42 | 8 | 16 Go | 160 Go | ~16 € |

> **Recommandation pour Qalami** : CX32 (4 vCPU, 8 Go RAM) pour démarrer.

### 2.1 Créer votre clé SSH

Avant de provisionner le VPS, générez une paire de clés SSH sur votre machine locale.

#### Linux / macOS

```bash
# ed25519 est plus sécurisé et plus court que RSA 4096
ssh-keygen -t ed25519 -C "qalami-deploy" -f ~/.ssh/qalami_hetzner
# L'outil propose une passphrase — recommandé, ou Entrée pour ignorer
```

#### Windows — PowerShell (OpenSSH natif, inclus depuis Windows 10 1803)

```powershell
# Vérifier que ssh-keygen est disponible
Get-Command ssh-keygen

# Générer la clé
ssh-keygen -t ed25519 -C "qalami-deploy" -f "$env:USERPROFILE\.ssh\qalami_hetzner"
```

#### Windows — WSL ou Git Bash

```bash
ssh-keygen -t ed25519 -C "qalami-deploy" -f ~/.ssh/qalami_hetzner
```

Deux fichiers sont créés :

| Fichier | Rôle |
|---|---|
| `~/.ssh/qalami_hetzner` | **Clé privée** — ne jamais partager, ne jamais committer |
| `~/.ssh/qalami_hetzner.pub` | **Clé publique** — à copier sur Hetzner et le serveur |

#### Afficher la clé publique (à coller dans Hetzner)

```bash
cat ~/.ssh/qalami_hetzner.pub
# → ssh-ed25519 AAAA...BBBB qalami-deploy
```

#### Ajouter la clé dans Hetzner Cloud Console

1. Aller dans **Security → SSH Keys** dans [console.hetzner.cloud](https://console.hetzner.cloud)
2. Cliquer **Add SSH Key**
3. Coller le contenu de `~/.ssh/qalami_hetzner.pub`
4. Nommer la clé `qalami-deploy`
5. Lors de la création du serveur (section 3.1), sélectionner cette clé

> **Si vous oubliez d'attacher la clé à la création** : accédez au VPS via la console KVM Hetzner (onglet **Console** sur le serveur), loguez-vous en root avec le mot de passe reçu par email, puis ajoutez la clé manuellement dans `/root/.ssh/authorized_keys`.

#### Configurer le client SSH (recommandé)

Créer ou éditer `~/.ssh/config` pour ne pas retaper les options à chaque fois :

```sshconfig
Host qalami-prod
    HostName <SERVER_IP>
    User deploy
    Port 2222
    IdentityFile ~/.ssh/qalami_hetzner
    ServerAliveInterval 60
    ServerAliveCountMax 3
```

Vous pouvez alors vous connecter simplement avec :

```bash
ssh qalami-prod
# au lieu de : ssh -p 2222 -i ~/.ssh/qalami_hetzner deploy@<SERVER_IP>
```

Et transférer des fichiers avec :

```bash
rsync -avz -e 'ssh -F ~/.ssh/config' . qalami-prod:/opt/qalami/app/
scp -F ~/.ssh/config fichier.sql qalami-prod:/opt/qalami/
```

---

## 3. Provisionner le VPS Hetzner

### 3.1 Créer le serveur

1. Connectez-vous à [Hetzner Cloud Console](https://console.hetzner.cloud)
2. **Nouveau projet** → `qalami-prod`
3. **Ajouter un serveur** :
   - **Localisation** : Falkenstein (DE) ou Helsinki (FI) — le plus proche de la Mauritanie
   - **Image** : Ubuntu 24.04 LTS
   - **Type** : CX32 (ou selon votre charge)
   - **Réseau** : activer IPv4 publique
   - **Clé SSH** : coller votre clé publique
   - **Nom** : `qalami-prod-01`

4. Noter l'IP publique : `<SERVER_IP>`

### 3.2 Premier accès

```bash
ssh root@<SERVER_IP>
```

---

## 4. Sécuriser le serveur

### 4.1 Utilisateur non-root

```bash
adduser deploy
usermod -aG sudo deploy

# Copier la clé SSH
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

### 4.2 Durcir SSH

```bash
cat > /etc/ssh/sshd_config.d/hardening.conf << 'EOF'
Port 2222
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
AllowUsers deploy
EOF

systemctl restart sshd
```

> **Important** : testez la connexion `ssh -p 2222 deploy@<SERVER_IP>` dans un **autre terminal** avant de fermer la session root.

### 4.3 Pare-feu UFW

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 2222/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'
sudo ufw enable
sudo ufw status verbose
```

### 4.4 Corriger l'egress Docker (UFW bypass)

Docker modifie iptables et contourne UFW. Créer un service systemd pour corriger :

```bash
sudo cat > /etc/systemd/system/docker-ufw-fix.service << 'EOF'
[Unit]
Description=Fix Docker UFW bypass
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/bash -c 'iptables -I DOCKER-USER -i eth0 -j DROP && iptables -I DOCKER-USER -i eth0 -p tcp --dport 80 -j ACCEPT && iptables -I DOCKER-USER -i eth0 -p tcp --dport 443 -j ACCEPT && iptables -I DOCKER-USER -m state --state RELATED,ESTABLISHED -j ACCEPT'
ExecStop=/bin/bash -c 'iptables -D DOCKER-USER -i eth0 -j DROP 2>/dev/null; true'

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now docker-ufw-fix
```

### 4.5 Mises à jour automatiques

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

---

## 5. Installer Docker

```bash
# Installer Docker Engine
curl -fsSL https://get.docker.com | sh

# Ajouter l'utilisateur deploy au groupe docker
sudo usermod -aG docker deploy

# Vérifier
docker --version
docker compose version
```

Se déconnecter et reconnecter pour que le groupe prenne effet :

```bash
exit
ssh -p 2222 deploy@<SERVER_IP>
```

---

## 6. Déployer Supabase self-hosted

### 6.1 Récupérer le repo Supabase Docker

```bash
sudo mkdir -p /opt/qalami
sudo chown deploy:deploy /opt/qalami
cd /opt/qalami

git clone --depth 1 https://github.com/supabase/supabase.git supabase-docker
cd supabase-docker/docker
```

### 6.2 Générer les secrets

```bash
# Copier le fichier d'environnement
cp .env.example .env

# Générer des secrets uniques
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
ANON_KEY=$(docker run --rm supabase/gotrue:latest generate-jwt --secret "$JWT_SECRET" --claim '{"role":"anon","iss":"supabase","iat":1700000000,"exp":2000000000}' 2>/dev/null || echo "GENERATE_MANUALLY")
SERVICE_ROLE_KEY=$(docker run --rm supabase/gotrue:latest generate-jwt --secret "$JWT_SECRET" --claim '{"role":"service_role","iss":"supabase","iat":1700000000,"exp":2000000000}' 2>/dev/null || echo "GENERATE_MANUALLY")
POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '\n/+=')
DASHBOARD_PASSWORD=$(openssl rand -base64 16 | tr -d '\n/+=')
```

> **Alternative pour générer les JWT** : utiliser [supabase.com/docs/guides/self-hosting/docker#generate-api-keys](https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys) ou le script `generate-keys` fourni dans le repo.

### 6.3 Configurer le `.env` Supabase

Éditer `/opt/qalami/supabase-docker/docker/.env` :

```env
############
# Secrets
############
POSTGRES_PASSWORD=<POSTGRES_PASSWORD_GENERE>
JWT_SECRET=<JWT_SECRET_GENERE>
ANON_KEY=<ANON_KEY_GENERE>
SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY_GENERE>
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=<DASHBOARD_PASSWORD_GENERE>

############
# API
############
SITE_URL=https://app.qalami.mr
API_EXTERNAL_URL=https://api.qalami.mr
SUPABASE_PUBLIC_URL=https://api.qalami.mr

############
# Auth (GoTrue)
############
GOTRUE_SITE_URL=https://app.qalami.mr
GOTRUE_EXTERNAL_EMAIL_ENABLED=true
GOTRUE_MAILER_AUTOCONFIRM=false
GOTRUE_SMS_AUTOCONFIRM=false
GOTRUE_DISABLE_SIGNUP=false
GOTRUE_JWT_EXPIRY=3600
GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated

############
# Stockage
############
STORAGE_BACKEND=file
FILE_SIZE_LIMIT=52428800

############
# Studio (dashboard admin)
############
STUDIO_DEFAULT_ORGANIZATION=Qalami
STUDIO_DEFAULT_PROJECT=qalami-prod
STUDIO_PORT=3000

############
# Base de données
############
POSTGRES_HOST=db
POSTGRES_DB=postgres
POSTGRES_PORT=5432
```

### 6.4 Adapter le `docker-compose.yml` Supabase

Modifications clés dans `/opt/qalami/supabase-docker/docker/docker-compose.yml` :

```yaml
# Ajouter le réseau externe pour connecter Qalami
networks:
  default:
    name: qalami-net
    driver: bridge
```

**Retirer les ports exposés** de tous les services sauf si vous avez besoin d'un accès direct temporaire :

```yaml
services:
  studio:
    # Retirer ports: - "3000:3000"
    # Caddy s'en chargera
    
  kong:
    # Retirer ports: - "8000:8000" et - "8443:8443"
    # Caddy s'en chargera
```

### 6.5 Lancer Supabase

```bash
cd /opt/qalami/supabase-docker/docker
docker compose pull
docker compose up -d

# Vérifier que tout tourne
docker compose ps
```

Tous les services doivent être `healthy` ou `running` :
- `supabase-db` (PostgreSQL)
- `supabase-auth` (GoTrue)
- `supabase-rest` (PostgREST)
- `supabase-realtime`
- `supabase-storage`
- `supabase-studio` (dashboard)
- `supabase-kong` (API gateway interne)

### 6.6 Tester la connexion

```bash
# Depuis le serveur, tester l'API interne
curl http://localhost:8000/rest/v1/ \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <ANON_KEY>"
```

---

## 7. Déployer Qalami (Next.js)

### 7.1 Dockerfile

Créer `/opt/qalami/app/Dockerfile` :

```dockerfile
FROM node:22-alpine AS base

# --- Étape 1 : Installation des dépendances ---
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# --- Étape 2 : Build ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variables d'environnement pour le build (NEXT_PUBLIC_*)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# --- Étape 3 : Production ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

### 7.2 Activer le mode standalone dans Next.js

Ajouter dans `next.config.ts` :

```typescript
const nextConfig: NextConfig = {
    output: 'standalone',  // ← Ajouter cette ligne
    // ... reste de la config
};
```

### 7.3 Docker Compose pour Qalami

Créer `/opt/qalami/app/docker-compose.yml` :

```yaml
services:
  qalami:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL}
        NEXT_PUBLIC_SUPABASE_ANON_KEY: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}
    container_name: qalami-app
    restart: unless-stopped
    env_file: .env.production
    networks:
      - qalami-net
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '1.0'
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s

networks:
  qalami-net:
    external: true
```

### 7.4 Fichier `.env.production`

Créer `/opt/qalami/app/.env.production` :

```env
# Supabase — pointe vers le kong interne via le réseau Docker
NEXT_PUBLIC_SUPABASE_URL=https://api.qalami.mr
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY_GENERE>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY_GENERE>

# Next.js
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
```

### 7.5 Transférer le code et builder

```bash
# Depuis votre machine locale
rsync -avz --exclude='node_modules' --exclude='.next' --exclude='.env' \
  -e 'ssh -p 2222' \
  . deploy@<SERVER_IP>:/opt/qalami/app/

# Sur le serveur
ssh -p 2222 deploy@<SERVER_IP>
cd /opt/qalami/app
docker compose build
docker compose up -d
```

---

## 8. Configurer Caddy (reverse proxy)

### 8.1 Caddyfile

Créer `/opt/qalami/caddy/Caddyfile` :

```caddyfile
{
    email admin@qalami.mr
}

# Application principale
app.qalami.mr {
    # Headers de sécurité
    header {
        Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
        X-Frame-Options "DENY"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "camera=(), microphone=(), geolocation=()"
        -Server
        -X-Powered-By
    }

    reverse_proxy qalami-app:3000 {
        health_uri /
        health_interval 30s
    }
}

# API Supabase (PostgREST, GoTrue, Storage, Realtime)
api.qalami.mr {
    header {
        Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        -Server
    }

    reverse_proxy supabase-kong:8000 {
        health_uri /rest/v1/
        health_interval 30s
        header_up X-Forwarded-Proto {scheme}
    }
}

# Studio Supabase (dashboard admin) — accès restreint
studio.qalami.mr {
    # Restreindre par IP (optionnel)
    # @blocked not remote_ip <VOTRE_IP_ADMIN>
    # respond @blocked 403

    basicauth {
        admin <HASH_MOT_DE_PASSE>
    }

    header {
        Strict-Transport-Security "max-age=63072000"
        X-Frame-Options "DENY"
        -Server
    }

    reverse_proxy supabase-studio:3000
}
```

> **Générer le hash pour basicauth** : `docker run --rm caddy:latest caddy hash-password --plaintext 'VOTRE_MOT_DE_PASSE'`

### 8.2 Docker Compose pour Caddy

Créer `/opt/qalami/caddy/docker-compose.yml` :

```yaml
services:
  caddy:
    image: caddy:2-alpine
    container_name: qalami-caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"  # HTTP/3
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    networks:
      - qalami-net
    deploy:
      resources:
        limits:
          memory: 128M

volumes:
  caddy_data:
  caddy_config:

networks:
  qalami-net:
    external: true
```

### 8.3 Lancer Caddy

```bash
cd /opt/qalami/caddy
docker compose up -d
docker compose logs -f caddy  # vérifier que les certificats TLS sont obtenus
```

---

## 9. Configurer Cloudflare

### 9.1 Ajouter le domaine

1. Se connecter à [dash.cloudflare.com](https://dash.cloudflare.com)
2. **Add a site** → entrer `qalami.mr`
3. Choisir le plan **Free** (suffisant)
4. Cloudflare va scanner les DNS existants
5. **Changer les nameservers** chez votre registrar (ex: GoDaddy, OVH, Namecheap) :
   - Remplacer les NS actuels par ceux fournis par Cloudflare (ex: `ada.ns.cloudflare.com`, `bob.ns.cloudflare.com`)
   - Propagation : 5 min à 24h

### 9.2 DNS

Aller dans **DNS → Records** et ajouter :

| Type | Nom | Contenu | Proxy | TTL |
|---|---|---|---|---|
| A | `app` | `<SERVER_IP>` | **Proxied** (nuage orange) | Auto |
| A | `api` | `<SERVER_IP>` | **Proxied** (nuage orange) | Auto |
| A | `studio` | `<SERVER_IP>` | **Proxied** (nuage orange) | Auto |
| A | `@` | `<SERVER_IP>` | **Proxied** (nuage orange) | Auto |
| CNAME | `www` | `app.qalami.mr` | **Proxied** | Auto |

> **Important** : le nuage **orange** (Proxied) est obligatoire pour masquer l'IP du serveur. Si le nuage est **gris** (DNS only), l'IP est exposée et les protections DDoS/WAF sont désactivées.

### 9.3 SSL/TLS

Aller dans **SSL/TLS → Overview** :

- **Mode** : **Full (strict)** ← essentiel (Caddy gère les certificats côté serveur)
- Ne PAS utiliser "Flexible" (crée une boucle de redirection ou du trafic non chiffré)

Aller dans **SSL/TLS → Edge Certificates** :

| Paramètre | Valeur |
|---|---|
| **Always Use HTTPS** | ON |
| **Automatic HTTPS Rewrites** | ON |
| **Minimum TLS Version** | 1.2 |
| **TLS 1.3** | ON |
| **HSTS** | ON (max-age 6 mois, includeSubDomains) |
| **Opportunistic Encryption** | ON |

### 9.4 Sécurité — WAF

Aller dans **Security → WAF** :

#### Règles personnalisées (Custom Rules)

**Règle 1 — Géo-blocking** :

```
Nom : Geo Restrict
Si : (ip.geoip.country ne "MR") and
     (ip.geoip.country ne "FR") and
     (ip.geoip.country ne "SN") and
     (ip.geoip.country ne "ML")
Action : Managed Challenge (CAPTCHA)
```

> **Pourquoi Challenge et pas Block** : les réseaux mobiles mauritaniens (Mauritel, Mattel, Chinguitel) partagent des plages IP parfois géolocalisées dans d'autres pays. Un challenge laisse passer les vrais utilisateurs.

**Règle 2 — Protéger le Studio** :

```
Nom : Studio Admin Only
Si : (http.host eq "studio.qalami.mr") and
     (ip.src ne <VOTRE_IP_ADMIN>)
Action : Block
```

**Règle 3 — Bloquer les bots sur l'API** :

```
Nom : Bot Block API
Si : (http.request.uri.path contains "/auth/") and
     (cf.client.bot)
Action : Block
```

#### Règles gérées (Managed Rules)

- Activer **Cloudflare Managed Ruleset** (protection OWASP)
- Activer **Cloudflare OWASP Core Ruleset** en mode **Medium**

### 9.5 Rate Limiting

Aller dans **Security → WAF → Rate limiting rules** :

**Règle 1 — Auth endpoints** :

```
Nom : Rate Limit Auth
Si : URI contient /auth/
Seuil : 20 requêtes / 1 minute
Par : IP
Action : Block pendant 600 secondes (10 min)
```

**Règle 2 — API générale** :

```
Nom : Rate Limit API
Si : URI contient /rest/v1/
Seuil : 100 requêtes / 1 minute
Par : IP
Action : Block pendant 300 secondes (5 min)
```

**Règle 3 — Login brute force** :

```
Nom : Rate Limit Login
Si : URI contient /auth/v1/token et méthode = POST
Seuil : 5 requêtes / 1 minute
Par : IP
Action : Block pendant 3600 secondes (1h)
```

### 9.6 Cache

Aller dans **Caching → Cache Rules** :

**Règle 1 — Bypass API** :

```
Nom : Bypass API Cache
Si : (http.request.uri.path contains "/api/") or
     (http.request.uri.path contains "/auth/") or
     (http.request.uri.path contains "/rest/") or
     (http.request.uri.path contains "/realtime/")
Action : Bypass cache
```

**Règle 2 — Cache des assets statiques** :

```
Nom : Cache Static Assets
Si : (http.request.uri.path contains "/_next/static/") or
     (http.request.uri.path.extension in {"js" "css" "png" "jpg" "jpeg" "gif" "webp" "svg" "ico" "woff2"})
Cache TTL : 30 jours
Browser TTL : 30 jours
```

**Règle 3 — Cache Storage** :

```
Nom : Cache Storage Files
Si : (http.request.uri.path contains "/storage/")
Cache TTL : 1 heure
Browser TTL : 1 heure
```

### 9.7 Performance

Aller dans **Speed → Optimization** :

| Paramètre | Valeur |
|---|---|
| **Auto Minify** | HTML, CSS, JS |
| **Brotli** | ON |
| **Early Hints** | ON |
| **HTTP/2** | ON |
| **HTTP/3 (QUIC)** | ON |

### 9.8 Bot Fight Mode

Aller dans **Security → Bots** :

- **Bot Fight Mode** : ON
- **Block AI Scrapers** : ON (empêche les crawlers IA de scraper l'app)

### 9.9 Redirections

Aller dans **Rules → Redirect Rules** :

**Redirection racine vers app** :

```
Si : (http.host eq "qalami.mr") or (http.host eq "www.qalami.mr")
Redirection : https://app.qalami.mr (301 permanent)
```

### 9.10 Notifications Cloudflare

Aller dans **Notifications** → configurer des alertes pour :

- DDoS attack detected
- SSL certificate expiring
- Origin health check failure
- Rate limiting threshold reached

### 9.11 Vérification finale Cloudflare

Après configuration, vérifier :

```bash
# L'IP du serveur est masquée
dig +short app.qalami.mr
# → Doit retourner des IP Cloudflare (104.x.x.x), PAS votre IP Hetzner

# Le SSL est actif
curl -I https://app.qalami.mr
# → HTTP/2 200, headers de sécurité présents

# Le rate limiting fonctionne (tester avec un outil comme curl en boucle)
for i in $(seq 1 25); do curl -s -o /dev/null -w "%{http_code}\n" https://api.qalami.mr/auth/v1/health; done
# → Les dernières requêtes doivent retourner 429 ou être bloquées
```

---

## 10. Migrations de base de données

### 10.1 Importer le schéma initial

Si vous migrez depuis Supabase Cloud vers self-hosted :

```bash
# Depuis votre machine locale — exporter depuis Supabase Cloud
npx supabase db dump --db-url "postgresql://postgres:<CLOUD_PASSWORD>@db.<PROJECT_REF>.supabase.co:5432/postgres" > schema_dump.sql

# Transférer au serveur
scp -P 2222 schema_dump.sql deploy@<SERVER_IP>:/opt/qalami/

# Sur le serveur — importer dans le PostgreSQL self-hosted
cd /opt/qalami/supabase-docker/docker
docker compose exec -T db psql -U supabase_admin -d postgres < /opt/qalami/schema_dump.sql
```

### 10.2 Appliquer les migrations existantes

Les migrations se trouvent dans `supabase/migrations/` :

```bash
# Transférer les migrations
scp -P 2222 -r supabase/migrations/ deploy@<SERVER_IP>:/opt/qalami/migrations/

# Sur le serveur — appliquer dans l'ordre
cd /opt/qalami/supabase-docker/docker
for f in /opt/qalami/migrations/*.sql; do
    echo "Applying: $f"
    docker compose exec -T db psql -U supabase_admin -d postgres < "$f"
done
```

Migrations actuelles :
- `20260526_add_default_grading_scale.sql`
- `20260601_add_subject_name_ar.sql`
- `20260601_contracts_payment_method.sql`
- `20260601_create_parent_documents.sql`
- `20260610_announcements_attachment.sql`
- `20260613_staff_adjustments.sql`
- `20260613_transaction_notes.sql`

### 10.3 Futures migrations

```bash
# Créer une migration
cat > supabase/migrations/YYYYMMDD_description.sql << 'SQL'
-- Migration: description
-- Idempotente : peut être rejouée sans erreur

ALTER TABLE ... ;
SQL

# Appliquer sur le serveur
scp -P 2222 supabase/migrations/YYYYMMDD_description.sql deploy@<SERVER_IP>:/opt/qalami/migrations/
ssh -p 2222 deploy@<SERVER_IP> \
  'cd /opt/qalami/supabase-docker/docker && docker compose exec -T db psql -U supabase_admin -d postgres < /opt/qalami/migrations/YYYYMMDD_description.sql'
```

---

## 11. Sauvegardes automatiques

### 11.1 Script de sauvegarde

Créer `/opt/qalami/scripts/backup.sh` :

```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/opt/qalami/backups"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
COMPOSE_DIR="/opt/qalami/supabase-docker/docker"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Début sauvegarde..."

# Dump PostgreSQL
docker compose -f "$COMPOSE_DIR/docker-compose.yml" exec -T db \
    pg_dump -U supabase_admin -d postgres --clean --if-exists | \
    gzip > "$BACKUP_DIR/qalami-db-$TIMESTAMP.sql.gz"

# Sauvegarder les volumes Storage (fichiers uploadés)
docker run --rm \
    -v supabase_storage:/data:ro \
    -v "$BACKUP_DIR":/backup \
    alpine tar czf "/backup/qalami-storage-$TIMESTAMP.tar.gz" -C /data .

# Sauvegarder les fichiers .env
tar czf "$BACKUP_DIR/qalami-env-$TIMESTAMP.tar.gz" \
    "$COMPOSE_DIR/.env" \
    /opt/qalami/app/.env.production \
    /opt/qalami/caddy/Caddyfile

# Rotation — supprimer les backups > 30 jours
find "$BACKUP_DIR" -name "qalami-*" -mtime +$RETENTION_DAYS -delete

SIZE=$(du -sh "$BACKUP_DIR/qalami-db-$TIMESTAMP.sql.gz" | cut -f1)
echo "[$(date)] Sauvegarde terminée : $SIZE"
```

```bash
chmod +x /opt/qalami/scripts/backup.sh
```

### 11.2 Cron automatique

```bash
# Sauvegarde quotidienne à 3h du matin
crontab -e
```

Ajouter :

```cron
0 3 * * * /opt/qalami/scripts/backup.sh >> /opt/qalami/logs/backup.log 2>&1
```

### 11.3 Restauration

```bash
# Restaurer la DB
gunzip -c /opt/qalami/backups/qalami-db-YYYYMMDD-HHMMSS.sql.gz | \
    docker compose -f /opt/qalami/supabase-docker/docker/docker-compose.yml exec -T db \
    psql -U supabase_admin -d postgres
```

---

## 12. Mise à jour et redéploiement

### 12.1 Playbook de déploiement (Qalami)

```bash
#!/bin/bash
# deploy-qalami.sh — à exécuter depuis votre machine locale
set -euo pipefail

SERVER="deploy@<SERVER_IP>"
SSH="ssh -p 2222 $SERVER"
SCP="scp -P 2222"

echo "=== 1. Vérification locale ==="
npx tsc --noEmit
npm run build  # vérifier que le build passe localement

echo "=== 2. Backup sur le serveur ==="
$SSH '/opt/qalami/scripts/backup.sh'

echo "=== 3. Synchronisation du code ==="
rsync -avz --exclude='node_modules' --exclude='.next' --exclude='.env' \
    -e 'ssh -p 2222' \
    . $SERVER:/opt/qalami/app/

echo "=== 4. Build + redémarrage ==="
$SSH 'cd /opt/qalami/app && docker compose build && docker compose up -d'

echo "=== 5. Vérification ==="
sleep 10
$SSH 'docker compose -f /opt/qalami/app/docker-compose.yml ps'
$SSH 'curl -sf http://localhost:3000 > /dev/null && echo "✓ App OK" || echo "✗ App DOWN"'

echo "=== Déploiement terminé ==="
```

### 12.2 Mise à jour Supabase

```bash
cd /opt/qalami/supabase-docker/docker

# Backup d'abord
/opt/qalami/scripts/backup.sh

# Tirer les nouvelles images
git pull
docker compose pull

# Redémarrer
docker compose up -d

# Vérifier
docker compose ps
docker compose logs --tail=50
```

### 12.3 Rollback

```bash
# Rollback Qalami — revenir à l'image précédente
cd /opt/qalami/app
docker compose down
# Restaurer le code précédent depuis git ou backup
docker compose build
docker compose up -d

# Rollback DB
gunzip -c /opt/qalami/backups/qalami-db-<PREDEPLOY>.sql.gz | \
    docker compose -f /opt/qalami/supabase-docker/docker/docker-compose.yml exec -T db \
    psql -U supabase_admin -d postgres
```

---

## 13. Monitoring et logs

### 13.1 Logs des services

```bash
# Tous les logs Supabase
cd /opt/qalami/supabase-docker/docker
docker compose logs -f --tail=100

# Logs d'un service spécifique
docker compose logs -f db          # PostgreSQL
docker compose logs -f auth        # GoTrue (authentification)
docker compose logs -f rest        # PostgREST (API)
docker compose logs -f realtime    # WebSockets
docker compose logs -f storage     # Storage

# Logs Qalami
docker logs -f qalami-app

# Logs Caddy
docker logs -f qalami-caddy
```

### 13.2 Surveillance disque et mémoire

```bash
# Espace disque
df -h

# Mémoire par conteneur
docker stats --no-stream

# Taille des volumes Docker
docker system df -v
```

### 13.3 Healthcheck rapide

Créer `/opt/qalami/scripts/healthcheck.sh` :

```bash
#!/bin/bash
echo "=== État des conteneurs ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "=== Tests de connectivité ==="
curl -sf http://localhost:3000 > /dev/null && echo "✓ Qalami (Next.js)" || echo "✗ Qalami DOWN"
curl -sf http://localhost:8000/rest/v1/ -H "apikey: $ANON_KEY" > /dev/null && echo "✓ PostgREST API" || echo "✗ PostgREST DOWN"
curl -sf https://app.qalami.mr > /dev/null && echo "✓ Domaine public" || echo "✗ Domaine DOWN"

echo ""
echo "=== Ressources ==="
echo "Disque : $(df -h / | tail -1 | awk '{print $5 " utilisé"}')"
echo "RAM    : $(free -h | awk '/^Mem:/{print $3 "/" $2}')"
```

---

## 14. Checklist de production

### Avant le premier déploiement

- [ ] VPS créé avec clé SSH (pas de mot de passe root)
- [ ] Utilisateur `deploy` créé, SSH durci (port 2222, clé only)
- [ ] UFW activé (80, 443, 2222 uniquement)
- [ ] Fix egress Docker installé et actif
- [ ] Docker + Docker Compose installés
- [ ] Réseau Docker `qalami-net` créé

### Supabase

- [ ] `.env` avec des secrets uniques générés (JWT, passwords)
- [ ] Tous les services `healthy` (db, auth, rest, realtime, storage, kong)
- [ ] Schéma importé depuis le cloud (ou créé)
- [ ] Toutes les migrations appliquées
- [ ] RLS (Row Level Security) activé sur toutes les tables
- [ ] `service_role_key` utilisé uniquement côté serveur (server actions)
- [ ] Studio protégé par basicauth + IP whitelist

### Qalami (Next.js)

- [ ] `output: 'standalone'` dans `next.config.ts`
- [ ] Dockerfile multi-stage fonctionnel
- [ ] `.env.production` avec les bonnes clés Supabase
- [ ] `NEXT_PUBLIC_SUPABASE_URL` pointe vers `https://api.qalami.mr`
- [ ] Build Docker réussi
- [ ] PWA (service worker) fonctionne en HTTPS
- [ ] Headers CSP adaptés aux nouveaux domaines

### Caddy

- [ ] Certificats TLS obtenus automatiquement
- [ ] Headers de sécurité appliqués
- [ ] Reverse proxy vers `qalami-app:3000` et `supabase-kong:8000`
- [ ] Studio protégé

### Cloudflare

- [ ] DNS A records pour `app`, `api`, `studio` — tous proxied
- [ ] SSL Full (strict)
- [ ] WAF + géo-blocking configurés
- [ ] Rate limiting sur `/auth/` et `/rest/`
- [ ] Cache bypass sur les routes API

### Ops

- [ ] Script de backup fonctionnel et testé
- [ ] Cron de backup quotidien actif
- [ ] Restauration testée au moins une fois
- [ ] Script de déploiement prêt
- [ ] Mises à jour automatiques Ubuntu activées

---

## 15. Dépannage

### Le build Next.js échoue dans Docker

```bash
# Vérifier les logs de build
docker compose build --no-cache qalami 2>&1 | tail -50

# Cause fréquente : mémoire insuffisante
# → Ajouter du swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Supabase Auth ne marche pas

```bash
# Vérifier les logs GoTrue
docker compose -f /opt/qalami/supabase-docker/docker/docker-compose.yml logs auth

# Causes fréquentes :
# - GOTRUE_SITE_URL incorrect
# - JWT_SECRET différent entre les services
# - API_EXTERNAL_URL ne pointe pas vers le bon domaine
```

### Caddy ne démarre pas (certificats)

```bash
# Vérifier les logs
docker logs qalami-caddy

# Causes fréquentes :
# - DNS pas encore propagé (attendre 5 min)
# - Cloudflare en mode "Flexible" au lieu de "Full (strict)"
# - Port 80 bloqué (challenge HTTP-01)
```

### La DB est lente

```bash
# Vérifier les connexions actives
docker compose -f /opt/qalami/supabase-docker/docker/docker-compose.yml exec db \
    psql -U supabase_admin -d postgres -c "SELECT count(*) FROM pg_stat_activity;"

# Vérifier les requêtes lentes
docker compose -f /opt/qalami/supabase-docker/docker/docker-compose.yml exec db \
    psql -U supabase_admin -d postgres -c "SELECT pid, now()-query_start AS duration, query FROM pg_stat_activity WHERE state='active' ORDER BY duration DESC LIMIT 10;"
```

### Espace disque plein

```bash
# Nettoyer les images Docker inutilisées
docker system prune -af --volumes

# Vérifier les backups
du -sh /opt/qalami/backups/*
```

---

## Structure des fichiers sur le serveur

```
/opt/qalami/
├── app/                          # Code source Qalami
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── .env.production
│   ├── src/
│   ├── package.json
│   └── next.config.ts
├── supabase-docker/              # Supabase self-hosted
│   └── docker/
│       ├── docker-compose.yml
│       ├── .env
│       └── volumes/
├── caddy/                        # Reverse proxy
│   ├── docker-compose.yml
│   └── Caddyfile
├── scripts/                      # Scripts d'opérations
│   ├── backup.sh
│   ├── deploy-qalami.sh
│   └── healthcheck.sh
├── migrations/                   # Migrations SQL
│   └── *.sql
├── backups/                      # Dumps DB + storage
│   └── *.sql.gz
└── logs/                         # Logs des scripts
    └── backup.log
```

---

*Document spécifique à Qalami. Basé sur le blueprint générique `BLUEPRINT-STACK-SECURISE.md`.
Dernière mise à jour : 2026-06-26.*
