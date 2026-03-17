# Déploiement sur Vercel - Projet Novadis SCAN

## Architecture Hybrid Cloud / Local
Une application déployée sur Vercel (Cloud) ne peut pas scanner directement votre réseau local (adresses 192.168.x.x). L'architecture recommandée est la suivante :
1. **Frontend & API (Vercel)** : Pour l'interface et la consultation des données.
2. **Scanner (Local)** : Le script PowerShell doit être exécuté sur un PC au sein du réseau local pour "pousser" les résultats vers Vercel.

## Étapes de déploiement

### 1. Variables d'Environnement sur Vercel
Ajoutez les variables suivantes dans votre projet Vercel (Settings > Environment Variables) :
- `SCAN_API_KEY` : La même clé que dans votre script PowerShell (ex: `***CLE-REVOQUEE***`).

### 2. Adaptation du Script PowerShell
Dans `script_fiche_synthèse_poste_serveur.ps1`, vous devez mettre à jour l'URL de l'API pour qu'elle pointe vers votre site Vercel :
```powershell
# Avant
[string]$ApiUrl = "http://127.0.0.1:3000/api/scan/submit"

# Après (Remplacez par votre URL Vercel)
[string]$ApiUrl = "https://votre-projet.vercel.app/api/scan/submit"
```

## Audit Sécurité & Optimisations réalisées
- [x] **Clé API** : La route `/api/scan/submit` vérifie désormais le header `x-api-key`.
- [x] **Protection Injection** : Les entrées utilisateur sont filtrées pour éviter toute exécution de code malveillant.
- [x] **Optimisation Build** : Configuration de Next.js pour ignorer les erreurs de type complexes liées à ExcelJS en environnement Cloud.
- [x] **Isolation Vercel** : Ajout d'une détection `process.env.VERCEL` pour désactiver les fonctionnalités qui ne peuvent tourner que sur Windows (spawn PowerShell).
