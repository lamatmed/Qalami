# Blueprint — Stack web sécurisée, déployée en minutes avec une IA (Claude Code / Cursor)

**Référence générique ADST.** Un même modèle d'architecture pour *toutes* nos apps :
sécurisé par défaut, peu coûteux, et **implémentable/maintenable en pilotant une IA de code**
(Claude Code ou Cursor) plutôt qu'à la main. Aucune valeur spécifique à un projet — tout est en
placeholders (`<app>`, `<domain>`, `<SERVER_IP>`).

---

## 1. Philosophie

- **Defense in depth** : plusieurs couches indépendantes (edge → proxy → app → données).
- **Une seule surface publique** : un domaine, un reverse proxy ; tout le reste est privé.
- **Reproductible** : tout est du code/config (Compose, Caddyfile, `.env`) → versionnable.
- **Piloté par IA** : on **décrit l'intention**, l'agent génère la config, applique, vérifie,
  corrige. Le rôle humain = **valider et autoriser**, pas taper la plomberie.

---

## 2. Architecture de référence (générique)

```
 Utilisateur ──HTTPS──►  CLOUDFLARE  ──HTTPS──►  CADDY  ──►  app sur réseau Docker privé
                         (edge: DNS,            (TLS auto,    ┌───────────────┐
                          WAF, geo,              headers,     │ frontend      │
                          rate-limit,            health-check)│ backend (API) │
                          cache, anti-DDoS,                   │ db + pooler   │
                          masque l'IP origine)                │ services aux. │
                                                              └───────────────┘
                         ▲ Pare-feu (UFW): seuls 80/443 + SSH ouverts
```

**3 anneaux de sécurité** : (1) **Cloudflare** filtre au bord, (2) **Caddy + UFW** verrouillent
le serveur, (3) l'**application** authentifie/autorise chaque requête.

---

## 3. Composants techniques & leur utilité

| Composant | Rôle | Pourquoi (utilité) |
|---|---|---|
| **VPS** (Hetzner / autre) | machine hôte | peu cher, perf prévisible, contrôle total (vs PaaS opaque) |
| **Ubuntu LTS** | OS | stable, support long, écosystème Docker natif |
| **Docker + Compose** | conteneurisation | environnement reproductible, isolation, 1 fichier = toute la stack |
| **Réseau Docker privé** | réseau interne | DB/API/services **invisibles d'Internet** ; communication par nom de service |
| **Caddy** | reverse proxy | **TLS auto (Let's Encrypt)**, headers de sécurité, health-check, routage same-origin — zéro config TLS manuelle |
| **Cloudflare** | edge / CDN / WAF | masque l'IP origine, **anti-DDoS**, **geo-blocking**, rate-limit, cache, challenge bots |
| **Frontend** (Next.js, etc.) | UI | servi par Caddy ; build statique/SSR |
| **Backend** (Node/Express, etc.) | API | logique métier + sécurité applicative ; tourne en **cluster** (multi-cœurs) |
| **PostgreSQL** | base de données | fiable, transactions, jamais exposée publiquement |
| **PgBouncer** | pool de connexions | encaisse beaucoup d'utilisateurs sans épuiser les connexions PG |
| **UFW** | pare-feu hôte | deny-by-default ; n'ouvre que 80/443 + SSH |
| **`.env`** | secrets | clés/mots de passe hors du code et hors git |
| **Service de backup** | dumps DB + rotation | restauration rapide ; filet avant chaque déploiement |
| **(optionnel) passerelles** | email/SMS/WhatsApp… | notifications/OTP via conteneur dédié sur le réseau privé |

---

## 4. Les couches de sécurité & leur utilité

**Au bord (Cloudflare)**
- **DNS proxifié** (orange) → IP origine cachée, trafic forcé via CF.
- **SSL/TLS Full (strict)** → chiffré de bout en bout (CF↔origine validé).
- **WAF / règles géographiques** → n'autoriser que les pays visés (challenge plutôt que block si réseaux mobiles partagés).
- **Rate limiting edge** → absorbe le flood avant qu'il n'atteigne le serveur.
- **Bot Fight / challenge** → filtre les bots ; **bypass cache sur `/api/*`**.

**Sur le serveur (Caddy + UFW)**
- **TLS automatique** + renouvellement (Caddy).
- **Headers** : HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options`, CSP, `Referrer-Policy`, `Permissions-Policy`, masquage bannière.
- **UFW** : entrée fermée sauf 80/443 + SSH (port custom, par clé, whitelist IP).
- **Réseau Docker privé** : seul le proxy publie des ports.

**Dans l'application**
- **JWT** access court + refresh httpOnly + **session unique** + détection de réutilisation de token.
- **Clé d'API de session (HMAC, TTL court)** exigée sur les routes protégées.
- **Origin enforcement + header anti-CSRF** sur les requêtes mutantes ; **CORS strict**.
- **Rate-limit applicatif** keyé sur l'utilisateur (et la *vraie* IP client derrière le CDN).
- **Ressources privées (médias/fichiers)** via **URL signées** liées à l'utilisateur (anti-scraping).
- **Whitelist IP** pour l'admin ; **journal d'audit** (forensique).
- **Validation des entrées** + migrations **idempotentes** côté DB.

> Chaque couche est indépendante : si l'une tombe, les autres tiennent.

---

## 5. ⭐ Implémentation FACILE avec Claude Code / Cursor

L'intérêt majeur : **on ne tape pas cette stack à la main**. On **décrit l'objectif**, l'agent
IA génère les fichiers, se connecte au serveur, applique, vérifie et corrige en boucle.

### Ce que l'IA produit pour toi (à partir d'une simple demande)
| Demande type | Ce que l'agent génère/fait |
|---|---|
| « Mets en place la stack Docker » | `docker-compose.yml` (réseau privé, volumes, limites mémoire), `Dockerfile`s, `.env.example` |
| « Configure le reverse proxy » | `Caddyfile` (TLS auto, headers, health-check, same-origin `/api`) |
| « Sécurise l'API » | middleware rate-limit, clé HMAC, origin/CORS, JWT, URLs signées |
| « Durcis le serveur » | script UFW, SSH hardening, **fix egress Docker (systemd)** |
| « Déploie en prod » | backup → `scp` → `docker compose build && up -d` → vérif `/health` |
| « Diagnostique X » | lit logs/DB/iptables, isole la cause, propose+applique le correctif |

### La boucle de travail (humain ↔ IA)
```
1. Tu décris l'intention            →  « ajoute un endpoint X protégé + déploie »
2. L'agent code + typecheck local   →  (gate 1: tsc / build)
3. Il te montre le diff / le plan   →  tu valides
4. Il backup + push + build serveur →  (gate 2: build Docker = pas de downtime si échec)
5. Il vérifie (health, logs, data)  →  rapport clair
6. Itération si besoin              →  même boucle, secondes/minutes
```

### Pourquoi c'est rapide ET sûr
- **Deux barrières de build** (typecheck local + build conteneur) avant toute bascule.
- **Backup automatique** avant chaque opération ; **rollback** = restaurer le `.bak`/dump ou
  retagger l'ancienne image.
- **L'agent lit l'état réel** (prod ≠ code local) et **diff avant d'écraser** → pas de
  régression silencieuse.
- **Traçabilité** : chaque action est explicite et journalisée.
- **Tu restes décideur** : l'agent demande l'autorisation avant un déploiement / une opération
  destructive.

### Claude Code vs Cursor (rôles)
- **Cursor** : excellent pour **écrire/éditer** le code et la config dans l'éditeur (autocomplétion, refactor, génération de fichiers).
- **Claude Code** : excellent pour **l'agentique bout-en-bout** — exécuter des commandes, se
  connecter en SSH, lancer Docker, appliquer des migrations, lire les logs, **déployer et
  vérifier**. C'est l'outil « DevOps en langage naturel ».
> En pratique : Cursor pour le gros du dev local, Claude Code pour **opérer la prod**.

### Exemples de prompts (réutilisables)
- « Génère un `docker-compose.yml` : frontend, backend Node en cluster, Postgres, pgbouncer,
  Caddy ; réseau privé ; seul Caddy expose 80/443 ; volumes persistants ; limites mémoire. »
- « Écris un `Caddyfile` same-origin : `/api/*` et `/recordings/*` → backend, le reste →
  frontend ; TLS auto ; headers HSTS/CSP/X-Frame ; health-check `/api/health`. »
- « Ajoute un rate-limit CGNAT-safe (clé = vraie IP via `CF-Connecting-IP`), une clé API HMAC de
  session, et l'origin enforcement anti-CSRF. »
- « Durcis le serveur : UFW deny-in + 80/443 + SSH whitelisté, et corrige l'egress Docker via un
  service systemd. »
- « Déploie le backend en prod : backup DB + fichier, scp, `docker compose build backend && up
  -d`, puis vérifie `/api/health` et que les compteurs n'ont pas bougé. »

---

## 6. Flux de déploiement générique (le « playbook »)

```bash
# 0. Aligner : diff prod ↔ local (le serveur n'est pas git → ne pas écraser un hotfix)
ssh <user>@<host> 'cat /opt/<app>/<file>' | diff - <file>

# 1. Gate local
npx tsc --noEmit            # back ET front

# 2. Backup (silencieux)
ssh ... 'cd /opt/<app> && docker exec <app>-postgres-1 pg_dump -U <u> -d <db> | gzip > backups/predeploy-$(date +%F-%H%M%S).sql.gz'

# 3. Transférer + (migrations si besoin)
scp <file> <user>@<host>:/opt/<app>/<file>
ssh ... 'docker exec -i <app>-postgres-1 psql -U <u> -d <db> < backend/sql/migration_vNN.sql'

# 4. Build (= gate 2) + bascule sans downtime
ssh ... 'cd /opt/<app> && docker compose build backend frontend && docker compose up -d backend frontend'

# 5. Vérifier
ssh ... 'docker compose ps && wget -qO- http://backend:4000/api/health'
```

**Règles d'or** : demander avant de déployer · backup systématique · migrations idempotentes ·
ne jamais tester en écriture sur la prod live · diff avant écrasement · rollback prêt.

---

## 7. Checklist de démarrage (nouvelle app)

- [ ] VPS Ubuntu LTS + clé SSH à la création
- [ ] User non-root, SSH port custom + clé only + `PermitRootLogin no`
- [ ] UFW deny-in (80/443 + SSH whitelisté) + **fix egress Docker (systemd)**
- [ ] `docker-compose.yml` : réseau privé, seul Caddy public, volumes, limites mémoire
- [ ] `.env` hors git ; `.gitignore` : `.env*`, dumps, médias, logs
- [ ] `Caddyfile` : same-origin, TLS auto, headers, health-check
- [ ] Cloudflare : DNS proxied, SSL Full(strict), WAF geo, rate-limit edge, bypass cache `/api/*`
- [ ] App : JWT + clé API HMAC + origin/CORS + rate-limit + URLs signées + audit log
- [ ] DB : migrations idempotentes, pooler, backups + rotation
- [ ] Playbook de déploiement piloté par Claude Code

---

## 8. Composants — rappel « pourquoi chacun » (1 ligne)

- **Cloudflare** : cache l'origine + filtre (DDoS/geo/bots) avant le serveur.
- **Caddy** : TLS sans effort + une seule porte d'entrée + headers durcis.
- **Docker/Compose** : toute la stack reproductible, isolée, en un fichier.
- **Réseau privé** : la DB et l'API ne sont jamais joignables d'Internet.
- **UFW** : ferme tout sauf l'indispensable.
- **JWT + clé API + origin** : chaque requête est authentifiée et anti-CSRF.
- **URLs signées** : les fichiers privés ne se scrapent pas.
- **PgBouncer** : tient la charge sans saturer Postgres.
- **Backups + migrations idempotentes** : on peut revenir en arrière, rejouer sans casse.
- **Claude Code / Cursor** : on construit et on opère cette stack **en langage naturel**,
  rapidement et de façon traçable.

---

*Gabarit générique — à instancier par app. Pour l'implémentation concrète Elson, voir le manuel
dédié `MANUEL-DEVOPS-HETZNER-CLOUDFLARE.md`.*
