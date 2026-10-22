# Déploiement sur Vercel - Projet Novadis SCAN

## Architecture Hybrid Cloud / Local
Une application déployée sur Vercel (Cloud) ne peut pas scanner directement votre réseau local (adresses 192.168.x.x). L'architecture recommandée est la suivante :
1. **Frontend & API (Vercel)** : Pour l'interface et la consultation des données.
2. **Scanner (Local)** : Le script PowerShell doit être exécuté sur un PC au sein du réseau local pour "pousser" les résultats vers Vercel.

## Étapes de déploiement

### 1. Variables d'Environnement sur Vercel
Ajoutez les variables suivantes dans votre projet Vercel (Settings > Environment Variables) :
- `SCAN_API_KEY` : Clé secrète de l'agent de scan (longue et aléatoire, ex : `openssl rand -hex 32`). Elle n'est plus écrite dans le code : le dashboard l'injecte dans la commande d'installation affichée aux utilisateurs authentifiés.
- `DASHBOARD_USER` / `DASHBOARD_PASSWORD` : Identifiants de l'authentification HTTP Basic qui protège tout le dashboard (voir `src/proxy.ts`). Sans eux, le site répond 503 en production.
- `NEXT_PUBLIC_APP_URL` : URL publique du site (sert à construire la commande d'installation de l'agent).
- Le store Vercel Blob doit être **privé** : l'inventaire contient IP, MAC et numéros de série.

### 2. Adaptation du Script PowerShell
Dans `script_fiche_synthèse_poste_serveur.ps1`, vous devez mettre à jour l'URL de l'API pour qu'elle pointe vers votre site Vercel :
```powershell
# Avant
[string]$ApiUrl = "http://127.0.0.1:3000/api/scan/submit"

# Après (Remplacez par votre URL Vercel)
[string]$ApiUrl = "https://votre-projet.vercel.app/api/scan/submit"
```

## Audit Sécurité & Optimisations réalisées
- [x] **Clé API** : La route `/api/scan/submit` vérifie le header `x-api-key` et refuse tout si `SCAN_API_KEY` n'est pas définie.
- [x] **Authentification** : Toutes les pages, server actions et routes (export Excel compris) sont protégées par HTTP Basic, sauf `/api/scan/submit` et `/api/ping`.
- [x] **Protection Injection** : Les entrées utilisateur sont filtrées pour éviter toute exécution de code malveillant.
- [x] **Optimisation Build** : Configuration de Next.js pour ignorer les erreurs de type complexes liées à ExcelJS en environnement Cloud.
- [x] **Isolation Vercel** : Ajout d'une détection `process.env.VERCEL` pour désactiver les fonctionnalités qui ne peuvent tourner que sur Windows (spawn PowerShell).
