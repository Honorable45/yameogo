# Prompt — style de design « YAMEOGO », adaptable à un domaine

> Copiez tout ce qui se trouve sous la ligne, remplacez les champs `[ENTRE CROCHETS]`, puis donnez-le à l'IA ou au développeur.

---

## Rôle et objectif

Tu es un designer-développeur front-end senior. Construis le site vitrine de **[NOM DE L'ENTREPRISE]**, une entreprise de **[DOMAINE : ex. boulangerie, salon de coiffure, garage auto, boutique de vêtements]** située à **[VILLE, PAYS]**.
Le site doit reproduire **exactement** le système visuel décrit ci-dessous : mêmes couleurs, typographies, effets « liquid glass », proportions, animations et règles de composition. Seuls changent le contenu, les photos et les rubriques propres au domaine.

- Langue : **[LANGUE, ex. français]**. Devise : **[DEVISE, ex. FCFA]**. Mobile d'abord : la majorité des visiteurs sont sur téléphone.
- Stack : Next.js (App Router) + Tailwind CSS 4, polices auto-hébergées. Si une autre stack est imposée, garde les mêmes valeurs.
- Ton : sobre et vivant. **Très peu de texte** : un titre court par section, pas de paragraphes marketing, pas de chiffres ni de témoignages inventés.

## 1. Esprit général

Éditorial et premium, mais chaleureux. On a l'impression d'un magazine posé sur du papier crème, avec des panneaux en verre dépoli au-dessus de grandes photos.
- Fond **papier chaud** (jamais blanc pur), texte **encre profonde**, **un seul accent froid** (bleu nuit) et **un accent chaud** (ocre) réservé aux mises en avant.
- Filets fins, ombres douces et bleutées, coins très arrondis sur les boutons (pilules).
- Les photos sont les héroïnes : plein cadre, recouvertes d'un voile bleu nuit uni pour garder le texte lisible.

## 2. Couleurs (valeurs exactes)

| Rôle | Nom | Valeur |
|---|---|---|
| Fond de page | paper | `#f5f3ee` |
| Fond secondaire / placeholders d'image | paper-2 | `#edeae3` |
| | paper-3 | `#e4e0d7` |
| Cartes, champs | surface | `#ffffff` |
| Texte principal | ink | `#15171c` |
| Texte secondaire | ink-2 | `#3c414a` |
| Texte discret | muted | `#6b7079` |
| Texte très discret | faint | `#9a9ea6` |
| Filets | line / line-2 | `#e2ded5` / `#cdc8bd` |
| Accent (liens, prix, focus) | accent | `#1b3d7a` (foncé `#11295a`, pâle `#e7ecf5`) |
| Grands aplats, boutons actifs, pied de page | navy | `#0f2147` (variante `#17305f`) |
| Accent chaud (badges, barre de progression, icônes de mise en avant) | ochre | `#c4661f` (foncé `#a4520f`, pâle `#f7e9dc`) |
| Succès | ok | `#2c6848` / pâle `#e3eee7` |
| Alerte | warn | `#8f5510` / pâle `#f4eadb` |
| Erreur | bad | `#a1342a` / pâle `#f5e3e0` |
| Bouton du canal de contact principal (WhatsApp) | — | `#1f9d55`, survol `#188247` |

Ombres :
- carte : `0 1px 2px rgb(15 33 71 / .06), 0 10px 28px -14px rgb(15 33 71 / .28)` ;
- pop : `0 1px 2px rgb(21 23 28 / .05), 0 12px 32px -12px rgb(21 23 28 / .22)`.

Sélection de texte en accent pâle ; focus clavier en contour 2 px accent, décalé de 2 px.

## 3. Typographie

- **Titres** : *Newsreader* (serif éditoriale à taille optique), graisse 500, interlettrage `-0.012em`, interligne `1.04`. Classe utilitaire `display`.
- **Texte** : *IBM Plex Sans* 400 / 500 / 600, taille de base **15 px**, interligne 1.55, anticrénelage activé.
- **Références, codes, numéros** : *IBM Plex Mono*.
- **Chiffres** (prix, quantités) : chiffres tabulaires (`font-variant-numeric: tabular-nums`), classe `num`.
- **Sur-titre** (`eyebrow`) : 11 px, MAJUSCULES, interlettrage `0.14em`, graisse 500, couleur muted.
- Échelle des titres : accueil 64 / 104 / 128 px (mobile / tablette / bureau) ; titre de page 38–56 px ; titre de section 26–36 px. L'accroche de l'accueil est en serif *italique*, 22–30 px.

## 4. Effets « liquid glass » (exacts)

```css
/* Verre sur photo ou fond sombre */
.glass {
  background: rgb(255 255 255 / .14);
  backdrop-filter: blur(18px) saturate(170%);
  border: 1px solid rgb(255 255 255 / .28);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / .35), inset 0 -1px 0 rgb(255 255 255 / .06), 0 10px 30px -12px rgb(8 18 40 / .45);
}
/* Verre clair sur fond papier (en-tête, onglets, encadrés) */
.glass-light {
  background: rgb(255 255 255 / .62);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgb(255 255 255 / .75);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / .9), 0 8px 28px -14px rgb(15 33 71 / .25);
}
/* Verre sombre : boutons d'action sur fond clair ou sur photo */
.glass-dark {
  background: rgb(15 33 71 / .8);
  backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid rgb(255 255 255 / .22);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / .28), 0 10px 26px -12px rgb(8 18 40 / .6);
}
```

Toujours ajouter le préfixe `-webkit-backdrop-filter`. Le reflet supérieur (`inset 0 1px 0`) est indispensable à l'effet.

## 5. Mouvement

- Courbe unique : `cubic-bezier(0.2, 0.7, 0.2, 1)`.
- **Apparition mot par mot** (titre de l'accueil) : chaque mot passe de `opacity 0, translateY(.45em), blur(6px)` à net, en 700 ms. Décalage de 180 ms entre les mots du nom, puis 110 ms entre ceux de l'accroche. Les boutons apparaissent après le dernier mot.
- Survol des cartes et boutons : `translateY(-2px)` en 200 ms. Images des cartes : `scale(1.03)` en 500 ms.
- Transitions d'étape : `slide-up` (opacité + 6 px) en 200 ms.
- Respecter `prefers-reduced-motion` : toutes les animations ramenées à 1 ms.

## 6. Mise en page

- Conteneur : largeur max **76 rem**, marges latérales 16 / 24 / 32 px.
- Espacement vertical entre sections : 64 px sur mobile, 96 px sur bureau.
- Grilles de produits : 2 colonnes sur mobile, 3 sur tablette, 4 sur bureau, gouttières de 12 à 20 px.
- Aucun défilement horizontal, à aucune largeur.

## 7. Composants

**En-tête flottant** : fixé en haut, décollé de 12 px des bords, panneau `glass-light`, arrondi complet sur bureau (28 px sur mobile).
- Ligne 1 : logo à gauche ; à droite, bouton **[RUBRIQUE PRINCIPALE, ex. Boutique]** (pilule `glass-dark`, icône, navy plein quand la page est active), puis le bouton du **[CANAL DE CONTACT]**, vert plein et pilule.
- Sur bureau, la navigation est centrée dans la même ligne. Sur mobile, elle passe sur une **seconde ligne** séparée par un filet blanc, avec des onglets de largeur égale. **Pas de menu hamburger.**
- Onglet actif : pastille navy pleine, texte blanc.

**Accueil** : section pleine hauteur (`100svh`) avec une photo plein cadre et un voile `navy` à 55 %. Au centre, uniquement le **nom** (serif, très grand) et l'**accroche** (serif italique), révélés mot par mot. En dessous, 3 boutons pilules `glass`, puis les icônes des réseaux sociaux. Rien d'autre.

**Bandeau des pages intérieures** : fond navy, photo facultative avec voile à 70 %. En haut à gauche, un bouton **« Retour »** en pilule `glass` avec une flèche. Ensuite un titre serif de 40–56 px, une phrase courte en blanc à 80 %, et le contenu (statistiques, boutons) dans des panneaux `glass`.

**Carte produit** : fond blanc, filet `line`, arrondi 16 px, photo carrée (ou 4:5) sur fond paper-2.
- Badge en haut à gauche : petites capitales, coins presque droits ; couleur ok, ochre ou navy selon la catégorie.
- Bouton **« [ACTION, ex. Acheter / Réserver / Commander] »** en pilule `glass` posé en bas à droite **sur la photo**.
- Sous la photo : nom (14,5 px, 500), détails en muted, puis prix en **accent, 16 px, 600, chiffres tabulaires**, aligné en bas de carte.
- Toute la carte est cliquable. Au survol : levée de 2 px et ombre de carte.

**Boutons** : pilules (`rounded-full`), hauteurs 36 / 44 / 56 px, texte 500 avec icône à gauche. Hiérarchie : `glass-dark` (action principale sur fond clair), `glass` (sur photo), vert plein (canal de contact), lien souligné accent (action secondaire). Au clic : `scale(.98)`.

**Onglets / filtres** : conteneur `glass-light` en pilule, onglet actif navy plein ; les filtres sont des pastilles blanches bordées, navy quand elles sont actives.

**Formulaires** : champs blancs, hauteur 44 px, arrondi 12 px, filet line-2, focus accent. Libellé 13 px en 500, mention « facultatif » en faint, aide en muted 12,5 px. Parcours en étapes : barre de progression en segments ochre / line de 4 px, titre « Étape n » en mono 12 px, puis titre serif.

**Encadrés d'information** : `glass-light`, arrondi 24 px, padding 24 px. Pour les succès, filet gauche de 2 px ok sur fond ok pâle.

**Section photo + verre** (contact, appel à l'action) : photo plein cadre, voile navy à 60–65 %, panneau `glass` arrondi à 24 px contenant le titre serif et les boutons.

**Pied de page** : fond navy, texte papier à 85 %, 3 colonnes (identité et réseaux, liens, horaires), filet `white/10`, mentions légales en 12,5 px à 50 %.

## 8. Adaptation au domaine [DOMAINE]

- **Rubriques du menu** (3 maximum plus la rubrique principale) : **[ex. Accueil · Carte · Réservation · Avis]**.
- **Catalogue** : **[TYPES DE PRODUITS OU SERVICES]**, avec badges de catégorie **[ex. Nouveau / Fait maison / Promo]** sur les couleurs ok, ochre et navy.
- **Action principale sur chaque produit** : **[ex. Commander sur WhatsApp]**. Elle ouvre **[CANAL]** avec un message prérempli : produit, prix, lien.
- **Assistant en étapes** (comme le devis) : **[ex. réservation : date → prestation → récapitulatif → WhatsApp]**. Ne jamais inventer de prix : sans tarif connu, afficher « sur demande ».
- **Photos** : **[DESCRIPTION DES PHOTOS : ex. vitrine, produits sur fond neutre, équipe au travail]**. Lumière naturelle, tons neutres, aucune photo de stock générique avec des personnes souriant face caméra.
- **Accroche** (6 à 8 mots, 3 verbes) : **[ex. « Pétrir, cuire et partager chaque matin »]**.
- **Coordonnées** : **[ADRESSE, TÉLÉPHONE, HORAIRES, RÉSEAUX]**. Une carte et un bouton « Itinéraire » sur la page de l'entreprise.

Si le domaine exige d'autres couleurs de marque, garder **toute la structure** et remplacer seulement `navy`/`accent` (accent froid profond) et `ochre` (accent chaud). Les contrastes doivent rester au moins AA sur fond papier.

## 9. Règles à ne jamais enfreindre

1. Pas de blanc pur en fond de page ; pas de noir pur pour le texte.
2. Un seul accent froid et un seul accent chaud ; pas de dégradés de couleur, uniquement le verre et les voiles unis.
3. Pas de texte inutile, de faux avis, de faux compteurs ni de prix inventés.
4. Contraste AA minimum, focus clavier visible, cibles tactiles de 44 px minimum, attribut `alt` sur chaque image.
5. Aucun défilement horizontal ; tout doit tenir dans l'en-tête sur mobile, sans hamburger.
6. Bouton « Retour » dans le contenu de chaque page intérieure, jamais dans l'en-tête.
7. Animations sobres, désactivées si l'utilisateur réduit les animations.

## 10. Livrables attendus

- Les jetons de design (couleurs, polices, ombres, courbe) déclarés **une seule fois** (`@theme` Tailwind ou variables CSS), et les utilitaires `glass`, `glass-light`, `glass-dark`, `display`, `eyebrow`, `num`, `reveal-word`, `container-page`.
- Les pages : Accueil, [RUBRIQUE PRINCIPALE] (contact, catalogue en onglets, carte), [ASSISTANT], Avis, mentions légales.
- Vérification à 390 px, 768 px et 1440 px de large, avec captures d'écran.
