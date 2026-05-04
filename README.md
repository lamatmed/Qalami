# Qalami — Système de Gestion Scolaire

> Plateforme SaaS complète de gestion scolaire, conçue pour les établissements mauritaniens.  
> Multi-écoles · Bilingue Français / Arabe (RTL) · Multi-rôles

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38BDF8?logo=tailwindcss)
![License](https://img.shields.io/badge/Licence-Propriétaire-red)

---

## Table des matières

- [Aperçu](#aperçu)
- [Fonctionnalités](#fonctionnalités)
- [Stack technique](#stack-technique)
- [Architecture](#architecture)
- [Structure du projet](#structure-du-projet)
- [Démarrage rapide](#démarrage-rapide)
- [Variables d'environnement](#variables-denvironnement)
- [Modèle de sécurité](#modèle-de-sécurité)
- [Schéma de base de données](#schéma-de-base-de-données)
- [Rôles et permissions](#rôles-et-permissions)
- [Licence](#licence)

---

## Aperçu

Qalami est une plateforme SaaS de gestion scolaire multi-tenant construite avec **Next.js App Router**, **Supabase** et **TypeScript**. Elle couvre l'ensemble du cycle de vie d'un établissement : de l'inscription des élèves à l'édition des bulletins, en passant par la gestion des présences, la comptabilité et la communication.

Chaque école est complètement isolée via un `school_id` appliqué à chaque requête, avec Row-Level Security (RLS) Supabase comme deuxième couche de défense.

---

## Fonctionnalités

### Interface Administrateur

| Module | Fonctionnalités |
|--------|-----------------|
| **Tableau de bord** | KPIs en temps réel, activité récente, alertes absences, notes récentes |
| **Élèves** | Annuaire (vue carte/tableau), filtres avancés, import CSV, fiche élève complète, inscription wizard |
| **Enseignants** | Annuaire, volume horaire, affectations matières/classes |
| **Parents** | Annuaire avec enfants liés, communication directe |
| **Classes & Niveaux** | Création, gestion des niveaux, capacités, affectation élèves |
| **Matières** | CRUD matières, icônes, coefficients par classe |
| **Affectations** | Matrice enseignant × classe × matière (drag & drop) |
| **Emploi du temps** | Planification par classe, import CSV, copie de planning, export PDF |
| **Présences** | Appel par séance, historique 30 jours, stats par matière et par élève |
| **Bulletins** | Calcul des moyennes, rangs, appréciations, conduite, export PDF/impression |
| **Trimestres** | Années scolaires, trimestres (T1/T2/T3), dates conseil de classe et remise bulletins |
| **Planning & Annonces** | Calendrier événements, annonces ciblées (classe / individuel / école) |
| **Scolarité** | Suivi paiements par élève, types de frais (scolarité, bus, cantine…) |
| **Comptabilité** | Transactions, entrées/sorties, grand livre, rapports financiers |
| **Ressources** | Gestion de documents et cours partagés |
| **Messagerie** | Messagerie interne multi-rôles (threads, participants) |
| **Paramètres** | Identité école (logo, slogan, contacts), gestion du personnel staff |
| **Utilisateurs** | Création comptes staff, permissions granulaires, journal d'activité |

### Interface Enseignant

- Emploi du temps personnel
- Saisie des notes (devoirs, contrôles, examens) et publication
- Feuille d'appel par séance
- Devoirs : création, pièces jointes, corrections
- Quiz interactifs (questions QCM/ouvertes)
- Remarques élèves (positives / avertissements)
- Ressources pédagogiques
- Messagerie

### Interface Élève

- Tableau de bord personnel (notes, emploi du temps, devoirs)
- Consultation des bulletins publiés
- Soumission des devoirs
- Quiz en ligne avec chronomètre
- Gamification (XP, niveaux, streak, classement)
- Annonces et messagerie

### Interface Parent

- Suivi des notes et présences de l'enfant
- Consultation des paiements et frais scolaires
- Réception des annonces ciblées
- Messagerie avec l'équipe pédagogique

---

## Stack technique

| Couche | Technologie | Version |
|--------|-------------|---------|
| Framework | [Next.js](https://nextjs.org) App Router | 16.x |
| UI Runtime | [React](https://react.dev) | 19.x |
| Langage | [TypeScript](https://typescriptlang.org) | 5.x |
| Styles | [Tailwind CSS](https://tailwindcss.com) v4 + [shadcn/ui](https://ui.shadcn.com) | 4.x |
| Base de données | [Supabase](https://supabase.com) (PostgreSQL + RLS) | 2.x |
| Auth | Supabase Auth · OTP SMS (Twilio) | — |
| Validation | [Zod](https://zod.dev) | 3.x |
| Animations | [Framer Motion](https://www.framer.com/motion) | 12.x |
| Formulaires | [React Hook Form](https://react-hook-form.com) + `@hookform/resolvers` | — |
| Graphiques | [Recharts](https://recharts.org) | — |
| PDF | [jsPDF](https://github.com/parallax/jsPDF) + [html2canvas](https://html2canvas.hertzen.com) | — |
| Notifications | [Sonner](https://sonner.emilkowal.ski) | — |
| Thème | [next-themes](https://github.com/pacocoursey/next-themes) (dark / light) | — |

---

## Architecture

```
┌────────────────────────────────────────────────────────┐
│                     Next.js App Router                  │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Server Pages │  │ Server       │  │ Middleware    │  │
│  │ (RSC)        │  │ Actions      │  │ (Auth guard) │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘  │
│         │                 │                              │
│         ▼                 ▼                              │
│  ┌──────────────────────────────────────────────────┐   │
│  │          src/lib/auth-action.ts                  │   │
│  │          getActionContext() — auth partagée      │   │
│  └──────────────────────┬───────────────────────────┘   │
│                         │                               │
└─────────────────────────┼───────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   Supabase (Cloud)    │
              │  PostgreSQL + RLS     │
              │  Auth (JWT + OTP)     │
              └───────────────────────┘
```

**Principes clés :**

- **Server Components par défaut** — les pages de données (`analytics`, `terms`) sont RSC ; seuls les composants interactifs sont `'use client'`.
- **Server Actions** — toutes les mutations passent par des Server Actions (`'use server'`) avec vérification auth systématique via `getActionContext()`.
- **Multi-tenant** — chaque requête filtre par `school_id` issu du profil de l'utilisateur connecté. Le RLS Supabase constitue la deuxième couche.
- **Pas de double connexion** — une seule instance Supabase par action, partagée via `getActionContext()`.

---

## Structure du projet

```
qalami-v2/
├── src/
│   ├── app/
│   │   ├── admin/                  # Interface administrateur école
│   │   │   ├── actions.ts          # Actions partagées (dashboard)
│   │   │   ├── analytics/          # Statistiques & KPIs
│   │   │   ├── assignments/        # Affectations enseignants
│   │   │   ├── attendance/         # Gestion des présences
│   │   │   ├── classes/            # Classes & niveaux
│   │   │   ├── documents/          # Ressources et documents
│   │   │   ├── finance/            # Comptabilité & scolarité
│   │   │   ├── invitations/        # Invitations utilisateurs
│   │   │   ├── messages/           # Messagerie
│   │   │   ├── parents/            # Annuaire parents
│   │   │   ├── planning/           # Planning & annonces
│   │   │   ├── reports/            # Bulletins scolaires
│   │   │   ├── schedule/           # Emploi du temps
│   │   │   ├── settings/           # Paramètres école
│   │   │   ├── students/           # Annuaire élèves
│   │   │   ├── subjects/           # Matières & coefficients
│   │   │   ├── teachers/           # Annuaire enseignants
│   │   │   ├── terms/              # Trimestres & années scolaires
│   │   │   ├── users/              # Gestion utilisateurs staff
│   │   │   ├── layout.tsx          # Layout admin (auth + sidebar)
│   │   │   └── page.tsx            # Tableau de bord
│   │   ├── api/
│   │   │   └── staff/              # Routes API (webhooks, exports)
│   │   ├── auth/                   # Connexion, OTP, réinitialisation
│   │   ├── invite/                 # Onboarding par invitation
│   │   ├── parent/                 # Interface parent
│   │   ├── student/                # Interface élève
│   │   ├── super-admin/            # Interface super administrateur
│   │   ├── teacher/                # Interface enseignant
│   │   ├── layout.tsx              # Layout racine
│   │   ├── loading.tsx             # Skeleton global
│   │   ├── error.tsx               # Boundary d'erreur global
│   │   └── not-found.tsx           # Page 404
│   │
│   ├── components/
│   │   ├── admin/                  # Composants interface admin
│   │   │   ├── analytics/          # Graphiques KPIs
│   │   │   ├── assignments/        # Matrice affectations
│   │   │   ├── attendance/         # Client présences
│   │   │   ├── classes/            # Gestion classes
│   │   │   ├── finance/            # Finance & transactions
│   │   │   ├── parents/            # Annuaire parents
│   │   │   ├── planning/           # Calendrier & annonces
│   │   │   ├── reports/            # Bulletins & PDF
│   │   │   ├── schedule/           # Emploi du temps
│   │   │   ├── settings/           # Paramètres
│   │   │   ├── students/           # Annuaire & fiches élèves
│   │   │   ├── subjects/           # Matières
│   │   │   └── teachers/           # Annuaire enseignants
│   │   ├── teacher/
│   │   ├── student/
│   │   ├── parent/
│   │   ├── shared/                 # Composants partagés multi-rôles
│   │   └── ui/                     # shadcn/ui primitives
│   │
│   ├── lib/
│   │   ├── auth-action.ts          # Helper auth partagé (getActionContext)
│   │   └── utils.ts                # cn(), formatters…
│   │
│   ├── i18n/                       # Internationalisation (fr / ar)
│   └── utils/
│       └── supabase/
│           ├── client.ts           # Client navigateur
│           ├── server.ts           # Client serveur (SSR / Server Actions)
│           ├── admin.ts            # Client admin (service role)
│           └── middleware.ts       # Refresh session middleware
│
├── public/                         # Assets statiques
├── docs/                           # Documentation interne
│   ├── DB_SCHEMA.md
│   └── DB_EXPERT_RECOMMENDATIONS.md
├── schema-db.md                    # Schéma SQL de référence (toutes les tables)
├── next.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## Démarrage rapide

### Prérequis

- **Node.js** ≥ 18
- **npm** ≥ 9
- Compte **Supabase** (projet créé)
- *(Optionnel)* Compte **Twilio** pour l'OTP SMS

### Installation

```bash
# 1. Cloner le dépôt
git clone https://github.com/mlemineb/qalami-v2.git
cd qalami-v2

# 2. Installer les dépendances
npm install

# 3. Configurer l'environnement
cp .env.example .env.local
# → Renseigner les variables (voir section ci-dessous)

# 4. Initialiser la base de données
# Exécuter le schéma SQL depuis schema-db.md dans l'éditeur SQL Supabase

# 5. Lancer en développement
npm run dev
```

L'application sera disponible sur [http://localhost:3000](http://localhost:3000).

### Scripts disponibles

```bash
npm run dev        # Serveur de développement (Turbopack)
npm run build      # Build de production
npm run start      # Serveur de production
npm run lint       # ESLint
```

---

## Variables d'environnement

Créer un fichier `.env.local` à la racine :

```env
# ── Supabase ──────────────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# ── Twilio (OTP SMS — optionnel) ──────────────────────────────────────────────
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_VERIFY_SERVICE_SID=
```

> **`SUPABASE_SERVICE_ROLE_KEY`** n'est utilisé que dans les Server Actions côté serveur (création de comptes, suppressions admin). Il n'est jamais exposé au navigateur.

---

## Modèle de sécurité

### Multi-tenant

Chaque enregistrement dans toutes les tables contient un `school_id`. Chaque Server Action :

1. Récupère le profil de l'utilisateur authentifié via `getActionContext()` (`src/lib/auth-action.ts`)
2. Vérifie que son rôle est autorisé (`admin`, `super_admin`, `school_staff`)
3. Applique `eq('school_id', schoolId)` sur **toutes** les lectures et mutations

### Row-Level Security (RLS)

Le RLS Supabase est activé sur toutes les tables comme deuxième ligne de défense, indépendante du code applicatif.

### Validation

Toutes les entrées utilisateur sont validées avec **Zod** avant d'atteindre la base de données.

### Flux d'authentification

```
Navigateur → Middleware (updateSession) → Layout RSC (getUser)
         → Server Action (getActionContext) → Requête Supabase
```

---

## Schéma de base de données

Le fichier [`schema-db.md`](./schema-db.md) contient le DDL complet de toutes les tables.

### Tables principales

| Table | Description |
|-------|-------------|
| `profiles` | Tous les utilisateurs (élèves, enseignants, parents, admin…) |
| `schools` | Établissements (multi-tenant root) |
| `classes` | Classes par école |
| `levels` | Niveaux scolaires |
| `subjects` | Matières |
| `subject_coefficients` | Coefficient par matière × classe |
| `enrollments` | Inscriptions élèves × classe × année |
| `teacher_assignments` | Affectations enseignant × classe × matière |
| `schedule` | Emploi du temps (récurrent, par `day_of_week`) |
| `attendance_periods` | Sessions d'appel (ouverte / fermée) |
| `attendance` | Présences individuelles par période |
| `grades` | Notes par élève × matière × trimestre |
| `terms` | Trimestres avec dates conseil et bulletins |
| `academic_years` | Années scolaires |
| `report_cards` | Bulletins calculés (moyenne, rang, conduite) |
| `payments` | Paiements scolarité par élève |
| `transactions` | Comptabilité générale |
| `announcements` | Annonces ciblées (école / classe / individu) |
| `events` | Événements du calendrier |
| `homework` | Devoirs avec pièces jointes |
| `parent_student_links` | Liens parent ↔ enfant |
| `invitations` | Invitations par token (7 jours) |
| `staff_permissions` | Permissions granulaires staff |
| `activity_logs` | Journal d'audit des actions admin |

---

## Rôles et permissions

| Rôle | Description | Accès |
|------|-------------|-------|
| `super_admin` | Équipe Qalami | Toutes les écoles, impersonation, supervision globale |
| `admin` | Directeur d'école | Toutes les fonctionnalités de son école |
| `school_staff` | Personnel administratif | Accès selon permissions granulaires définies par l'admin |
| `teacher` | Enseignant | Notes, présences, devoirs, quiz, messagerie |
| `student` | Élève | Consultation notes/planning, devoirs, quiz, gamification |
| `parent` | Parent / tuteur | Suivi enfant, paiements, messagerie |

---

## Licence

Projet privé et propriétaire. Tous droits réservés — © Qalami.
