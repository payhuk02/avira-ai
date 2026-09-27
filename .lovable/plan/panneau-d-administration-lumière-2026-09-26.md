# Panneau d'administration Acostudio ai

## Ce que vous obtiendrez
Un espace **/admin** réservé à acostm3500@gmail.com, avec sa propre sidebar sombre (même identité crème / encre / ambre) :

- **Vue d'ensemble** : nombre d'utilisateurs, clips (réussis / en cours / échoués), storyboards, stockage utilisé, activité des 7 derniers jours.
- **Utilisateurs** : liste (e-mail, date d'inscription, dernière connexion, nombre de clips), recherche, suspension / réactivation, suppression de compte, attribution du rôle admin à d'autres personnes.
- **Vidéos** : tous les clips de la plateforme avec filtre par statut / utilisateur, lecture, téléchargement, suppression.
- **Storyboards** : liste globale, consultation et suppression.
- **Clés API** : liste des clés utilisées (passerelle IA vidéo + storyboard). Chaque clé s'affiche masquée (ex. `sk-…4f2a`) ; vous pouvez en saisir une nouvelle, la tester, ou revenir à la clé par défaut. Les valeurs ne sont jamais renvoyées au navigateur.
- **Paramètres** : modèle vidéo et modèle storyboard utilisés, durée max, résolutions autorisées, activation/désactivation des inscriptions et de la génération (mode maintenance).

Un lien « Administration » apparaît dans la sidebar du studio uniquement pour les admins.

## Détails techniques
- Rôles : enum `app_role`, table `user_roles` + fonction `has_role` (security definer). Migration qui insère le rôle admin pour l'utilisateur acostm3500@gmail.com.
- Table `app_settings` (clé/valeur) et table `api_keys` (nom, valeur, mis à jour le) : RLS sans aucune policy client → accès uniquement serveur via service role, après vérification `has_role(admin)` avec `requireSupabaseAuth`.
- `gateway.server.ts` lit d'abord la clé surchargée en base, sinon la variable d'environnement ; idem pour les modèles et limites.
- Suspension : `auth.admin.updateUserById(ban_duration)` ; suppression : `auth.admin.deleteUser` + fichiers du bucket.
- Routes : `src/routes/_authenticated/admin/route.tsx` (garde admin + `AdminShell` avec sidebar) et pages `index`, `utilisateurs`, `videos`, `storyboards`, `cles-api`, `parametres`. Fonctions serveur dans `src/lib/admin.functions.ts`.
- `WorkspaceShell` ne s'applique pas à /admin (layout dédié).
