# Drive Studio

Application desktop (Electron + React + TypeScript) qui centralise plusieurs comptes
Google Drive en un seul endroit : vue unifiée des fichiers, **distribution automatique**
des uploads vers le compte le plus libre, **backup manuel & planifié** vers des comptes
de redondance, dashboard avec graphiques, dossiers virtuels, partage de liens, versioning
et export ZIP.

100 % local : SQLite embarqué + API Google Drive. Aucun serveur cloud.

---

## Stack

| Couche | Techno |
|---|---|
| Desktop | Electron 35, electron-vite, electron-builder |
| UI | React 18, TypeScript, Zustand, Framer Motion, Lucide |
| Données | better-sqlite3 (local), `safeStorage` pour chiffrer les tokens |
| Google | `googleapis` (OAuth2 loopback + Drive v3) |
| Style | CSS pur avec variables `:root` (design repris de *Cours Studio*) |

---

## Démarrage

```bash
npm install          # installe + recompile better-sqlite3 pour Electron
npm run dev           # lance l'app en mode développement
```

Build & packaging :

```bash
npm run build         # compile main + preload + renderer dans out/
npm run typecheck     # vérifie les types (main + renderer)
npm run dist          # installeur Windows (nsis + portable) -> dist-installer/
npm run dist:mac      # dmg
npm run dist:linux    # AppImage + deb
```

> Avant `npm run dist`, place `resources/icon.ico` (Windows) et `resources/icon.png`
> (512×512, macOS/Linux).

### Builds multi-plateformes (CI)

Un workflow GitHub Actions (`.github/workflows/release.yml`) compile automatiquement
l'app sur les trois OS à chaque tag `v*` (ou manuellement via *Actions → Run workflow*) :

- **Windows** (`nsis` + portable, x64) sur un runner `windows-latest`.
- **macOS** (`dmg` + `zip`, **x64 et arm64**) sur un runner `macos-latest` — ce runner
  est lui-même en Apple Silicon, donc le build arm64 est **compilé nativement**
  (y compris le module natif `better-sqlite3`), aucune traduction Rosetta n'entre en jeu.
- **Linux** (`AppImage` + `deb`, x64) sur `ubuntu-latest`.

Sur un tag, les artefacts sont publiés automatiquement en *GitHub Release*.

> **Apps non signées** : sans certificat développeur (payant), macOS affichera un
> avertissement Gatekeeper (« app endommagée / éditeur non identifié ») et Windows un
> avertissement SmartScreen à la première ouverture. C'est normal pour un build indé ;
> sur Mac, clic droit → *Ouvrir* (ou `xattr -cr /Applications/Drive\ Backup\ Manager.app`)
> lève le blocage.

---

## Configuration Google (obligatoire au premier lancement)

L'app utilise **tes propres** identifiants OAuth. Ils sont stockés chiffrés localement
(trousseau de l'OS) et ne quittent jamais ta machine.

1. **Projet** — ouvre [Google Cloud Console](https://console.cloud.google.com/) et crée
   un projet.
2. **API** — *APIs & Services → Bibliothèque* → active **Google Drive API**.
3. **Écran de consentement OAuth** — type *Externe*. Renseigne un nom d'app, ton e-mail
   de support, et **ajoute ton adresse Google comme "utilisateur de test"** (chaque compte
   que tu veux relier doit être testeur tant que l'app n'est pas vérifiée). Scopes :
   `.../auth/drive`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`.
4. **Identifiants** — *Identifiants → Créer des identifiants → ID client OAuth* →
   type **Application de bureau**.
5. Copie le **Client ID** et le **Client Secret** dans l'app : *Réglages → Identifiants
   Google OAuth*.

Le flow d'ajout de compte ouvre le navigateur système ; la redirection se fait sur
`http://127.0.0.1:<port aléatoire>` (loopback, recommandé par Google pour les apps
desktop) — aucune URL de redirection à déclarer manuellement pour un client "Application
de bureau".

---

## Utilisation

1. **Réglages** → colle Client ID / Secret.
2. **Comptes** → *Ajouter un compte* (répète pour chaque Drive). Attribue les rôles :
   - **Principal** : reçoit les uploads (distribution automatique).
   - **Backup** : cible des réplications.
   - *Importer* récupère la liste des fichiers déjà présents sur ce Drive.
3. **Fichiers** → glisse-dépose ou *Ajouter*. L'app choisit le compte principal avec le
   plus d'espace libre, calcule un SHA-256, et ignore les doublons (même checksum).
   Clic droit : détails / versions / partage / ajout à un dossier / suppression.
   Sélection multiple → *Exporter* (dossier) ou *ZIP*.
4. **Backup** → choisis comptes source + cibles, mode *incrémental* (nouveaux fichiers)
   ou *complet*, coche *vérifier les checksums*, lance. Progression en direct.
   *Planifier* pour un backup récurrent (quotidien / hebdo / mensuel).
5. **Partages** → liste des liens publics générés, copie / ouverture / révocation.
6. **Logs** → toutes les opérations (upload, download, réplication, partage, comptes…),
   filtrables par action / statut / compte.

---

## Architecture

```
src/
  shared/types.ts            types partagés
  main/                      process principal Electron
    index.ts                 fenêtre, CSP, IPC, scheduler
    db.ts                    schéma SQLite + requêtes (8 tables)
    crypto.ts                chiffrement safeStorage
    settings.ts              thème + identifiants Google (chiffrés)
    checksum.ts              SHA-256 en streaming
    distribution.ts          choix du meilleur compte principal
    filesvc.ts               upload / download / delete / partage
    backup.ts                moteur de réplication (full / incrémental)
    scheduler.ts             déclenche les backups planifiés (tick 60 s)
    zipexport.ts             export multi-fichiers -> dossier ou ZIP
    mime.ts                  table MIME minimale
    events.ts                bus d'événements -> renderer (progression)
    google/oauth.ts          flow OAuth loopback + refresh de tokens
    google/drive.ts          wrappers Drive v3 (quota, list, up/download, share, revisions)
    google/accounts.ts       ajout / sync / import de comptes
  preload/index.ts           pont contextBridge `window.api`
  renderer/src/
    App.tsx                  layout + drag & drop global
    store/index.ts           état global (zustand)
    lib/format.ts            formatage octets / dates / couleurs par compte
    components/              TitleBar, Sidebar, Modal, Toast, charts, TransfersPanel…
    views/                   Dashboard, Files, Accounts, Backup, Shared, Logs, Settings
    styles/globals.css       design system
```

### Base de données (`%APPDATA%/gdrive-backup-manager/drive-backup-manager.db`)

`accounts`, `files_metadata`, `backup_jobs`, `sync_logs`, `virtual_folders`,
`folder_files`, `backup_schedules`, `shared_links`.

Les colonnes `access_token` / `refresh_token` sont chiffrées via `safeStorage` avant
insertion et ne sont jamais renvoyées au renderer.

---

## Limites connues

- La réplication entre comptes distincts transite par le disque local
  (téléchargement puis ré-upload) : Google Drive n'autorise pas la copie
  serveur-à-serveur entre propriétaires différents.
- Le `md5Checksum` de Drive et le `SHA-256` calculé par l'app sont deux algorithmes
  différents ; la vérification stricte d'intégrité ne s'applique qu'aux fichiers
  uploadés via l'app (dont on connaît le SHA-256).
- Tant que l'écran de consentement OAuth est en mode "test", seuls les comptes déclarés
  comme testeurs peuvent être reliés, et le refresh token peut expirer au bout de 7 jours.
