# La Quête du Chevalier

Petit RPG médiéval en vue de dessus, **jouable hors ligne** sur téléphone (PWA).

## Contenu (Phase 1)

- Un chevalier qu'on dirige au **joystick virtuel** (+ clavier WASD/flèches sur PC)
- 3 zones : **Village de Bonrepos**, **Forêt**, **Grotte de la brute**
- **Combat** à l'épée : slimes, loups, une brute ; cœurs, dégâts, invincibilité brève
- 3 **quêtes** enchaînées (nettoyer / livrer / explorer) avec journal et suivi
- **Or** + **échoppe** (potion, cœur supplémentaire, lame renforcée)
- **Coffre** verrouillé (clé lâchée par la brute), **panneaux**, **puits** qui soigne
- **Sauvegarde automatique** (`localStorage`) — bouton « Continuer » au titre
- Service worker → fonctionne en **mode avion** une fois la page visitée

## Contrôles

| Action | Tactile | Clavier |
|---|---|---|
| Marcher | joystick (moitié gauche de l'écran) | WASD / flèches |
| Frapper | bouton ⚔️ | J / Espace |
| Parler / fouiller | bouton ✋ | E / F |
| Journal | bouton ☰ | M / Échap |

## Lancer en local

```bash
python3 -m http.server 8000
# http://localhost:8000
# http://localhost:8000/#debug  -> expose window.__game pour les tests
```

## Régénérer les icônes

```bash
node gen-icons.js
```

## Idées pour la suite (Phase 2+)

Donjon à étages + boss, système de magie/parchemins, plus de PNJ et de quêtes,
jour/nuit, points de sauvegarde (feux de camp), coffres cachés, mini-carte.
