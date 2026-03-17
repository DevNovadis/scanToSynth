# 🚀 Novadis Scanner

Novadis Scanner est un outil professionnel d'inventaire automatique pour parcs informatiques sous Windows. Il permet de scanner des machines locales ou distantes (IP, Active Directory) et de centraliser les données matérielles et logicielles dans un tableau de bord moderne et un fichier Excel synchronisé.

## ✨ Fonctionnalités

- **Scan Multi-Protocoles** : Support de WinRM (WSMan) et WMI (DCOM) avec repli automatique pour une compatibilité maximale.
- **Tableau de Bord Moderne** : Interface fluide développée avec Next.js 15, Tailwind CSS et Shadcn/UI.
- **Centralisation Excel** : Synchronisation bidirectionnelle avec un fichier `Inventaire_Parc.xlsx`.
- **Recherche Avancée** : Filtrez vos machines par Nom, OS, Tag ou adresse IP.
- **Sécurisé** : Protection contre l'injection de commandes et authentification par clé API.

## 🛠 Architecture

Le projet est composé de deux parties :
1. **Web Dashboard** (`/web-dashboard`) : L'interface de consultation et de gestion.
2. **Scanner Agent** (`script_fiche_synthèse_poste_serveur.ps1`) : L'outil PowerShell qui exécute l'extraction des données.

## 🚀 Installation & Utilisation

### 1. Pré-requis
- Node.js 20+
- Windows avec PowerShell 5.1+ (pour l'agent de scan)

### 2. Lancement du Dashboard
```bash
cd web-dashboard
npm install
npm run dev
```

### 3. Configuration de la machine cible
Pour qu'une machine puisse être scannée à distance, exécutez ces commandes en tant qu'administrateur sur le poste cible :
```powershell
winrm quickconfig -quiet
netsh advfirewall firewall set rule group="Infrastructure de gestion Windows (WMI-Entrée)" new enable=yes
```

## 🌐 Déploiement Vercel

Le projet est optimisé pour Vercel. Consultez le fichier `VERCEL.md` pour les instructions spécifiques au déploiement Cloud et à la configuration des variables d'environnement.

## 🔒 Sécurité et Audit

- Authentification via header `x-api-key`.
- Validation stricte des entrées utilisateurs.
- Mode hybride : exécution sécurisée des scripts système uniquement en environnement local protégé.

---
© 2024 Novadis - Système d'inventaire automatisé.
