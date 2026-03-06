# 🛠️ Plan d'implémentation : Interface Web Novadis Scan

Ce document détaille la stratégie pour transformer le script de scan PowerShell en une application Web moderne, professionnelle et ergonomique, déployée sur **Vercel**.

## 🏗️ Architecture Technique

| Composant | Technologie | Rôle |
| :--- | :--- | :--- |
| **Frontend** | [Next.js](https://nextjs.org/) (React) | Interface utilisateur haute performance et SEO-friendly. |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) | Design système utilitaire pour un rendu premium et responsive. |
| **UI Components** | [shadcn/ui](https://ui.shadcn.com/) | Composants accessibles (Radix UI) avec esthétique moderne. |
| **Base de Données** | Supabase (PostgreSQL) | Stockage persistant des inventaires et historique d'évolution. |
| **Stockage Fichiers** | Vercel Blob / Supabase Storage | Hébergement des fichiers `.xlsx` générés et des modèles. |
| **Agent Local** | Agent PowerShell (Script existant) | Collecte des données locales et push vers l'API Web. |

---

## 🎨 Design & Expérience Utilisateur (UX)

### Esthétique "Premium Dark"
*   **Mode Sombre (Dark Mode) :** Implémentation via `next-themes` avec une transition fluide de 300ms. Palette de couleurs : ardoise profonde, accents bleu électrique / cyan.
*   **Glassmorphism :** Utilisation d'effets de flou (`backdrop-blur`) sur les cartes et la barre de navigation.
*   **Micro-animations :** Transitions douces lors de l'ajout de nouvelles machines ou du changement d'onglet via Framer Motion.

---

## 🚀 Fonctionnalités Clés

### 1. Dashboard de Suivi d'Évolution
*   **Vue d'ensemble :** Indicateurs clés (Nombre total de CLT/SRV, état critique des disques, alertes OS obsolètes).
*   **Timeline :** Graphique temporel montrant les changements matériels détectés lors des scans successifs (ex: ajout de RAM, nouveau disque).

### 2. Gestion Dynamique Excel
*   **Upload de Modèle :** Zone de dépôt (Drag & Drop) pour envoyer un fichier `.xlsx` de référence.
*   **Génération à la demande :** L'application traite les données en base pour générer un fichier Excel complet, respectant l'onglet "Serveurs et postes clients".
*   **Téléchargement :** Bouton de téléchargement direct pour récupérer l'inventaire consolidé.

### 3. API de Collecte (Endpoint)
*   **Sécurisation :** Mise en place d'une clé d'API (API Key) pour autoriser le script PowerShell à envoyer les données.
*   **Synchronisation :** Dès qu'un scan local se termine, les données sont envoyées à l'API Next.js qui met à jour l'Excel et la base de données.

---

## 📅 Étapes de Développement (Roadmap)

### Phase 1 : Fondations (Frontend & Dark Mode)
- [ ] Initialisation du projet Next.js avec Tailwind et shadcn/ui.
- [ ] Création du layout principal avec navigation et toggle Dark Mode.
- [ ] Design de la page d'accueil (Hero section & Dashboard vide).

### Phase 2 : Données & API
- [ ] Configuration de Supabase (Tables : Machine, ScanHistory, NetworkConfig).
- [ ] Création de l'API Route `/api/scan/submit` pour recevoir les données JSON de PowerShell.
- [ ] Modification de `script_fiche_synthèse_poste_serveur.ps1` pour appeler l'API.

### Phase 3 : Intelligence Excel & Dashboard
- [ ] Implémentation de la logique de lecture/écriture Excel côté serveur (via `exceljs`).
- [ ] Création de la page "Inventaire" avec tableau filtrable et recherche.
- [ ] Mise en place des graphiques d'évolution des machines.

### Phase 4 : Déploiement & Polish
- [ ] Configuration des variables d'environnement sur Vercel.
- [ ] Premier déploiement de production.
- [ ] Optimisation des performances et tests croisés.

---

> [!IMPORTANT]
> **Sécurité du Réseau Local :** L'interface sur Vercel n'ayant pas accès direct à votre réseau privé, c'est l'agent PowerShell (installé localement) qui agit comme une passerelle sécurisée en "poussant" les informations vers le Web via HTTPS.
