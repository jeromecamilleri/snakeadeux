Original prompt: Fais-moi un jeu Snake en HTML5 canvas, sans framework, un seul fichier.

- TODO: Créer un Snake jouable en un fichier HTML avec canvas.
- TODO: Exposer window.render_game_to_text et window.advanceTime(ms).
- TODO: Tester via le client Playwright du skill et corriger les éventuels bugs.

## Implémentation
- Ajout de `index.html` avec un Snake complet en canvas, sans framework, en un seul fichier.
- États gérés: `menu`, `playing`, `gameover`.
- Contrôles: flèches/WASD, Entrée/Espace pour start, R/Entrée pour restart, F pour plein écran, Esc pour quitter le plein écran.
- Hooks de test: `window.render_game_to_text()` et `window.advanceTime(ms)` exposés.

## Vérification
- Vérification des fichiers du skill: client Playwright et payload de référence présents.
- Tentative d'exécution du client Playwright impossible: dépendance `playwright` absente.
- Tentative d'installation locale `npm install playwright` échouée (réseau indisponible: `ENOTFOUND registry.npmjs.org`).

## TODO pour prochain agent
- Installer `playwright` dès que le réseau est disponible.
- Lancer `web_game_playwright_client.js` contre `index.html` servi localement.
- Vérifier visuellement captures gameplay/menu/gameover et corriger si besoin.

## Validation Playwright (terminée)
- Contrainte technique: le client officiel du skill (`~/.codex/.../web_game_playwright_client.js`) ne résout pas `playwright` depuis ce projet; copie locale faite vers `scripts/web_game_playwright_client.js` pour exécuter le même script avec la dépendance installée.
- Navigateur Playwright installé: `npx playwright install chromium`.
- Scénarios exécutés:
  - `actions_menu.json`: état `mode: menu`, overlay visible, screenshot menu OK.
  - `actions_start_move.json`: démarrage + déplacements, score évolue, état gameplay puis game over observé selon la trajectoire.
  - `actions_gameover.json`: collision murale forcée, `mode: gameover` confirmé.
  - `actions_restart.json`: après game over, restart via `enter` puis reprise de mouvement, `mode: playing` confirmé.
- Console: aucun fichier `errors-*.json` généré sur les runs validés.
- Artefacts: screenshots et états dans `output/web-game-menu`, `output/web-game-run1`, `output/web-game-run2`, `output/web-game-run3`.

## Note de test
- Le client de test mappe `enter`/`space`/flèches/`a`/`b`; pas de mapping `r` côté payload Playwright. Le jeu supporte toujours `R` au clavier en usage réel.

## Ajout suite feedback utilisateur
- Ajout d'un test dédié consommation de pomme: `actions_eat.json`.
- Ajustement gameplay: score passe de `+10` à `+1` par pomme.
- Première pomme rendue déterministe (`{x:13,y:10}`) pour rendre ce test stable.
- Run Playwright `output/web-game-eat` validé:
  - `state-0.json`: `score: 1`
  - `snake` longueur 4 (vs 3 au départ)
  - aucune erreur console.

## Outil de couverture ajouté
- Nouveau script: `scripts/web_game_coverage.mjs`
- Commande npm: `npm run coverage:game`
- Fonction: exécute les fichiers `actions_*.json`, collecte la couverture JS V8 via CDP Playwright, et écrit `output/coverage/summary.json`.
- Résultat actuel: 100% sur `index.html` (7889/7889 bytes) avec le set de scénarios courant.

## Refonte multijoueur partagee (demande utilisateur)
- `index.html` refondu en mode 2 joueurs local avec une logique de monde unique:
  - Une seule grille partagee agrandie: `26x26`.
  - Deux serpents simultanes dans la meme grille (`J1` vert, `J2` violet).
  - Collisions gerees entre les deux (mur, corps, tete-a-tete, echange de tete).
  - Nourriture partagee et score par pomme `+1`.
- Ecran dedouble:
  - Meme monde rendu a gauche et a droite (split-screen duplique).
  - HUD distinct par joueur au-dessus de chaque vue.
- Controles:
  - `J1`: clavier (fleches ou WASD).
  - `J2`: manette Xbox compatible via Gamepad API (`mapping standard`, D-pad ou stick gauche, bouton A start/restart).
  - Si la manette est deconnectee, `J2` reste immobile (pas de mouvement automatique).
- Etats et hooks conserves:
  - `menu`, `playing`, `gameover`.
  - `window.render_game_to_text()` enrichi (grille partagee, 2 joueurs, etat gamepad, vues split).
  - `window.advanceTime(ms)` conserve.

## Validation Playwright sur la refonte
- Runs executes (URL `file:///.../index.html`):
  - `output/mp-menu`: menu + split-screen + etat partage valide.
  - `output/mp-start`: start + mouvement J1 valide.
  - `output/mp-gameover`: transition gameover valide.
  - `output/mp-restart`: restart valide.
  - `output/mp-start-fix2`: validation apres correctif collision/mobilite J2.
- Console: aucune erreur sur les runs ci-dessus.

## Limite de validation auto
- Le client Playwright du skill ne simule pas une manette physique Xbox; la logique Gamepad est implementee mais doit etre verifiee en condition reelle avec une manette connectee.

## Evolution: multijoueur distant (WebRTC P2P)
- Jeu transformé pour supporter un joueur 2 distant en pur HTML/JS (sans backend dédié), avec WebRTC DataChannel.
- Menu de connexion ajouté:
  - `L`: local rapide.
  - `H`: hôte distant -> génération d'un lien d'invitation (`#offer=...`).
  - `J`: rejoindre via code/lien offer.
  - `V` (côté hôte): coller le code answer reçu du client.
- Synchronisation:
  - Hôte autoritaire sur la simulation (collision, score, food, états).
  - Client envoie uniquement les inputs de direction du joueur distant.
  - Hôte envoie des snapshots d'état réguliers pour synchroniser.
- `render_game_to_text` enrichi avec état réseau (`role`, `phase`, erreurs).
- `advanceTime(ms)` conservé.

## Tests après ajout distant
- Validation locale effectuée (menu + start/mouvement) via Playwright:
  - `output/online-menu`
  - `output/online-start`
- Pas d'erreurs console sur ces runs.

## Limites
- Sans serveur de signalisation, la connexion repose sur échange manuel offer/answer via prompt/lien.
- Selon NAT/firewall, la connexion P2P peut échouer. Pour robustesse production: ajouter un serveur de signalisation WebSocket + éventuellement TURN.

## Correctif WebRTC suite test utilisateur (Chrome/Firefox)
- Problème signalé: `Cannot set remote answer in state stable`.
- Correctifs appliqués dans `index.html`:
  - Validation stricte du type SDP (`offer` attendu au join, `answer` attendu côté host).
  - Garde anti-double join (`joinInFlight`).
  - Garde anti-double application de answer côté host (si déjà `stable` + answer posé => ignore proprement).
  - Vérification d'état avant `setRemoteDescription` côté host (`have-local-offer` requis).
  - Suppression d'un décodage inutile sur `#offer` (évite incohérences de parsing).
  - Overlay menu clarifié avec la touche `V` côté hôte.
- Revalidation locale: menu + start OK, aucune erreur console.

## Ajustement UX demandé: start synchronisé + vue unique distante
- Démarrage distant changé en mode "ready":
  - Hôte et client doivent tous deux appuyer `Entree/Espace` pour se marquer prêts.
  - La partie démarre réellement uniquement quand `hostReady && clientReady`.
- Synchronisation ready via DataChannel (`ready`, `ready_state`).
- En mode distant (`host` ou `client`): rendu en vue unique (une seule grille partagée) au lieu du split-screen.
- Le split-screen est conservé uniquement en mode local (`role=none`).
- Contrôles locaux conservés; mapping des rôles affiché (`Distant` vs `Clavier`).

## Mode pas a pas ajoute
- Toggle `T` (hote/local): active/desactive le mode pas a pas.
- En mode pas a pas et pendant la partie:
  - `Entree` (ou Espace) avance exactement d'une case.
  - Bouton manette `RB` (index 5 standard mapping) avance d'une case.
- En distant:
  - Le client envoie une requete de pas (`step_request`) a l'hote.
  - L'hote applique un seul tick et resynchronise l'etat.
  - L'etat `stepMode` est synchronise host->client (`debug_state`).
- `render_game_to_text` expose maintenant `network.stepMode` et `network.pendingSteps`.

## Correctif controles + lisibilite menu
- Controles distants corriges:
  - Host applique les inputs distants au joueur cible (`playerId`) au lieu d'un mapping implicite.
  - Client envoie explicitement `playerId: p2`.
  - Feedback local optimiste cote client sur `p2` (direction).
- En local (`role=none`):
  - J1 = fleches/WASD.
  - J2 = IJKL.
- Identification visuelle renforcee:
  - Pastille couleur dans le HUD de chaque joueur (vert/violet).
  - Texte de pilotage local affichant qui controle quel snake.
- Lisibilite menu:
  - Reduction de la fonte et du line-height du bloc d'instructions.
  - Allègement du bandeau haut en mode menu pour limiter les chevauchements.

## Ajustement bandeau HUD mode distant
- Suppression du doublon d'info en haut (mode pas-a-pas/ready affiché une seule fois).
- Header compacté (`Reseau role/phase`), texte plus court.
- Zone HUD distante redescendue avec plus de hauteur réservée (`hudH` augmenté), pour éviter chevauchement/sortie des cadres.
- Ajout d'un statut court `H:ok/H:... C:ok/C:...` en mode distant.

## Ajout demandé: setup 1 + 2 (test distant automatisé)
- `scripts/dev_signal_server.mjs` ajouté:
  - Sert `index.html` en HTTP local.
  - Fournit un backend de signalisation room-based:
    - `POST/GET /signal/room/:room/offer`
    - `POST/GET /signal/room/:room/answer`
- `index.html` mis à jour:
  - Connexion distante via room server (touches `H`/`J` en HTTP).
  - API d'automatisation exposée: `window.test_api` (`startHostRoom`, `joinRoom`, `setReady`, `toggleStepMode`, `step`, `setDir`, `getState`).
- `scripts/multiplayer_e2e.mjs` ajouté:
  - Ouvre 2 pages Playwright (host/client), connecte la room, active le pas-à-pas, met les 2 prêts.
  - Vérifie que J1 ET J2 avancent sur un step et que l'état host/client est synchronisé.
  - Génère des artefacts: `output/multiplayer-e2e`.
- `package.json` scripts ajoutés:
  - `npm run dev:signal`
  - `npm run test:multiplayer`

## Résultat E2E actuel
- Exécution validée: `Multiplayer E2E OK`.
- États validés montrent bien:
  - host: J1 local + J2 distant, vue unique.
  - client: J1 distant + J2 local, vue unique.
- Ajustement final UI:
  - Correction d'un débordement texte dans le HUD distant (tag actif compacté).

## Demande utilisateur: test clavier 2 fenetres + suppression RB
- RB manette retire pour l'avance pas-a-pas (pas-a-pas clavier uniquement).
- Uniformisation clavier:
  - Distant host (J1 vert): `WASD`
  - Distant client (J2 violet): `IJKL`
  - Local: J1 `WASD`, J2 `IJKL`
- Telemetrie ajoutee: `network.remoteInputCount` dans `render_game_to_text`.
- Nouveau test E2E ajoute: `scripts/multiplayer_keyboard_focus_e2e.mjs`
  - 2 pages host/client
  - Inputs clavier reels (`WASD` host, `IJKL` client), sans `setDir`
  - mode pas-a-pas + ready + step
  - verification de mouvement des 2 snakes et de la synchro
- Script npm ajoute:
  - `npm run test:multiplayer:keyboard`

## Validation
- `Multiplayer keyboard-focus E2E OK`
- `Multiplayer E2E OK` (test existant en regression)

## Changement controles clavier AZERTY
- J1 passe de WASD a `8/4/6/2` (support `Digit` et `Numpad` via `event.code`).
- J2 reste en `IJKL`.
- Libelles UI mis a jour (menu + aide de pilotage).
- Test clavier 2 fenetres adapte (`Digit2` pour J1) et valide.

## Controle tactile mobile ajoute
- Ajout d'un pad tactile in-canvas (haut/bas/gauche/droite) + boutons `PRET` et `STEP`.
- Les taps declenchent les memes actions que le clavier (`handleDirInput`, `tryStartFromInput`, `requestStep`).
- Activation auto sur appareil tactile (`ontouchstart`/`maxTouchPoints`).
- Ajout d'un mode debug `?touch=1` pour forcer l'affichage des controles sur desktop.
- `render_game_to_text` expose l'etat tactile (`touch.enabled`, geometrie boutons).

## Correctif UX menu (demande bouton J graphique)
- Les boutons de menu `LOCAL/HOST/JOIN` sont maintenant affiches et cliquables aussi sur desktop (pas seulement en mode tactile detecte).
- Le bouton `ANSWER` reste affiche en contexte hote `waiting-answer`.
- `pointerdown` traite ces boutons meme sans ecran tactile.
- Validation visuelle: `output/web-game-menu/shot-0.png` montre bien `LOCAL/HOST/JOIN` en bas de l'ecran menu.

## Ajustement demande utilisateur (V retire + PRET mobile)
- Action/clavier `V (hote)` retiree de l'UI et du key handler (plus de workflow manuel answer).
- Le menu ne mentionne plus `V`.
- Ajout d'un bouton menu `PRET: OUI/NON` quand la session distante est connectee (`role!=none && phase=connected`).
- Ce bouton est cliquable sur mobile tactile et desktop (clic souris), et agit comme `Entree/Espace` (toggle ready host/client).
- Validation menu de base: `output/web-game-menu/shot-0.png`.

## Refactor lisibilite niveau 1 (demande utilisateur)
- Decoupage complet de `index.html`:
  - CSS extrait vers `styles.css`.
  - JS extrait en modules ES dans `src/`:
    - `src/constants.js`
    - `src/state.js`
    - `src/game.js`
    - `src/network.js`
    - `src/render.js`
    - `src/input.js`
    - `src/main.js` (bootstrap + hooks test)
- `index.html` est maintenant minimal: canvas + import `styles.css` + `script type="module"`.
- Fonctionnalites conservees: local/distant, mode pas-a-pas, boutons menu LOCAL/HOST/JOIN/PRET, touch controls, `render_game_to_text`, `advanceTime`, `test_api`.

## Verification refactor
- Verification syntaxe modules OK:
  - `node --check src/main.js src/network.js src/render.js src/input.js src/game.js src/state.js`.
- Limitation environnement sandbox de cette session:
  - impossible d'executer Playwright/Chromium (`sandbox_host_linux.cc`),
  - impossible d'ouvrir un serveur local (`listen EPERM` sur 127.0.0.1:4173).
- Tests E2E non relances dans ce contexte; a relancer sur machine utilisateur avec:
  - `npm run dev:signal`
  - `npm run test:multiplayer:keyboard`

## Refactor niveau 2 (decoupage propre)
- Ajout `src/controls.js`:
  - centralise les actions de controle/metier declenchees par UI/input (`toggleStepMode`, `requestStep`, `tryStartFromInput`, `startLocalAction`, `startHostAction`, `joinAction`, `handleDirInput`).
  - export `createActions()` pour fournir un objet d'actions unique au reste de l'app.
- Ajout `src/ui/menu.js`:
  - centralise la logique UI de menu/HUD (`readyStatus*`, `localPilotText`, `readyControlLabel`, `menuOverlayLines`).
  - centralise le layout des boutons tactiles/menu (`touchButtonsLayout`).
- Ajout `src/debug.js`:
  - centralise la generation de l'etat debug (`buildRenderGameToText`).
  - centralise l'exposition des hooks globaux (`installDebugHooks` pour `render_game_to_text`, `advanceTime`, `test_api`).
- `src/render.js` simplifie:
  - consomme `src/ui/menu.js` pour tout le texte/etat menu.
- `src/main.js` simplifie:
  - bootstrap + boucle principale + liaison input/pointer + installation debug.

## Verification niveau 2
- Syntaxe modules validee: `node --check` OK sur `src/main.js`, `src/controls.js`, `src/debug.js`, `src/render.js`, `src/ui/menu.js`.
- Dans ce sandbox, Playwright ne peut pas etre lance (`sandbox_host_linux.cc`), donc pas de rerun E2E ici.
- Test utilisateur precedent confirme sur sa machine avant ce refactor: `npm run test:multiplayer:keyboard` -> OK.

## Niveau 3 (rendu gameplay separe + tests unitaires)
- Rendu separe en sous-modules:
  - `src/render/gameplay.js`: rendu monde + HUD joueurs + vue split/single gameplay.
  - `src/render/overlay.js`: overlays menu/gameover + controles tactiles + dispatch clic/touch.
  - `src/render.js`: orchestration haut niveau (fond, header, gameplay, overlay).
- Logique de controle pure extraite:
  - nouveau `src/controls_logic.js` avec fonctions testables sans DOM:
    - `canToggleStepMode`
    - `canRequestStep`
    - `computeStartIntent`
    - `controlledPlayerIdForRole`
  - `src/controls.js` consomme ces fonctions (comportement conserve).
- Tests unitaires ajoutes:
  - `tests/controls_logic.test.mjs` (Node test runner) couvrant les cas host/client/local.
- Scripts npm:
  - `test` pointe maintenant vers `test:unit`.
  - `test:unit` execute `node --test tests/*.test.mjs`.

## Verification niveau 3
- `npm test` -> OK (tests unitaires passants).
- `node --check` OK sur modules modifies.
- `npm run test:multiplayer:keyboard` non executable dans ce sandbox (Chromium bloque), a rerun cote utilisateur.
