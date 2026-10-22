# Novadis Scanner

Outil d'inventaire matériel des postes clients (`CLT*`) et serveurs (`SRV*`) Windows d'un parc.
Un agent PowerShell collecte les informations de chaque machine et les envoie à un dashboard web,
qui les range dans une **fiche de synthèse Excel** (une colonne par machine, une ligne par champ)
exportable à tout moment.

## Architecture

```
┌──────────────────────┐   POST /api/scan/submit    ┌────────────────────────────┐
│ Poste Windows        │   (en-tête x-api-key)      │ Dashboard Next.js (Vercel) │
│ scan-to-cloud.ps1    │ ─────────────────────────► │  - liste / recherche       │
└──────────────────────┘                            │  - suppression             │
                                                    │  - export .xlsx            │
┌──────────────────────┐   POST localhost:3000      │                            │
│ PC d'administration  │ ─────────────────────────► │  Stockage : Inventaire_    │
│ script_fiche_...ps1  │   (dashboard en local)     │  Parc.xlsx (Blob privé sur │
│ (local, AD, IP)      │                            │  Vercel, data/ en local)   │
└──────────────────────┘                            └────────────────────────────┘
```

| Composant | Rôle |
|---|---|
| `web-dashboard/` | Dashboard Next.js 16 / React 19 / Tailwind / shadcn. Lit et écrit le classeur avec ExcelJS. |
| `web-dashboard/scan-to-cloud.ps1` | Agent autonome à lancer sur chaque poste : scanne la machine et envoie le résultat au dashboard. |
| `script_fiche_synthèse_poste_serveur.ps1` | Scanner d'administration avec menu : poste local, Active Directory, plages IP ou machine précise (WinRM, repli DCOM). |
| `Lancer_Scan.bat` | Lance le scanner d'administration en double-cliquant. |

## Structure du dépôt

```
.
├── Lancer_Scan.bat
├── script_fiche_synthèse_poste_serveur.ps1
└── web-dashboard/
    ├── scan-to-cloud.ps1            Agent de scan pour les postes
    ├── data/
    │   ├── Modèle_fiche_synthèse.xlsx   Modèle vierge (suivi par git)
    │   └── Inventaire_Parc.xlsx         Inventaire local (ignoré par git)
    └── src/
        ├── proxy.ts                 Authentification HTTP Basic du dashboard
        ├── app/
        │   ├── page.tsx             Dashboard principal
        │   ├── actions.ts           Server actions (liste, suppression, scan local)
        │   └── api/
        │       ├── scan/submit/     Réception des scans (clé API)
        │       ├── excel/generate/  Export Excel
        │       └── ping/            Test de disponibilité
        └── lib/
            ├── excel-store.ts       Lecture / écriture / fusion du classeur
            └── xlsx-reader.ts       Chargement robuste des fichiers écrits par Excel
```

## Scanner un poste

1. Connectez-vous au dashboard. Les identifiants ne sont pas dans le dépôt : demandez-les à
   l'administrateur du parc.
2. Cliquez sur **Scanner un PC** et copiez la commande PowerShell affichée. Elle contient déjà
   l'URL et la clé API.
3. Collez-la dans une console PowerShell sur le poste à inventorier.

L'agent peut aussi être lancé à la main :

```powershell
.\scan-to-cloud.ps1 -ApiUrl "https://<votre-site>.vercel.app/api/scan/submit" -ApiKey "<clé>"
```

Sans `-ApiKey`, l'agent lit la variable d'environnement `NOVADIS_SCAN_API_KEY`, puis demande la
clé à l'écran.

Un rescan met à jour la colonne existante de la machine (recherche par nom).

## Scanner d'administration (réseau local)

Lancez `Lancer_Scan.bat`, puis choisissez une option :

1. Poste local
2. Machines `CLT*` et `SRV*` de l'Active Directory
3. Plages IP `192.168.200.10-255` et `192.168.201.10-255`
4. Une machine précise (nom ou IP)

Les résultats sont écrits dans `web-dashboard/data/Inventaire_Parc.xlsx` via Excel (COM), puis
envoyés au dashboard s'il tourne en local sur le port 3000 ou 3001.

**Prérequis sur les machines cibles** (en administrateur) :

```powershell
winrm quickconfig -quiet
netsh advfirewall firewall set rule group="Infrastructure de gestion Windows (WMI-Entrée)" new enable=yes
```

Le compte qui lance le scan doit être administrateur des machines cibles.

## Contenu de la fiche

Chaque machine occupe une colonne de l'onglet « Serveurs et postes clients ».

| Lignes | Champs | Source |
|---|---|---|
| 1 | Nom | scan |
| 3–5 | Domaine ou groupe de travail, fabricant, modèle | scan |
| 8–9 | Serveur NTP, service tag | scan |
| 11–17 | OS, type de système, processeurs, RAM, cartes graphiques | scan |
| 19, 21 | Tailles des volumes | scan |
| 23–36 | Disques 00 à 13 | scan |
| 43–66 | Cartes réseau 1 à 4 (nom, référence, MAC, IP, masque, passerelle) | scan |
| 2, 6, 7, 10 | Localisation, domaine de sûreté, fonctions, fin de garantie | saisie manuelle |
| 20, 22, 37–41 | RAID, moniteurs, équipements tiers | saisie manuelle |

Un rescan ne réécrit que les lignes « scan » : les champs saisis à la main sont conservés.
Une ligne scannée revenue vide est effacée (disque ou carte réseau retiré).

## Développement local

Prérequis : Node.js 20+, Windows avec PowerShell 5.1+ et Excel (pour le scanner d'administration).

```bash
cd web-dashboard
npm install
npm run dev
```

Créez `web-dashboard/.env.local` :

```
SCAN_API_KEY=<clé utilisée par les scripts PowerShell>
```

En local, l'inventaire est lu dans `web-dashboard/data/Inventaire_Parc.xlsx`. Si
`DASHBOARD_USER` et `DASHBOARD_PASSWORD` ne sont pas définis, le dashboard n'est pas protégé par
mot de passe (en production, il répond alors 503).

## Déploiement sur Vercel

Le projet Vercel utilise `web-dashboard` comme dossier racine (preset Next.js).

### Variables d'environnement

| Variable | Rôle |
|---|---|
| `SCAN_API_KEY` | Clé secrète de l'agent de scan. Sans elle, tous les envois sont refusés. |
| `DASHBOARD_USER` / `DASHBOARD_PASSWORD` | Identifiants de l'authentification HTTP Basic du dashboard. |
| `NEXT_PUBLIC_APP_URL` | URL publique du site, utilisée pour construire la commande de l'agent. |
| `BLOB_STORE_ID` | Créée automatiquement en connectant un store Blob au projet. |

Le store Vercel Blob doit être en accès **privé** : l'inventaire contient des IP, des adresses MAC
et des numéros de série. L'authentification au store se fait par OIDC (`@vercel/blob` ≥ 2.8).

Une variable modifiée ne s'applique qu'au déploiement suivant :

```bash
vercel redeploy <votre-site>.vercel.app --scope <équipe>
```

### Déployer

Le projet n'est pas relié au dépôt Git : chaque version se déploie à la main. Déployez depuis un
clone propre, pour ne pas envoyer `.env.local` ni l'inventaire local :

```bash
git clone --depth 1 <dépôt> /tmp/deploy
vercel deploy /tmp/deploy --prod --project <projet> --scope <équipe>
```

Relier le projet au dépôt (Vercel → Settings → Git) permet de déployer automatiquement à chaque
push sur `master`.

## API

| Route | Accès | Rôle |
|---|---|---|
| `POST /api/scan/submit` | en-tête `x-api-key` | Enregistre ou met à jour une machine. |
| `GET /api/ping` | public | Test de disponibilité. |
| `GET /api/excel/generate` | mot de passe du dashboard | Exporte tout l'inventaire. |
| `POST /api/excel/generate` | mot de passe du dashboard | Exporte les machines dont les colonnes sont dans `{ "columnIds": [...] }`. |

Exemple de corps pour `/api/scan/submit` :

```json
{
  "NOM": "CLT-EXEMPLE-01",
  "OS": "Microsoft Windows 11 Pro",
  "RAM": "16 Go",
  "DISQUES": ["Samsung SSD 980 - 476.94 Go - SN: XXXX"],
  "RESEAU": [{ "Nom": "Intel Ethernet", "MAC": "AA:BB:CC:DD:EE:FF", "IP": "192.168.200.50",
               "Masque": "255.255.255.0", "Passerelle": "192.168.200.1" }]
}
```

## Sécurité

- Tout le dashboard (pages, server actions, export) est protégé par mot de passe. Seules
  `/api/scan/submit` et `/api/ping` restent publiques.
- Aucune clé ni aucun mot de passe n'est écrit dans le code : tout passe par des variables
  d'environnement.
- L'inventaire réel n'est jamais versionné (`web-dashboard/data/Inventaire_Parc.xlsx` est ignoré
  par git).

## Limites connues

- Le scanner d'administration ignore `-ApiUrl` : il n'envoie qu'à un dashboard local
  (ports 3000 et 3001).
- Le stockage est un seul fichier Excel réécrit à chaque opération : deux scans simultanés peuvent
  faire perdre une machine.
- La suppression se fait par numéro de colonne.
- La date de dernier scan affichée est l'heure de lecture, pas celle du scan.
- Les champs manuels ne sont modifiables que dans Excel.
- L'agent ne collecte pas les logiciels installés.
