// Track geometry.
//  - centreline: closed Catmull-Rom spline through control points, resampled every metre
//  - road: left/right half-width per sample (constant for built-in tracks, derived from the
//    drawn lines for editor tracks)
//  - three driving lines (racing / bleu / jaune) stored as lateral offsets from the centreline.
//    `bleu` is always the right-hand side of the ribbon, `jaune` always the left — fixed, whatever
//    way the corner turns. See NOMS_AUTEUR / LINE_NAMES below.
//    Built-in tracks generate them from curvature; editor tracks project the drawn polylines.
//  - a car at lateral offset `lat` follows an offset curve: curvature k/(1+k*lat) and path length
//    scaled by (1+k*lat), so the inside is shorter but tighter, the outside longer but faster.
'use strict';

/* DEUX JEUX DE NOMS, ET LA DIFFÉRENCE COMPTE.

`NOMS_AUTEUR` est le format dans lequel les lignes sont ÉCRITES — dans `tracks.js`, dans l'éditeur,
dans les documents sauvegardés. Il parle de la géométrie du virage : l'intérieure est celle qui
serre la corde, l'extérieure celle qui prend le large. Ces deux-là CHANGENT DE BORD à chaque
changement de main du circuit, et c'est normal : c'est ce que veut dire « intérieur ».

`LINE_NAMES` est le format dans lequel le jeu les JOUE. Il parle de bords fixes : le jaune est
toujours le même côté du ruban, le bleu toujours l'autre, du départ à l'arrivée. Les deux lignes
sont les mêmes points — elles sont simplement rangées par côté au lieu d'être rangées par rôle.

Pourquoi ce changement : un levier dont les deux extrémités échangent de place en roulant ne
s'apprend pas. Pousser vers « l'extérieur » envoyait la voiture à gauche dans un virage et à droite
dans le suivant, et les bords peints — qui portent les mêmes couleurs — changeaient avec lui. Le
joueur doit pouvoir dire « je vais au bord jaune » et que ce soit vrai partout. L'idée est de
Bruno. `_fusionneCotes` fait la conversion, une fois, à la construction.

Le bleu est le côté DROIT (lat négatif), et ce n'est pas arbitraire : la voie des stands est à
droite, et le cran des stands prolonge le bas du levier, donc le bas du levier doit mener du bon
côté. Le jaune est la gauche. */
const NOMS_AUTEUR = ['inside', 'racing', 'outside'];
const LINE_NAMES = ['bleu', 'racing', 'jaune'];

/* Un virage ne peut pas être plus court que la route n'est large : au-delà, le bord intérieur
   passe de l'autre côté du centre de courbure et se replie sur lui-même — le rendu dessine une
   boucle, la physique lit une piste qui se retourne. Le plafond est posé en fraction de la
   demi-largeur ; 0,85 laisse au bord intérieur 15 % du rayon.

   Ce n'est pas un détail de dessin mais une conséquence d'échelle. Les circuits du jeu font environ
   la moitié de leur taille réelle alors que les voitures, elles, sont à l'échelle 1 : une chicane
   de 12 m de rayon à Monza n'en fait plus que 6 ici, pour une route restée large de 15 m. Tant que
   les tracés étaient dessinés à la main, le problème ne se voyait pas — personne ne dessine un
   virage aussi serré. Un relevé, lui, rapporte la vraie chicane, et le heurt apparaît. */
const PLI_MAX = 0.85;

/* Le vibreur : son écart à la ligne blanche, et sa largeur, en mètres.
   `js/render.js` le peint avec ces nombres, `js/car.js` décide avec eux ce qui est encore la piste.
   Un seul jeu de constantes pour les deux, sinon la peinture et la règle divergent en silence. */
const KERB_IN = 0.34;        // le vide entre la ligne blanche et le début de la bande
const KERB_LARGE = 1.7;      // sa largeur au milieu du virage
/* Sur quelle longueur la bande S'AFFINE à chaque bout, en mètres.

   Un vibreur ne s'arrête pas net. Il s'amincit, et c'est ce qui permet de le prendre jusqu'au bout :
   la roue le quitte progressivement au lieu de tomber d'une marche. Le jeu le coupait à l'équerre,
   et la règle de sortie de piste avec — on ne pouvait donc pas le suivre jusqu'à sa fin sans se voir
   compter une faute à l'endroit précis où la peinture s'arrêtait.

   Neuf mètres, soit environ deux longueurs de voiture : assez pour que le biseau se voie et se
   sente, assez court pour que la bande reste pleine là où on s'appuie vraiment. L'affinement suit
   une courbe en S et non une droite — « pente douce » veut dire sans angle, y compris à la jonction
   avec la pleine largeur. */
const KERB_RAMPE = 9;
// De combien la bande déborde du virage, en mètres : peu à l'entrée, beaucoup à la sortie, où
// c'est elle qui rattrape la voiture qui s'élargit. Voir le bloc du vibreur plus bas.
const KERB_AVANT = 6, KERB_APRES = 15;

/* Une zone de dégagement sans contour relevé point par point.

Spa a été relevé sur une image annotée : chaque zone y porte ses propres couples abscisse-largeur,
et c'est ce qu'il faut quand on recopie un tracé réel au pixel près. Les onze autres circuits sont
relevés sur des vues du dessus qui ne sont pas superposables au tracé du jeu — elles disent QUELLE
surface entoure quel virage, pas sa forme exacte en mètres. Pour ceux-là une zone se donne par son
secteur et sa largeur maximale, et le profil se déduit : nul aux extrémités, plein au milieu.

La puissance 0,8 sur le sinus est la même que celle du profil automatique : elle ouvre vite et
ferme vite, alors qu'un sinus pur passe le plus clair de la zone à monter ou à descendre. */
function runoffProfil(zone) {
  const a = zone.from, b = zone.to > zone.from ? zone.to : zone.to + 1;
  const n = 12, pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([a + (b - a) * t, zone.w * Math.pow(Math.sin(Math.PI * t), 0.8)]);
  }
  return pts;
}

// Les lignes bleue et jaune, lissées CONTRE leurs bornes (bords de la piste, ligne idéale) : passes et
// demi-fenêtre en mètres. Voir `_clampLines`.
const LIGNES_COTES = { passes: 12, fenetre: 3 };

class Track {
  // How fast the racing line may cross the road, in metres of lateral per metre travelled.
  static get RACING_SLOPE() { return 0.3; }

  constructor(def, widthScale) {
    this.def = def;
    this.id = def.id;
    this.name = def.name;
    this.theme = def.theme || 'classic';    // palette, see THEMES in js/render.js
    this.puddles = def.puddles || 0;        // standing water: how often, 0 for a dry circuit
    this.laps = def.laps || 3;
    this.ds = 1;
    this.widthScale = widthScale || 1;
    this.image = def.image || null;     // { src, w, h } drawn at world origin with def.scale
    this.drawRoad = def.drawRoad !== false;
    this._build();
    this._buildRunoffs();
    this._buildPads();
    this._joinRunoffs();
    this._constrainStructureRunoffs();
    this._protectParallelRoads();
    this._capRunoffsAtPaths();
    this._buildBarriers();
  }

  // La même géométrie en mètres sert au dessin et aux contacts. Spa est le seul
  // essai activé ; les autres circuits ne construisent ni segments ni index spatial.
  // Profil repris du travail de Claude (28a9082, 4cf3098) : courbure lissée,
  // largeur normalisée, dégagement extérieur uniquement.
  _profilBac() {
    const N = this.n, brutL = new Float32Array(N), brutR = new Float32Array(N);
    // la courbure, dérivée seconde d'une ligne échantillonnée au mètre, est bruitée : on l'adoucit
    // sur dix mètres avant de s'en servir comme pondération
    const G = Math.max(1, Math.round(10 / this.ds)), ks = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      let somme = 0;
      for (let j = -G; j <= G; j++) somme += Math.abs(this.k[((i + j) % N + N) % N]);
      ks[i] = somme / (2 * G + 1);
    }
    for (const cn of this.corners) {
      const span = Math.max(1, cn.to - cn.from);
      let kmax = 0;
      for (let t = 0; t <= span; t++) {
        const a = ks[((cn.from + t) % N + N) % N];
        if (a > kmax) kmax = a;
      }
      if (!kmax) continue;
      /* La courbure PONDÈRE la largeur, elle ne la dicte pas : à elle seule, elle effondrait les
         dégagements des courbes longues, où le pic de courbure est bref et le reste de l'arc deux
         fois moins serré. Un dégagement existe sur tout le virage ; il est simplement plus large
         au plus serré. D'où un plancher à quatre dixièmes.

         Et le profil est RAMENÉ À `BAC_M` À SON SOMMET, virage par virage. Sans ça, le produit de
         deux facteurs inférieurs à un donne un bac qui n'atteint jamais sa largeur nominale, et
         la forme qu'on vient de régler se paie d'un dégagement deux fois trop petit. La forme dit
         où le sable est large ; `BAC_M` dit combien. */
      const forme = new Float32Array(span + 1);
      let fmax = 0;
      for (let t = 0; t <= span; t++) {
        const i = ((cn.from + t) % N + N) % N;
        const rel = Math.min(1, ks[i] / kmax);
        const f = (0.4 + 0.6 * rel) * Math.pow(Math.sin(Math.PI * (t / span)), 0.9);
        forme[t] = f;
        if (f > fmax) fmax = f;
      }
      if (!fmax) continue;
      /* LE DÉGAGEMENT EST À L'EXTÉRIEUR DU VIRAGE, et seulement là. Une voiture qui perd le train
         arrière part vers l'extérieur ; l'intérieur est l'endroit où l'on COUPE, pas celui où
         l'on sort. Le bac était posé des deux côtés, ce qui donnait un croissant de sable à
         l'intérieur d'une épingle — et, de proche en proche, un bout de mur de pneus planté là où
         personne n'arrivera jamais.

         La normale est la gauche en repère y vers le bas : mesuré sur les vingt virages de Spa,
         une courbure positive met le centre du cercle du côté -n, donc l'extérieur est le côté
         +n. */
      const cote = (cn.sign || Math.sign(this.k[((cn.from + (span >> 1)) % N + N) % N])) > 0
        ? brutL : brutR;
      for (let t = 0; t <= span; t++) {
        const i = ((cn.from + t) % N + N) % N;
        const w = Track.BAC_M * forme[t] / fmax;
        if (w > cote[i]) cote[i] = w;
      }
    }
    /* ON LISSE LA COURBURE, PAS LE PROFIL — et c'est la correction qui compte ici. Lisser le
       profil fini sur quinze mètres écrasait les virages COURTS : une épingle de neuf mètres
       d'arc voyait son sommet moyenné avec vingt-deux mètres de zéros, et elle sortait à 3,6 m
       de sable là où une longue courbe en gardait onze. C'est l'inverse de ce qu'il faut — une
       épingle est exactement l'endroit où l'on sort.

       Le profil est déjà lisse par construction : un sinus puissance 0,9 n'a pas de marche. Seule
       la courbure était bruitée, et c'est elle qu'on lisse, en amont. Il ne reste au bout qu'un
       arrondi de cinq mètres pour adoucir la jonction entre deux virages voisins. */
    const F = Math.max(1, Math.round(5 / this.ds));
    const lisse = (brut) => {
      const out = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        let somme = 0;
        for (let k = -F; k <= F; k++) somme += brut[((i + k) % N + N) % N];
        out[i] = somme / (2 * F + 1);
      }
      return out;
    };
    return { L: lisse(brutL), R: lisse(brutR) };
  }

  // Les contours annotés priment sur la détection des virages. Une zone peut
  // traverser une ligne droite ou un changement de courbure sans être morcelée.
  _buildRunoffs() {

    if (!this.def.runoffs && this.def.defaultRunoff !== 'asphalt') return;
    this.bacW = this.def.annotatedRunoffsOnly
      ? {L:new Float32Array(this.n),R:new Float32Array(this.n)} : this._profilBac();
    this.asphaltW = { L: new Float32Array(this.n), R: new Float32Array(this.n) };
    // Les circuits urbains n'ont pas de bacs automatiques : même enveloppe, en bitume.
    if(this.def.defaultRunoff === 'asphalt'){
      this.asphaltW.L.set(this.bacW.L);this.asphaltW.R.set(this.bacW.R);
      this.bacW.L.fill(0);this.bacW.R.fill(0);
    }
    for (const zone of this.def.runoffs || []) {
      const pts = zone.points || runoffProfil(zone), side = zone.side > 0 ? 'L' : 'R';
      const first = pts[0][0], last = pts[pts.length - 1][0];
      let crete = 0;
      for (const p of pts) if (p[1] > crete) crete = p[1];
      for (let i = 0; i < this.n; i++) {
        // Accepte aussi les secteurs passant par la ligne de départ (fin > 1).
        let f = i / this.n;
        if (f < first) f += 1;
        if (f < first || f > last) continue;
        let j = 0;
        while (j < pts.length - 2 && f > pts[j + 1][0]) j++;
        const a = pts[j], b = pts[j + 1], u = (f - a[0]) / (b[0] - a[0]);
        let w = Math.max(0, a[1] + (b[1] - a[1]) * u);
        // Une zone mixte conserve le gravier extérieur et son enveloppe de protection.
        if(zone.keepOuterGravel)w=Math.min(w,this.bacW[side][i]);
        /* La zone déclarée CHASSE le profil automatique au lieu de l'écraser.

        Une zone s'ouvre à zéro et se ferme à zéro ; le profil tiré de la courbure, lui, ne
        s'arrête pas exactement là. Remplacer la valeur sèchement laissait donc une falaise à
        chaque extrémité : d'un nœud à l'autre, la largeur passait de douze mètres à rien, et avec
        elle la barrière qui la suit. Le profil automatique est maintenant retiré À LA MESURE de
        la zone qui le remplace : entier là où elle est nulle, nul là où elle est pleine. Le
        raccord est continu des deux côtés sans qu'on ait à faire coïncider les bouts à la main.

        Il reste donc, aux extrémités d'un dégagement bitumé, un liseré où le gravier n'a pas
        encore disparu derrière le bitume. C'est quelques mètres sur la longueur d'un virage, et
        c'est ce que montrent beaucoup de circuits réels : un tablier d'asphalte, puis du gravier
        au-delà. */
        const reste = zone.keepOuterGravel ? this.bacW[side][i]
          : crete > 0 ? this.bacW[side][i] * Math.max(0, 1 - w / crete) : this.bacW[side][i];
        this.bacW[side][i] = zone.surface === 'gravel' ? Math.max(w, reste)
          : zone.surface === 'grass' ? 0 : reste;
        this.asphaltW[side][i] = zone.surface === 'asphalt' ? w : 0;
      }
    }
  }

  _joinRunoffs() {
    const gap=this.def.runoffJoinGap;
    if(!gap)return;
    const r=Math.ceil(gap/2);
    for(const layer of [this.bacW,this.asphaltW])if(layer)for(const key of ['L','R']){
      const a=layer[key],N=a.length,dilated=new Float32Array(N),closed=new Float32Array(N);
      // Fermeture morphologique : combler les creux courts entre deux lobes,
      // sans transformer le tracé de la route ni seulement remplir à une largeur minimale.
      for(let i=0;i<N;i++)for(let k=-r;k<=r;k++)dilated[i]=Math.max(dilated[i],a[(i+k+N)%N]);
      for(let i=0;i<N;i++){
        let value=Infinity;for(let k=-r;k<=r;k++)value=Math.min(value,dilated[(i+k+N)%N]);
        closed[i]=value;
      }
      for(let i=0;i<N;i++){
        let total=0;for(let k=-6;k<=6;k++)total+=closed[(i+k+N)%N];a[i]=total/13;
      }
    }
  }

  _constrainStructureRunoffs() {
    if(!this.tunnels.length&&!this.crossings.length)return;
    for(let i=0;i<this.n;i++){
      const f=1-this._structureBlend(i*this.ds);
      for(const layer of [this.bacW,this.asphaltW])if(layer)for(const key of ['L','R'])layer[key][i]*=f;
    }
  }

  barrierLevelAt(s) {
    return this.crossings.some(cr=>Math.abs(this.diff(s,cr.over*this.ds))<24)?1:0;
  }

  _structureBlend(s) {
    let f=0;
    for(const tu of this.tunnels){
      const d=(s-tu.from*this.ds+this.length)%this.length,n=tu.n*this.ds;
      if(d<=n)f=1;
      else f=Math.max(f,Math.max(0,1-Math.min(d-n,this.length-d)/18));
    }
    for(const cr of this.crossings){
      const d=Math.abs(this.diff(s,cr.over*this.ds));
      f=Math.max(f,Math.max(0,Math.min(1,(42-d)/18)));
    }
    for(const pass of this.underpasses||[]){
      const d=Math.abs(this.diff(s,pass.s));
      f=Math.max(f,Math.max(0,Math.min(1,(pass.half+18-d)/18)));
    }
    return f;
  }

  _protectParallelRoads() {
    this.parallelLimits=null;
    if(!this.def.parallelClearance)return;
    const N=this.n, garages=this.pitGarages(),levels=Uint8Array.from({length:this.n},(_,i)=>this.barrierLevelAt(i*this.ds));
    this.parallelLimits={L:new Float32Array(N).fill(1e6),R:new Float32Array(N).fill(1e6)};
    // Intersection des rayons latéraux avec les couloirs des branches éloignées.
    // Échantillons tous les 2 m, marge incluant vibreurs et volume des protections.
    for(let i=0;i<N;i++)for(const side of [-1,1]){
      const key=side>0?'L':'R',hw=side>0?this.hwL[i]:this.hwR[i];
      // Le rail intérieur ne peut pas suivre un décalage au-delà du rayon du virage.
      let limit=this.k[i]*side<0?Math.max(hw,.7/Math.max(1e-6,Math.abs(this.k[i]))):1e6;
      for(let j=0;j<N;j+=2){
        if(levels[i]!==levels[j])continue;
        const arc=Math.min(Math.abs(j-i),N-Math.abs(j-i));
        if(arc*this.ds<45)continue;
        const dx=this.xs[j]-this.xs[i],dy=this.ys[j]-this.ys[i];
        if(dx*dx+dy*dy>10000)continue;
        const along=(dx*this.nx[i]+dy*this.ny[i])*side;
        if(along<0)continue;
        const r=Math.max(this.hwL[j],this.hwR[j])+this.kerb[j]+3;
        const across=dx*dx+dy*dy-along*along;
        if(across>=r*r)continue;
        const hit=along-Math.sqrt(r*r-across);
        limit=Math.min(limit,Math.max(hw,hit));
      }
      // Les garages fixes des stands peuvent border une AUTRE branche du tour.
      // Leur emprise réelle et son accès restent libres de gravier et de protections.
      for(const gr of garages){
        if(this.barrierLevelAt(i*this.ds)!==this.barrierLevelAt(gr.s))continue;
        const cs=Math.cos(gr.a),sn=Math.sin(gr.a),dx=this.xs[i]-gr.x,dy=this.ys[i]-gr.y;
        const ox=dx*cs+dy*sn,oy=-dx*sn+dy*cs;
        const vx=(this.nx[i]*cs+this.ny[i]*sn)*side,vy=(-this.nx[i]*sn+this.ny[i]*cs)*side;
        let near=0,far=1e6;
        for(const [o,v,half] of [[ox,vx,gr.w/2+5],[oy,vy,gr.h/2+5]]){
          if(Math.abs(v)<1e-9){if(Math.abs(o)>half){far=-1;break;}}
          else {const a=(-half-o)/v,b=(half-o)/v;near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));}
        }
        if(far>=near&&far>=0)limit=Math.min(limit,Math.max(hw,near));
      }
      this.parallelLimits[key][i]=limit;
    }
    // Un abaissement conservateur adoucit les raccords sans réélargir la zone.
    for(const key of ['L','R']){
      const limits=this.parallelLimits[key],smooth=new Float32Array(limits);
      for(let i=0;i<N;i++)for(let d=-12;d<=12;d++){
        const j=(i+d+N)%N;smooth[i]=Math.min(smooth[i],limits[j]+Math.abs(d)*.25);
      }
      this.parallelLimits[key]=smooth;
      for(let i=0;i<N;i++){
        const hw=key==='L'?this.hwL[i]:this.hwR[i],cap=Math.max(0,smooth[i]-hw-2.5);
        if(this.bacW)this.bacW[key][i]=Math.min(this.bacW[key][i],cap);
        if(this.asphaltW)this.asphaltW[key][i]=Math.min(this.asphaltW[key][i],cap);
      }
    }
  }

  runoffWidthAt(s, side) {
    const key = side > 0 ? 'L' : 'R';
    return Math.max(this.bacW ? this._lerp(this.bacW[key], s) : 0,
      this.asphaltW ? this._lerp(this.asphaltW[key], s) : 0);
  }

  /* LES SURFACES DESSINÉES : une zone bitumée qu'aucun décalage latéral ne sait décrire.

  À l'intérieur d'une épingle serrée, un dégagement mesuré depuis le bord se replie sur lui-même
  dès qu'il dépasse le rayon du virage. `asphaltPads` donne alors le contour relevé sur l'image
  annotée, en mètres du monde : la surface est le polygone fermé par le bord de piste entre ses
  deux extrémités. `free:true` ferme directement le contour dessiné pour combler un îlot.
  La matière (bitume par défaut ou gravier) est partagée par le rendu et la physique. */
  _buildPads(){
    this.pads=[];
    for(const p of this.def.asphaltPads||[]){
      if (!Array.isArray(p.pts) || p.pts.length < 3) continue;
      const surface = p.surface === 'gravel' ? 'gravel' : 'asphalt';
      if (p.free) {
        const poly=p.pts.map(q=>q.slice()), xs=poly.map(q=>q[0]),ys=poly.map(q=>q[1]);
        this.pads.push({side:p.side,surface,poly,bbox:{minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)}});
        continue;
      }
      const first=p.pts[0],last=p.pts.at(-1),W=Math.ceil(this.n/2)+1;
      let a=this.project(first[0],first[1],0,W).s,b=this.project(last[0],last[1],0,W).s;
      if(this.wrap(b-a)>this.length/2)[a,b]=[b,a];
      const poly=[],span=this.wrap(b-a);
      for(let d=0;d<=span;d+=2){
        const u=this.wrap(a+d),hw=p.side>0?this.hwLeftAt(u):this.hwRightAt(u),q=this.pos(u,p.side*hw);
        poly.push([q.x,q.y]);
      }
      const pts=this.wrap(this.project(first[0],first[1],0,W).s-a)<1?p.pts.slice().reverse():p.pts.slice();
      poly.push(...pts);
      const xs=poly.map(q=>q[0]),ys=poly.map(q=>q[1]);
      this.pads.push({side:p.side,surface,poly,bbox:{minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)}});
    }
  }

  padAt(x,y){
    for(let k=(this.pads||[]).length-1;k>=0;k--){
      const p=this.pads[k];
      const b=p.bbox;if(x<b.minX||x>b.maxX||y<b.minY||y>b.maxY)continue;
      let inside=false;
      for(let i=0,j=p.poly.length-1;i<p.poly.length;j=i++){
        const [xi,yi]=p.poly[i],[xj,yj]=p.poly[j];
        if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
      }
      if(inside)return p.surface;
    }
    return false;
  }

  runoffSurfaceAt(s, lat) {
    const side = lat >= 0 ? 'L' : 'R';
    const d = Math.abs(lat) - (lat >= 0 ? this.hwLeftAt(s) : this.hwRightAt(s));
    if (d <= 0) return 'asphalt';
    if (this.pads && this.pads.length) { const q = this.pos(s, lat); const surface=this.padAt(q.x, q.y); if (surface) return surface; }
    if (this.asphaltW && d <= this._lerp(this.asphaltW[side], s)) return 'asphalt';
    if (this.bacW && d <= this._lerp(this.bacW[side], s)) return 'gravel';
    return 'grass';
  }

  /* Jusqu'où le circuit s'étend avant que le paysage commence.

  La protection ne longe pas le ruban : elle se pose au-delà du vibreur et de tout le dégagement,
  gravier ou bitume. Le décor, lui, doit commencer derrière elle. Les deux lectures étaient faites
  séparément — `_buildBarriers` pour poser les rails, `placeFrom` pour écarter les arbres — et
  elles ne donnaient pas la même distance, si bien qu'un arbre pouvait pousser sur un bac. C'est
  maintenant une seule mesure. */
  limiteProtection(s, side) {
    const trace=this._barrierPathLat(s,side);
    if(trace!=null)return trace;
    const hw = side > 0 ? this.hwLeftAt(s) : this.hwRightAt(s);
    const runoff = this.runoffWidthAt(s, side);
    // Neuf mètres sur l'herbe. Le raccord garde le placement existant au bord
    // des grands dégagements et évite une marche à leur entrée/sortie.
    const u = Math.min(1, runoff / 6), t = u * u * (3 - 2 * u);
    const verge = (this.def.grassBarrierGap ?? 9) * (1 - t) + 2.2 * t;
    let wanted=hw + Math.max(this.kerbAt(s) + verge, runoff + 1.5);
    for(const z of this.def.barrierCloseZones||[]){
      if(z.side!==side)continue;
      let f=this.wrap(s)/this.length;if(f<z.from)f+=1;
      if(f<z.from||f>z.to)continue;
      const fade=Math.min(1,(f-z.from)*this.length/8,(z.to-f)*this.length/8);
      const near=hw+Math.max(this.kerbAt(s)+1.5,runoff+1.5);
      wanted+=(near-wanted)*Math.max(0,fade);
    }
    let distance=this.parallelLimits?Math.min(wanted,this._lerp(this.parallelLimits[side>0?'L':'R'],s)):wanted;
    const blend=this._structureBlend(s);
    distance+=(hw+this.kerbAt(s)+1.1-distance)*blend;
    distance=Math.max(distance,hw+runoff+1.1);
    return distance;
  }

  /* LES TRAITS D'UNE REPRISE : la protection suit le dessin.

  Le décalage calculé fait des marches là où une branche voisine, un garage ou la fin d'un
  dégagement le contraignent, et des pointes à l'intérieur des épingles. `barrierPaths` remplace,
  sur un secteur et un côté, la protection calculée par la ligne relevée sur l'image annotée :
  des points du monde en mètres, dans l'ordre du trait, avec le secteur [from, to] de la branche
  qu'ils bordent. Chaque point est projeté sur cette branche seulement — un trait tiré entre deux
  portions voisines ne se raccroche pas à la mauvaise. Les bouts rejoignent la protection
  calculée ; collisions, rendu et décor lisent les mêmes segments. */
  _barrierPaths(){
    if(this._paths)return this._paths;
    const L=this.length;
    this._paths=(this.def.barrierPaths||[]).filter(Boolean).map(p=>{
      const a0=this.wrap(p.from*L),span0=this.wrap(p.to*L-a0),W=Math.ceil(span0/2/this.ds)+40;
      const pts=p.pts.map(([x,y])=>{
        const pr=this.project(x,y,this.wrap(a0+span0/2),W),s=this.wrap(pr.s);
        // Un trait libre borde une surface dessinée (`asphaltPads`) : il garde sa forme exacte.
        if(p.free)return {s,lat:pr.lat,x,y};
        const hw=p.side>0?this.hwLeftAt(s):this.hwRightAt(s),min=hw+this.kerbAt(s)+1.6;
        // Jamais sur la chaussée ni sur le vibreur, même si le trait les frôle : un rail garde au
        // moins un mètre d'herbe entre son épaisseur et le bord.
        if(Math.abs(pr.lat)>=min&&Math.sign(pr.lat)===p.side)return {s,lat:pr.lat,x,y};
        const q=this.pos(s,p.side*min);return {s,lat:p.side*min,x:q.x,y:q.y};
      });
      const a=pts[0].s,b=pts.at(-1).s;
      return {side:p.side,pts,a,b,span:this.wrap(b-a)};
    });
    return this._paths;
  }

  // Distance latérale du trait à cette abscisse, ou null hors de tout trait.
  _barrierPathLat(s,side){
    if(!this.def.barrierPaths)return null;
    for(const p of this._barrierPaths()){
      if(p.side!==side||this.wrap(s-p.a)>p.span)continue;
      const d=this.wrap(s-p.a);
      for(let k=0;k+1<p.pts.length;k++){
        const u0=this.wrap(p.pts[k].s-p.a),u1=this.wrap(p.pts[k+1].s-p.a);
        if(u1<=u0||d<u0||d>u1)continue;
        const t=(d-u0)/(u1-u0);
        return Math.abs(p.pts[k].lat+(p.pts[k+1].lat-p.pts[k].lat)*t);
      }
    }
    return null;
  }

  // Les segments des traits, en monde, avec leur niveau (pont ou sol).
  _pathSegments(){
    if(this._pathSegs)return this._pathSegs;
    this._pathSegs=[];
    for(const p of this._barrierPaths())for(let k=1;k<p.pts.length;k++){
      const a=p.pts[k-1],b=p.pts[k];
      this._pathSegs.push({ax:a.x,ay:a.y,bx:b.x,by:b.y,level:this.barrierLevelAt(a.s),
        minX:Math.min(a.x,b.x),maxX:Math.max(a.x,b.x),minY:Math.min(a.y,b.y),maxY:Math.max(a.y,b.y)});
    }
    return this._pathSegs;
  }

  /* Un dégagement ne passe pas derrière la protection dessinée — ni celui de la branche que le
  trait borde, ni celui d'une branche voisine dont il coupe le couloir : on lance un rayon depuis
  l'axe, perpendiculaire à la piste, et le premier trait rencontré borne la largeur. */
  _capRunoffsAtPaths(){
    if(!this.def.barrierPaths)return;
    const segs=this._pathSegments(),R=80;
    for(let i=0;i<this.n;i++){
      const x=this.xs[i],y=this.ys[i],level=this.barrierLevelAt(i*this.ds);
      const near=segs.filter(g=>g.level===level&&g.maxX>x-R&&g.minX<x+R&&g.maxY>y-R&&g.minY<y+R);
      if(!near.length)continue;
      for(const side of [-1,1]){
        const dx=this.nx[i]*side,dy=this.ny[i]*side;
        let t=Infinity;
        for(const g of near){
          const ex=g.bx-g.ax,ey=g.by-g.ay,den=dx*ey-dy*ex;
          if(Math.abs(den)<1e-9)continue;
          const wx=g.ax-x,wy=g.ay-y,u=(wx*ey-wy*ex)/den,v=(wx*dy-wy*dx)/den;
          if(u>0&&v>=0&&v<=1&&u<t)t=u;
        }
        if(t>R)continue;
        const key=side>0?'L':'R',hw=side>0?this.hwL[i]:this.hwR[i],cap=Math.max(0,t-hw-1.2);
        for(const layer of [this.bacW,this.asphaltW])if(layer)layer[key][i]=Math.min(layer[key][i],cap);
      }
    }
  }

  /* Une protection calculée cachée derrière un trait, ou qui le croise, disparaît : le trait
  devient la séparation commune des deux branches. « Cachée » se lit depuis la piste qui la porte —
  le segment qui joint son axe au milieu de la protection traverse le trait. */
  _hideBehindPaths(paths){
    const segs=this.barriers.filter(b=>b.drawn).map(b=>({ax:b.ax,ay:b.ay,bx:b.bx,by:b.by,level:b.level||0,
      minX:Math.min(b.ax,b.bx),maxX:Math.max(b.ax,b.bx),minY:Math.min(b.ay,b.by),maxY:Math.max(b.ay,b.by)}));
    const cut=(ax,ay,bx,by,g,m=.02)=>{
      const rx=bx-ax,ry=by-ay,ex=g.bx-g.ax,ey=g.by-g.ay,den=rx*ey-ry*ex;
      if(Math.abs(den)<1e-9)return false;
      const wx=g.ax-ax,wy=g.ay-ay,u=(wx*ey-wy*ex)/den,v=(wx*ry-wy*rx)/den;
      return u>m&&u<1-m&&v>m&&v<1-m;
    };
    this.barriers=this.barriers.filter(b=>{
      if(b.drawn)return true;
      if(paths.some(p=>p.side===b.side&&this.wrap(b.s-p.a+12)<=p.span+24))return true;
      const mx=(b.ax+b.bx)/2,my=(b.ay+b.by)/2,o=this.pos(b.s,0),lv=b.level||0;
      for(const g of segs){
        if(g.level!==lv||g.maxX<Math.min(o.x,b.ax,b.bx)-1||g.minX>Math.max(o.x,b.ax,b.bx)+1
          ||g.maxY<Math.min(o.y,b.ay,b.by)-1||g.minY>Math.max(o.y,b.ay,b.by)+1)continue;
        if(cut(o.x,o.y,mx,my,g)||cut(b.ax,b.ay,b.bx,b.by,g,1e-4))return false;
      }
      return true;
    });
  }

  largeurBac(i, cote) {
    const N = this.n;
    if (!this.bacW) this.bacW = this._profilBac();
    const k = ((i % N) + N) % N;
    if (cote > 0) return this.bacW.L[k];
    if (cote < 0) return this.bacW.R[k];
    return Math.max(this.bacW.L[k], this.bacW.R[k]);
  }

  _trimBarrierLoops() {
    const cross=(ax,ay,bx,by)=>ax*by-ay*bx;
    for(let i=0;i<this.barriers.length;i++){
      const a=this.barriers[i];
      for(let j=i+1;j<this.barriers.length&&j<i+80;j++){
        const b=this.barriers[j];if(b.side!==a.side||b.s-a.s>150)break;
        if(b.level!==a.level)continue;
        const ax=a.bx-a.ax,ay=a.by-a.ay,bx=b.bx-b.ax,by=b.by-b.ay,den=cross(ax,ay,bx,by);
        if(Math.abs(den)<1e-8)continue;
        const dx=b.ax-a.ax,dy=b.ay-a.ay,u=cross(dx,dy,bx,by)/den,v=cross(dx,dy,ax,ay)/den;
        if(u<=1e-6||u>=1-1e-6||v<=1e-6||v>=1-1e-6)continue;
        const x=a.ax+ax*u,y=a.ay+ay*u;a.bx=x;a.by=y;b.ax=x;b.ay=y;
        this.barriers.splice(i+1,j-i-1);i=Math.max(-1,i-1);break;
      }
    }
  }

  _mergeBarrierGeometry() {
    const nodes=new Map();
    const node=(x,y,level)=>{
      const key=level+':'+x.toFixed(4)+':'+y.toFixed(4);
      if(!nodes.has(key))nodes.set(key,{x,y,n:1});return nodes.get(key);
    };
    const root=n=>{while(n.parent)n=n.parent;return n;};
    const mean=(a,b)=>{a=root(a);b=root(b);return {x:(a.x*a.n+b.x*b.n)/(a.n+b.n),y:(a.y*a.n+b.y*b.n)/(a.n+b.n)};};
    const join=(a,b)=>{a=root(a);b=root(b);if(a===b)return;const m=mean(a,b);a.x=m.x;a.y=m.y;a.n+=b.n;b.parent=a;};
    const safe=(p,level)=>{
      for(let j=0;j<this.n;j+=2){
        if(this.barrierLevelAt(j*this.ds)!==level)continue;
        const radius=Math.max(this.hwL[j],this.hwR[j])+this.kerb[j]+.6;
        if(Math.hypot(p.x-this.xs[j],p.y-this.ys[j])<radius)return false;
      }return true;
    };
    const list=this.barriers.map(b=>({...b,A:node(b.ax,b.ay,b.level||0),B:node(b.bx,b.by,b.level||0)}));
    this.mergedBarriers=0;
    for(let pass=0;pass<4;pass++){
      const bins=new Map(),cell=16;
      const cells=b=>{
        const a=root(b.A),c=root(b.B),out=[];
        for(let x=Math.floor((Math.min(a.x,c.x)-4)/cell);x<=Math.floor((Math.max(a.x,c.x)+4)/cell);x++)
          for(let y=Math.floor((Math.min(a.y,c.y)-4)/cell);y<=Math.floor((Math.max(a.y,c.y)+4)/cell);y++)out.push(x+','+y);
        return out;
      };
      for(let i=0;i<list.length;i++)for(const key of cells(list[i])){
        if(!bins.has(key))bins.set(key,[]);bins.get(key).push(i);
      }
      for(let i=0;i<list.length;i++){
        const near=new Set();for(const key of cells(list[i]))for(const j of bins.get(key)||[])if(j>i)near.add(j);
        for(const j of [...near].sort((a,b)=>a-b)){
      const a=list[i],b=list[j];if(a.level!==b.level||a.drawn||b.drawn)continue; // un trait relevé ne bouge pas
      if(Math.abs(this.diff(a.s,b.s))<45)continue;
      let A=root(a.A),B=root(a.B),C=root(b.A),D=root(b.B);
      if(A===C||A===D||B===C||B===D)continue;
      const ux=B.x-A.x,uy=B.y-A.y,vx=D.x-C.x,vy=D.y-C.y;
      const la=Math.hypot(ux,uy),lb=Math.hypot(vx,vy);if(la<.1||lb<.1)continue;
      if(Math.hypot((A.x+B.x-C.x-D.x)/2,(A.y+B.y-C.y-D.y)/2)>5)continue;
      const den=ux*vy-uy*vx,dx=C.x-A.x,dy=C.y-A.y;
      const ta=(dx*vy-dy*vx)/den,tb=(dx*uy-dy*ux)/den;
      const crossing=Math.abs(den)>1e-8&&ta>0&&ta<1&&tb>0&&tb<1;
      const parallel=Math.abs((ux*vx+uy*vy)/(la*lb))>.9;
      if(!crossing&&!parallel)continue;
      if(ux*vx+uy*vy<0)[C,D]=[D,C];
      const mergeReach=crossing?12:3;
      if(Math.hypot(A.x-C.x,A.y-C.y)>mergeReach||Math.hypot(B.x-D.x,B.y-D.y)>mergeReach)continue;
      const m0=mean(A,C),m1=mean(B,D);
      if(!safe(m0,a.level||0)||!safe(m1,a.level||0))continue;
      join(A,C);join(B,D);this.mergedBarriers++;
        }
      }
    }
    const seen=new Map();
    this.barriers=[];
    for(const b of list){
      const a=root(b.A),c=root(b.B);if(a===c)continue;
      const keys=[a.x.toFixed(4)+','+a.y.toFixed(4),c.x.toFixed(4)+','+c.y.toFixed(4)].sort();
      const key=(b.level||0)+':'+keys.join('/');
      if(seen.has(key)){seen.get(key).owners.push({s:b.s,side:b.side});continue;}
      const {A,B,...clean}=b;
      const merged={...clean,common:a.n>1||c.n>1,ax:a.x,ay:a.y,bx:c.x,by:c.y,owners:[{s:b.s,side:b.side}]};
      this.barriers.push(merged);seen.set(key,merged);
    }
  }

  _trimRunoffsAtBarriers(){
    for(const b of this.barriers.filter(b=>b.common))for(const owner of b.owners||[{s:b.s,side:b.side}]){
      for(let d=-3;d<=3;d++){
        const i=this.idx(owner.s+d),x=this.xs[i],y=this.ys[i];
        const dx=b.bx-b.ax,dy=b.by-b.ay,den=dx*dx+dy*dy;
        const u=clamp(((x-b.ax)*dx+(y-b.ay)*dy)/(den||1),0,1);
        const lat=((b.ax+u*dx-x)*this.nx[i]+(b.ay+u*dy-y)*this.ny[i])*owner.side;
        const key=owner.side>0?'L':'R',hw=owner.side>0?this.hwL[i]:this.hwR[i];
        const cap=Math.max(0,lat-hw-.4);
        for(const layer of [this.bacW,this.asphaltW])if(layer)layer[key][i]=Math.min(layer[key][i],cap);
      }
    }
    // Ne pas laisser les raccords créer une encoche d'un seul mètre.
    for(const layer of [this.bacW,this.asphaltW])if(layer)for(const key of ['L','R']){
      const w=layer[key];
      for(let pass=0;pass<2;pass++){
        for(let i=0;i<this.n;i++)w[i]=Math.min(w[i],w[(i+this.n-1)%this.n]+.7);
        for(let i=this.n-1;i>=0;i--)w[i]=Math.min(w[i],w[(i+1)%this.n]+.7);
      }
    }
  }

  _buildBarriers() {
    this.barriers = []; this.barrierGrid = new Map(); this.barrierCell = 16;
    if (!this.def.barriers) return;
    if (!this.bacW) this.bacW = this._profilBac();
    const point = (s, side) => this.pos(s, side * this.limiteProtection(s, side));
    const paths=this._barrierPaths();
    for (const side of [-1,1]) for(let s=0;s<this.length;s+=3) {
      const end=Math.min(s+3,this.length),mid=(s+end)/2;
      if(paths.some(p=>p.side===side&&this.wrap(mid-p.a)<=p.span))continue;
      // Une ouverture franche réserve les deux bretelles et la voie des stands.
      if(side<0 && [s-12,mid,end+12].some(x=>this.pitAt(x)))continue;
      if(this.parallelLimits && [s,mid,end].some(u=>{
        const hw=side>0?this.hwLeftAt(u):this.hwRightAt(u);
        return this._lerp(this.parallelLimits[side>0?'L':'R'],u)<hw+this.kerbAt(u)+1.1;
      }))continue;
      const a=point(s,side),b=point(end,side),dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
      if(len<.1)continue;
      /* LES PNEUS BORDENT LE GRAVIER ET LE BITUME HORS PISTE, pas seulement le gravier.

      Ils n'étaient posés que devant les bacs : une zone bitumée, pourtant aussi longue et aussi
      rapide, n'avait qu'une glissière nue. « Les pneus doivent être collés aux graviers et aux
      zones de bitume hors piste, sauf au début et à la fin. » C'est la largeur du dégagement qui
      décide maintenant, quelle que soit sa matière.

      Le « sauf au début et à la fin » se fait tout seul : une zone s'ouvre et se ferme sur zéro,
      donc ses extrémités passent sous le seuil et reçoivent une glissière. La transition est là où
      elle doit être, sans qu'on ait à la placer. */
      const tyres=this.runoffWidthAt(mid,side)>2.5&&this._structureBlend(mid)<.5;
      const seg={ax:a.x,ay:a.y,bx:b.x,by:b.y,s:mid,side,level:this.barrierLevelAt(mid),kind:tyres?'tyres':'rail',
        half:tyres?1.2:.28,tx:dx/len,ty:dy/len,len,
        // normale dirigée vers la piste, indépendante du sens de parcours
        nx:dy/len*-side,ny:-dx/len*-side};
      this.barriers.push(seg);
    }
    // Les traits relevés : chaque trait devient une suite de segments, raccordée aux deux bouts.
    for(const p of paths){
      // Raccords exactement aux bouts des tronçons calculés de trois mètres qui l'encadrent.
      const s0=3*Math.floor((p.a-1.5)/3)+3,s1=3*(Math.floor((p.a+p.span-1.5)/3)+1);
      // Les points du trait d'avant le premier raccord ou d'après le dernier feraient un aller-retour.
      const inner=p.pts.filter(q=>{const d=this.wrap(q.s-s0);return d>.5&&d<this.wrap(s1-s0)-.5;});
      const pts=[point(this.wrap(s0),p.side),...inner,point(this.wrap(s1),p.side)];
      const cum=[0];
      for(let k=1;k<pts.length;k++)cum.push(cum[k-1]+Math.hypot(pts[k].x-pts[k-1].x,pts[k].y-pts[k-1].y));
      const total=cum.at(-1)||1;
      for(let k=1;k<pts.length;k++){
        const a=pts[k-1],b=pts[k],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
        if(len<.1)continue;
        // L'abscisse d'un segment est celle de la chaussée à son aplomb : matière, niveau et
        // contrôles se lisent là où il est vraiment.
        const s=this.wrap(this.project((a.x+b.x)/2,(a.y+b.y)/2,this.wrap(s0+(s1-s0)*(cum[k-1]+len/2)/total),40).s);
        // L'ouverture des stands reste ouverte, même si le trait passe devant.
        if(p.side<0&&[s-12,s,s+12].some(x=>this.pitAt(this.wrap(x))))continue;
        this.barriers.push({ax:a.x,ay:a.y,bx:b.x,by:b.y,s,side:p.side,level:this.barrierLevelAt(s),kind:'rail',
          half:.28,tx:dx/len,ty:dy/len,len,nx:dy/len*-p.side,ny:-dx/len*-p.side,drawn:true});
      }
    }
    if(paths.length){this._hideBehindPaths(paths);this.barriers.sort((u,v)=>u.side-v.side||u.s-v.s);}
    /* Les croix tracées sur une protection : `barrierCuts` donne leurs centres en mètres du monde
    et un rayon. Une protection calculée qui passe dans ce rayon est retirée. */
    for(const [x,y,r] of this.def.barrierCuts||[])this.barriers=this.barriers.filter(b=>{
      if(b.drawn)return true;
      const dx=b.bx-b.ax,dy=b.by-b.ay,u=clamp(((x-b.ax)*dx+(y-b.ay)*dy)/(dx*dx+dy*dy||1),0,1);
      return Math.hypot(b.ax+dx*u-x,b.ay+dy*u-y)>r;
    });
    // À l'intérieur d'une épingle, une courbe décalée peut se replier sur elle-même.
    // Couper ces boucles donne un raccord net au lieu d'une glissière en nœud.
    this._trimBarrierLoops();
    this._mergeBarrierGeometry();
    this._trimBarrierLoops();
    this.barriers=this.barriers.filter(b=>Math.hypot(b.bx-b.ax,b.by-b.ay)>.05);
    this._trimRunoffsAtBarriers();
    if(paths.length)this._hideBehindPaths(paths);   // les raccords ont pu bouger
    this._dropFoldedBarriers();
    for(let id=0;id<this.barriers.length;id++){
      const b=this.barriers[id],C=this.barrierCell;
      b.kind=this.runoffWidthAt(b.s,b.side)>2.5&&this._structureBlend(b.s)<.5?'tyres':'rail';
      b.half=b.kind==='tyres'?1.2:.28;
      b.len=Math.hypot(b.bx-b.ax,b.by-b.ay);b.tx=(b.bx-b.ax)/b.len;b.ty=(b.by-b.ay)/b.len;
      b.nx=-b.ty*b.side;b.ny=b.tx*b.side;
      if(b.drawn){
        // Un trait peut revenir un peu sur lui-même : sa normale vise toujours la chaussée qu'il borde.
        const mx=(b.ax+b.bx)/2,my=(b.ay+b.by)/2,pr=this.project(mx,my,b.s,60),c=this.pos(pr.s,0);
        if((c.x-mx)*b.nx+(c.y-my)*b.ny<0){b.nx=-b.nx;b.ny=-b.ny;}
      }
      for(let x=Math.floor((Math.min(b.ax,b.bx)-b.half)/C);x<=Math.floor((Math.max(b.ax,b.bx)+b.half)/C);x++)
        for(let y=Math.floor((Math.min(b.ay,b.by)-b.half)/C);y<=Math.floor((Math.max(b.ay,b.by)+b.half)/C);y++){
          const key=x+','+y;if(!this.barrierGrid.has(key))this.barrierGrid.set(key,[]);
          this.barrierGrid.get(key).push(id);
        }
    }
  }

  /* Une protection calculée qui s'est repliée par-dessus le virage.

  À l'intérieur d'une épingle plus serrée que le décalage voulu, la courbe décalée passe de l'autre
  côté du centre du virage. Les boucles se coupent d'habitude d'elles-mêmes (`_trimBarrierLoops`),
  mais une ouverture voisine — l'entrée des stands, un trait relevé — peut retirer le segment qui
  aurait fermé la boucle. Le segment qui reste se reconnaît à ce que la chaussée la plus proche
  n'est pas celle de son abscisse : il borde une autre portion de piste, et trop près. */
  _dropFoldedBarriers(){
    this.barriers=this.barriers.filter(b=>{
      if(b.drawn)return true;
      for(const u of [0,.5,1]){
        const x=b.ax+(b.bx-b.ax)*u,y=b.ay+(b.by-b.ay)*u,pr=this.project(x,y,b.s,100);
        if(Math.abs(this.diff(pr.s,b.s))<6||this.barrierLevelAt(pr.s)!==(b.level||0))continue;
        const hw=pr.lat>0?this.hwLeftAt(pr.s):this.hwRightAt(pr.s);
        if(Math.abs(pr.lat)-hw-b.half<=1)return false;
      }
      return true;
    });
  }

  barrierCandidates(x0,y0,x1,y1,pad) {
    if(!this.barriers.length)return [];
    const C=this.barrierCell,ids=new Set();
    for(let x=Math.floor((Math.min(x0,x1)-pad)/C);x<=Math.floor((Math.max(x0,x1)+pad)/C);x++)
      for(let y=Math.floor((Math.min(y0,y1)-pad)/C);y<=Math.floor((Math.max(y0,y1)+pad)/C);y++)
        for(const id of this.barrierGrid.get(x+','+y)||[])ids.add(id);
    return [...ids].map(i=>this.barriers[i]);
  }

  barrierDistance(x,y,b) {
    const t=clamp(((x-b.ax)*b.tx+(y-b.ay)*b.ty)/b.len,0,1);
    return Math.hypot(x-b.ax-t*b.len*b.tx,y-b.ay-t*b.len*b.ty)-b.half;
  }

  // Balayage continu d'un disque contre un segment épaissi : corps et extrémités.
  // On cherche le premier contact, même si le disque traverse le mur en un seul pas.
  static sweepBarrier(x,y,dx,dy,b,r) {
    r+=b.half;
    const u=(x-b.ax)*b.tx+(y-b.ay)*b.ty,v=(x-b.ax)*-b.ty+(y-b.ay)*b.tx;
    const du=dx*b.tx+dy*b.ty,dv=dx*-b.ty+dy*b.tx;
    let best=null;
    const accept=(t,nx,ny,depth=0)=>{
      if(t<0||t>1||dx*nx+dy*ny>=-1e-9)return;
      if(!best||t<best.t)best={t,nx,ny,depth};
    };
    const q=clamp(u,0,b.len),ex=u-q,dist=Math.hypot(ex,v);
    if(dist<r){
      const nx=dist>1e-8?(ex*b.tx-v*b.ty)/dist:b.nx;
      const ny=dist>1e-8?(ex*b.ty+v*b.tx)/dist:b.ny;
      accept(0,nx,ny,r-dist);
    }
    if(Math.abs(dv)>1e-10)for(const sign of [-1,1]){
      const t=(sign*r-v)/dv,along=u+du*t;
      if(along>=0&&along<=b.len)accept(t,-b.ty*sign,b.tx*sign);
    }
    const aa=dx*dx+dy*dy;
    if(aa>1e-12)for(const end of [0,b.len]){
      const ex=u-end,bb=2*(ex*du+v*dv),cc=ex*ex+v*v-r*r,disc=bb*bb-4*aa*cc;
      if(disc<0)continue;
      const t=(-bb-Math.sqrt(disc))/(2*aa),px=ex+du*t,py=v+dv*t;
      accept(t,(px*b.tx-py*b.ty)/r,(px*b.ty+py*b.tx)/r);
    }
    return best;
  }

  barrierHit(car,from) {
    const pad=car.cls.length/2+car.cls.width/2;
    const candidates=this.barrierCandidates(from.x,from.y,car.x,car.y,pad);
    if(!candidates.length)return null;
    // Trois disques forment une carrosserie arrondie : nez, habitacle et arrière.
    const r=car.cls.width/2,arm=Math.max(0,car.cls.length/2-r);
    let best=null;
    for(const d of [-arm,0,arm]){
      const x=from.x+Math.cos(from.th)*d,y=from.y+Math.sin(from.th)*d;
      const dx=car.x+Math.cos(car.th)*d-x,dy=car.y+Math.sin(car.th)*d-y;
      for(const b of candidates){
        if((b.level||0)!==this.barrierLevelAt(car.s))continue;
        const hit=Track.sweepBarrier(x,y,dx,dy,b,r);
        if(hit&&(!best||hit.t<best.t))best={...hit,barrier:b};
      }
    }
    return best;
  }

  // ---------- helpers ----------
  static spline(pts, steps) {
    const n = pts.length, out = [];
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      for (let j = 0; j < steps; j++) {
        const t = j / steps, t2 = t * t, t3 = t2 * t;
        out.push([
          0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
        ]);
      }
    }
    return out;
  }
  static polyLength(p) {
    let l = 0;
    for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; l += Math.hypot(b[0] - a[0], b[1] - a[1]); }
    return l;
  }
  // resample a closed polyline to N points evenly spaced along it
  static resample(raw, N) {
    const total = Track.polyLength(raw), step = total / N;
    const xs = new Float32Array(N), ys = new Float32Array(N);
    let seg = 0, segPos = 0, a = raw[0], b = raw[1 % raw.length];
    let segLen = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-6;
    for (let i = 0; i < N; i++) {
      while (segPos > segLen) {
        segPos -= segLen; seg++;
        a = raw[seg % raw.length]; b = raw[(seg + 1) % raw.length];
        segLen = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-6;
      }
      const t = segPos / segLen;
      xs[i] = a[0] + (b[0] - a[0]) * t; ys[i] = a[1] + (b[1] - a[1]) * t;
      segPos += step;
    }
    return { xs, ys };
  }
  /* Ouvre les virages plus courts que `rmin`, et eux seuls.

  On ne peut pas desserrer un virage en déplaçant le bord de la route : la courbure vient du tracé.
  On déplace donc le tracé, mais UNIQUEMENT là où il est trop serré, et de ce qu'il faut. À chaque
  passe on mesure le rayon station par station, on en tire un poids nul partout où le rayon suffit,
  on l'étale sur quelques mètres pour que l'ouverture ne fasse pas d'angle, et on applique un
  lissage proportionnel à ce poids. C'est un flot de raccourcissement de courbe arrêté dès que la
  contrainte est satisfaite : il rogne l'apex et ne touche à rien d'autre.

  Mesuré sur les douze circuits : neuf ne bougent pas d'un millimètre, leurs virages étant déjà plus
  larges que leur route. */
  static desserre(pts, rmin) {
    const N = pts.length;
    if (N < 16) return pts;
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const fen = 2;                                      // le rayon se lit sur quatre mètres
    const rayon = (i) => {
      const a = (i - fen + N) % N, b = (i + fen) % N;
      const ax = xs[i] - xs[a], ay = ys[i] - ys[a], bx = xs[b] - xs[i], by = ys[b] - ys[i];
      let d = Math.atan2(by, bx) - Math.atan2(ay, ax);
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      return (Math.sqrt(ax * ax + ay * ay) + Math.sqrt(bx * bx + by * by)) / 2 / Math.max(1e-9, Math.abs(d));
    };
    /* On commence par chercher s'il y a seulement quelque chose à faire, et où. Neuf circuits sur
    douze n'ont aucun virage trop serré et sortent ici, sans avoir rien recopié ; les trois autres
    n'en ont qu'une centaine de mètres, et c'est la seule portion qu'on fera tourner. Faire tourner
    le tour entier coûtait cinq secondes à la construction du circuit — autant sur l'écran de
    chargement du joueur. */
    const etale = Math.max(2, Math.round(rmin / 2));
    const marge = etale + 20;
    const chaud = new Uint8Array(N);
    let rien = true;
    for (let i = 0; i < N; i++) {
      if (rayon(i) >= rmin) continue;
      rien = false;
      for (let j = -marge; j <= marge; j++) chaud[(i + j + N) % N] = 1;
    }
    if (rien) return pts;
    const zone = [];
    for (let i = 0; i < N; i++) if (chaud[i]) zone.push(i);

    const w = new Float64Array(N), e = new Float64Array(N);
    for (let passe = 0; passe < 600; passe++) {
      let pire = 0;
      for (const i of zone) {
        const r = rayon(i);
        w[i] = r < rmin ? Math.min(1, rmin / r - 1) : 0;
        if (w[i] > pire) pire = w[i];
      }
      if (pire < 0.01) break;
      for (const i of zone) {
        let m = 0;
        for (let j = -etale; j <= etale; j++) m = Math.max(m, w[(i + j + N) % N]);
        e[i] = m;
      }
      for (const i of zone) {
        if (e[i] <= 0) continue;
        const a = (i - 1 + N) % N, b = (i + 1) % N;
        const f = 0.3 * e[i];
        xs[i] += f * (xs[a] + xs[b] - 2 * xs[i]);
        ys[i] += f * (ys[a] + ys[b] - 2 * ys[i]);
      }
    }
    return xs.map((x, i) => [x, ys[i]]);
  }
  static smooth(arr, w) {
    const N = arr.length, out = new Float32Array(N);
    if (w <= 0) { out.set(arr); return out; }
    // running sum over a circular window
    let sum = 0;
    for (let j = -w; j <= w; j++) sum += arr[(j + N) % N];
    for (let i = 0; i < N; i++) {
      out[i] = sum / (2 * w + 1);
      sum += arr[(i + w + 1) % N] - arr[(i - w + N) % N];
    }
    return out;
  }

  // ---------- build ----------
  _build() {
    const def = this.def;
    const scale = def.scale || 1;                       // metres per unit (editor tracks)
    const centerPts = (def.center || def.pts).map(p => [p[0] * scale, p[1] * scale]);
    let raw = Track.spline(centerPts, 24);
    if (def.length && !def.scale) {                     // built-in tracks: rescale to target length
      const f = def.length / Track.polyLength(raw);
      raw = raw.map(p => [p[0] * f, p[1] * f]);
      this.unitScale = f;
    } else this.unitScale = scale;
    /* Le desserrage travaille sur des stations au mètre, pas sur la sortie de la spline : celle-ci
       pose un point tous les vingt centimètres, où l'angle entre trois points voisins n'est plus
       qu'du bruit et le rayon qu'on en tirerait ne veut rien dire. */
    const baseHw = (def.width || 12) * this.widthScale / 2;
    {
      const N0 = Math.max(50, Math.round(Track.polyLength(raw) / this.ds));
      const r0 = Track.resample(raw, N0);
      raw = Track.desserre(Array.from(r0.xs, (x, i) => [x, r0.ys[i]]), baseHw / PLI_MAX);
      if (def.length && !def.scale) {                   // le desserrage raccourcit un peu la boucle
        const f2 = def.length / Track.polyLength(raw);
        raw = raw.map(p => [p[0] * f2, p[1] * f2]);
        this.unitScale *= f2;
      }
    }
    const N = Math.max(50, Math.round(Track.polyLength(raw) / this.ds));
    this.n = N; this.length = N * this.ds;
    const { xs, ys } = Track.resample(raw, N);
    this.xs = xs; this.ys = ys;

    // heading, normals, curvature
    const th = new Float32Array(N), nx = new Float32Array(N), ny = new Float32Array(N), kraw = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const dx = xs[(i + 1) % N] - xs[(i - 1 + N) % N], dy = ys[(i + 1) % N] - ys[(i - 1 + N) % N];
      th[i] = Math.atan2(dy, dx);
      const l = Math.hypot(dx, dy) || 1;
      nx[i] = dy / l; ny[i] = -dx / l;                  // left normal (y-down)
    }
    for (let i = 0; i < N; i++) {
      let d = th[(i + 1) % N] - th[(i - 1 + N) % N];
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      kraw[i] = d / (2 * this.ds);
    }
    this.th = th; this.nx = nx; this.ny = ny;
    this.k = Track.smooth(kraw, 4);

    // road half-widths
    this.hwL = new Float32Array(N); this.hwR = new Float32Array(N);
    this.hwL.fill(baseHw); this.hwR.fill(baseHw);

    // Un élargissement annoté est de la chaussée, pas un dégagement peint. Une valeur négative
    // resserre la chaussée : l'arrondi d'une corde trop pointue, par exemple.
    if (!(def.lines && !def.width)) this._applyRoadWidenings();

    /* De quel côté est l'intérieur du virage, en tout point — calculé ici et non dans le générateur
    de lignes, parce que le rendu s'en sert aussi : les deux bords de piste sont teintés d'après lui,
    pour qu'on lise d'un coup d'œil de quel côté se trouve la corde. Un circuit qui porte ses lignes
    à la main ne passe pas par le générateur, et doit pourtant avoir ses bords teintés : le sens ne
    dépend que du tracé, pas des lignes. */
    this.sens = this._sensVirages();

    // lines
    this.lines = {};
    // Les lignes sont dans les mêmes unités que `pts`, donc remises à l'échelle comme lui. Passer
    // `scale` ici était juste pour un circuit d'éditeur, où les deux valent la même chose, et faux
    // pour un circuit intégré : sa ligne centrale est redimensionnée après coup pour tomber sur la
    // longueur voulue, si bien que des lignes explicites auraient été projetées à côté de la piste.
    if (def.lines && def.lines.racing) this._projectLines(def.lines, this.unitScale);
    else this._autoLines();
    /* DES LIGNES QUI NE SONT PAS CELLES DE CE CIRCUIT SONT IGNORÉES, et le calcul reprend.

    Monaco a couru des semaines sur les lignes de SPA. L'ancien export de l'éditeur lisait les
    apostrophes des commentaires comme des chaînes ; la découpe de la définition de Spa débordait
    sur celle de Monaco, et le bloc s'y est posé (corrigé depuis dans `finObjet`). Projetées sur
    une autre piste puis bornées à la chaussée, elles collaient au bord sur tout le tour, et rien
    ne le disait. Des lignes dessinées pour le circuit sortent de la chaussée sur 8 à 14 % des
    stations au pire, une ligne ratée sur la moitié ; celles d'un autre circuit, sur 70 à 100 %.
    Au-delà de 60 % en moyenne des trois, ce ne sont pas les siennes. Seulement pour un circuit
    qui porte sa largeur : celle d'un circuit d'éditeur se déduit justement des lignes. */
    if (def.lines && def.lines.racing && def.width && this._partHorsPiste() > 0.6) {
      console.warn(`${def.id} : lignes dessinées ignorées, elles ne suivent pas ce circuit`);
      this.lignesIgnorees = true;
      this._autoLines();
    }
    /* Dix centimètres par mètre pour les lignes secondaires, mesuré et non choisi.

    Le chiffre arbitre deux choses qui tirent en sens contraire. Trop bas, la ligne intérieure
    n'a pas le temps de traverser la piste avant le virage et l'aborde encore du mauvais côté.
    Trop haut, elle traverse plus vite que les voitures ne savent suivre, et l'IA sort de piste.
    Balayé sur les douze circuits, avec d'un côté la part de l'approche où l'intérieure est bien
    à l'intérieur et de l'autre le nombre de sorties de piste en course :

        0,07 → 82 % et 98 sorties      0,12 → 85 % et 109
        0,10 → 84 % et 97              0,18 → 86 % et 147

    Le coude est à 0,10 : au-delà on gagne un point d'approche et on paie douze sorties. */
    this._limitLines(0.10, Track.RACING_SLOPE);
    if (def.lines && !def.width) { this._widthFromLines(); this._applyRoadWidenings(); }
    this._clampLines();
    this._lineCurvatures();
    this._buildPits(def);
    this.halfWidth = baseHw;          // nominal, used for grids and camera
    this.width = baseHw * 2;

    // bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < N; i++) {
      const hw = Math.max(this.hwL[i], this.hwR[i]);
      minX = Math.min(minX, xs[i] - hw); maxX = Math.max(maxX, xs[i] + hw);
      minY = Math.min(minY, ys[i] - hw); maxY = Math.max(maxY, ys[i] + hw);
    }
    if (this.image) {
      minX = Math.min(minX, 0); minY = Math.min(minY, 0);
      maxX = Math.max(maxX, this.image.w * scale); maxY = Math.max(maxY, this.image.h * scale);
    }
    this.bounds = { minX, minY, maxX, maxY };

    this.crossings = this._findCrossings();

    /* Les passerelles : des stations, à partir des fractions de tour de `js/tracks.js`.

    Ce ne sont pas des `crossings`. Un croisement, c'est la piste qui passe au-dessus d'elle-même —
    Suzuka — et la voiture roule dessus. Une passerelle, on passe DESSOUS : elle se dessine après
    les voitures, pas avant, et c'est tout ce qui les distingue à l'écran. */
    this.passerelles = (def.passerelles || []).map((f) => ((Math.round(f * N) % N) + N) % N);

    /* Les tunnels : deux fractions de tour, le début et la fin. Relevés comme le reste — une voie
       d'OpenStreetMap porte « tunnel=yes » ou ne la porte pas. Un tunnel peut enjamber la ligne de
       départ, donc `fin` peut être plus petit que `début` ; `js/render.js` compte les stations au
       lieu de comparer les indices. */
    this.tunnels = (def.tunnels || []).map(([a, b]) => {
      const st = (f) => ((Math.round(f * N) % N) + N) % N;
      const de = st(a), vers = st(b);
      return { from: de, to: vers, n: ((vers - de) % N + N) % N };
    });

    // Un croisement couvert par un tablier n’est pas un tunnel. Seule sa largeur
    // projetée sur la branche inférieure impose le resserrement des protections.
    this.underpasses=this.crossings.map(cr=>{
      const s=cr.under*this.ds,over=cr.over*this.ds;
      const angle=Math.abs(Math.sin(this.headingAt(s)-this.headingAt(over)));
      return {s,half:(this.width/2+1.2)/Math.max(.15,angle)};
    });

    // corner segments (kerbs / gravel)
    this.corners = [];
    const thr = 1 / 90;
    let inCorner = false, start = 0;
    for (let i = 0; i <= N; i++) {
      const hi = Math.abs(this.k[i % N]) > thr;
      if (hi && !inCorner) { inCorner = true; start = i; }
      if (!hi && inCorner) {
        inCorner = false;
        if (i - start > 6) this.corners.push({ from: start, to: i, sign: Math.sign(this.k[Math.floor((start + i) / 2) % N]) });
      }
    }

    /* LE VIBREUR, comme donnée du circuit et non comme décor.

    Il était dessiné dans `js/render.js` avec ses propres constantes, et la physique ne savait pas
    qu'il existait : la piste s'arrêtait à la ligne blanche, donc poser deux roues sur le vibreur
    comptait comme une sortie de piste — gravier, dégâts, et bientôt un tour annulé. C'est faux au
    sens le plus simple : un vibreur est fait pour qu'on roule dessus.

    Les mêmes nombres servent maintenant au dessin et à la règle, parce que deux jeux de constantes
    pour une même bande finissent toujours par se contredire, et que l'écart serait invisible — un
    joueur verrait ses roues sur la peinture et un tour annulé sans savoir pourquoi.

    La bande S'AFFINE sur quatre mètres à chaque extrémité du virage. Le dessin, lui, s'arrête net ;
    sans ce biseau la piste s'élargissait de deux mètres d'un coup, et une voiture qui sortait du
    virage en appui sur le vibreur se retrouvait dans le gravier d'une station à l'autre, avec une
    faute, pour n'avoir rien fait. La règle est donc un peu plus stricte que la peinture aux deux
    bouts, jamais plus large. */
    /* LE VIBREUR DÉBORDE DU VIRAGE, à la sortie surtout.

    Il s'arrêtait exactement où la courbure s'arrête, c'est-à-dire à l'apex passé. Or c'est APRÈS
    l'apex qu'on s'appuie dessus : on ouvre le volant, la voiture dérive vers l'extérieur, et sur un
    vrai circuit elle trouve encore dix ou quinze mètres de vibreur pour l'accueillir. Ici elle
    trouvait de l'herbe — « en sortie de virage, les voitures ont tendance à taper la barrière ».

    La bande est donc prolongée de quinze mètres à la sortie et de six à l'entrée, en gardant la
    pente douce à ses nouvelles extrémités. Les bornes élargies servent au dessin comme à la règle :
    ce sont les mêmes, pour que la peinture et le droit de rouler dessus ne se contredisent jamais.
    `corners` n'est pas touché, lui — il dimensionne aussi les bacs, qui n'ont pas de raison de
    s'allonger d'autant. */
    this.kerb = new Float32Array(N);
    const entree = Math.round(KERB_AVANT / this.ds), sortie = Math.round(KERB_APRES / this.ds);
    for (const c of this.corners) {
      c.kerbFrom = c.from - entree;
      c.kerbTo = c.to + sortie;
      const n = c.kerbTo - c.kerbFrom;
      for (let i = c.kerbFrom; i <= c.kerbTo; i++) {
        const d = Math.min(i - c.kerbFrom, c.kerbTo - i, Math.floor(n / 2));
        const x = Math.min(1, d / KERB_RAMPE);
        const f = x * x * (3 - 2 * x);                 // pente douce aux deux bouts, pas un biseau droit
        const k = ((i % N) + N) % N;
        this.kerb[k] = Math.max(this.kerb[k], KERB_LARGE * f);
      }
    }

    /* LES PANNEAUX, calculés ou repris à la main.

    Ils se déduisent de la géométrie, ce qui les donne gratuitement sur les douze circuits — et ce
    qui les trompe parfois. Un enchaînement où le premier virage est une amorce molle avant le vrai
    virage dans l'autre sens est annoncé par l'amorce : la flèche part à gauche quand la route part
    à droite. Aucun réglage ne rattrape ça, pas plus que pour une trajectoire ; il faut le dire.

    `def.panneaux` est cette reprise : la liste des panneaux, et elle remplace le calcul. Comme pour
    `lines`, dès qu'un circuit la porte le générateur ne tourne plus pour lui. Une liste vide est
    donc une liste vide, et non « calcule-les » — c'est ce qui permet de tous les enlever. */
    this.boards = def.panneaux ? this._panneauxPoses(def.panneaux) : this._brakingBoards();
  }

  // Braking boards: the 200 / 100 / 50 metre panels on the approach to a corner, each carrying a
  // rally-style arrow bent to the corner's severity and pointing the way it turns. They are placed
  // from the geometry alone, so every circuit gets them without being annotated by hand.
  //
  // Corners are first grouped into braking zones: a chicane or a set of esses is one thing to
  // brake for, not three, and boarding each of its corners would only clutter the approach.
  /* LES ZONES DE VIRAGE : les virages groupés par événement, pas un par un.

  Une chicane est trois virages dans `corners` et un seul geste pour le pilote. On les regroupe donc
  dès que la ligne droite qui les sépare est courte. Ce découpage servait déjà aux panneaux de
  freinage ; il est sorti ici parce que la caméra « saut de virage » en a besoin elle aussi, et deux
  découpages qui doivent dire la même chose finissent toujours par diverger. */
  /* DEUX FAÇONS DE GROUPER, parce qu'il y a deux questions.

  Pour le FREINAGE, une chicane est un seul événement : on freine une fois pour les trois virages qui
  la composent, donc on les groupe sur la distance, sens ou pas. C'est le groupement d'origine.

  Pour une INDICATION, non. Un carré à droite suivi trois mètres plus loin d'une épingle à gauche,
  ce sont deux gestes et il faut deux flèches — c'est ce que Bruno a posé à la main à Zandvoort, et
  c'est ce qu'un copilote dit. Groupés sur la seule distance, ils devenaient un seul virage « à
  droite », et la flèche gauche de la seconde se faisait accuser d'aller à l'envers. Elle avait
  raison ; c'est le groupement qui avait tort.

  `memeSens` ne fusionne donc que des virages qui tournent DU MÊME CÔTÉ — ce qui ne recolle que les
  morceaux d'un même virage, jamais deux virages opposés. */
  zonesVirages(GAP, memeSens) {
    const N = this.n;
    if (!this.corners.length) return [];
    const colle = (z, c) => (c.from - z.to) * this.ds < GAP && (!memeSens || z.sign === c.sign);
    const zones = [];
    for (const c of this.corners) {
      let peak = 0;
      for (let i = c.from; i <= c.to; i++) peak = Math.max(peak, Math.abs(this.k[((i % N) + N) % N]));
      const z = zones[zones.length - 1];
      // The arrow shows the way the FIRST corner of the zone goes, not the tightest: through a
      // chicane it is the first direction you turn that matters. The severity still comes from
      // the tightest, since that is what sets the braking.
      if (z && colle(z, c)) { z.to = c.to; z.peak = Math.max(z.peak, peak); if (memeSens) z.firstTo = c.to; }
      else zones.push({ from: c.from, to: c.to, peak, sign: c.sign, firstTo: c.to });
    }
    // the track is a loop: the last zone may run into the first
    if (zones.length > 1) {
      const a = zones[zones.length - 1], b = zones[0];
      if ((b.from + N - a.to) * this.ds < GAP && (!memeSens || a.sign === b.sign)) {
        b.from = a.from - N; b.peak = Math.max(b.peak, a.peak); zones.pop();
      }
    }
    return zones;
  }

  /* LA NOTE D'UN VIRAGE : le chiffre de rallye, ou l'un des trois noms.

  LE CHIFFRE DIT À QUEL POINT IL FAUT RALENTIR, pas quel rayon la route décrit. C'est la correction
  la plus importante de ce chapitre, et elle vient d'un reproche : « l'important des indications,
  c'est de savoir quand freiner ». Un virage court mais serré de Monaco obligeait à passer de 43 à
  19 m/s et recevait la note 5 — « à peine un décroché » — parce que son rayon le plus fermé ne durait
  que huit mètres. Le rayon décrit la forme ; ce qu'on veut annoncer, c'est l'effort.

  Le chiffre vient donc de la VITESSE DE PASSAGE rapportée à la vitesse maximale de la voiture, lue
  dans le profil de référence — celui du guide de freinage, donc la vérité du jeu. Les seuils sont
  calés sur les treize virages que Bruno a notés à la main à Zandvoort, seule vérité terrain
  disponible : l'accord passe de 7 sur 13 (par le rayon) à 10 sur 13, avec un seul écart d'un cran.

  LES TROIS NOMS RESTENT GÉOMÉTRIQUES, parce qu'ils décrivent une FORME et non un effort : un carré
  est un quatre-vingt-dix qu'on prend lentement, une épingle vous renvoie d'où vous venez. Leurs
  seuils de rayon sont en rayon réel, et les circuits sont dessinés plus petits — Monza fait 2 900 m
  pour 5 793 en vrai, échelle moyenne 0,56 sur les douze — donc le rayon est remis à l'échelle avant
  d'être jugé. L'angle, lui, ne s'échelonne pas : un virage à 180° tourne de 180° qu'on le dessine
  grand ou petit, seules les longueurs rétrécissent.

  Sans vitesse — un circuit dessiné dans l'éditeur, qui n'a pas encore de profil — on retombe sur le
  rayon. C'est moins juste, et c'est dit. */
  static get ECHELLE() { return 1.8; }

  static noteVirage(rayon, angle, fraction) {
    const R = rayon * Track.ECHELLE;
    if (angle >= 150 && R < 40) return 'hairpin';
    if (angle >= 115 && R < 26) return 'acute';
    if (angle >= 75 && angle <= 105 && R < 35) return 'square';
    if (fraction == null) return R < 20 ? 1 : R < 35 ? 2 : R < 55 ? 3 : R < 90 ? 4 : R < 150 ? 5 : 6;
    const f = fraction;
    return f < 0.18 ? 1 : f < 0.255 ? 2 : f < 0.29 ? 3 : f < 0.39 ? 4 : f < 0.44 ? 5 : 6;
  }

  _brakingBoards() {
    const N = this.n, out = [];
    if (!this.corners.length) return out;
    const GAP = 60;                    // straight below this and the corners are the same zone
    const zones = this.zonesVirages(GAP);
    const inAZone = (i) => zones.some(z => {
      const a = ((z.from % N) + N) % N, b = ((z.to % N) + N) % N;
      return a <= b ? (i >= a && i <= b) : (i >= a || i <= b);
    });
    for (const z of zones) {
      // A gentle bend asks for no braking, so it gets no board: a panel there is only clutter.
      if (z.peak < 1 / 200) continue;
      const radius = 1 / z.peak;
      // A few corners deserve their own note rather than a number, as in rally: how far round the
      // road goes matters as much as how tight it is. A ninety that has to be taken slowly is a
      // square; a corner that turns you back where you came from is a hairpin.
      let turn = 0;
      for (let i = z.from; i < z.firstTo; i++) {
        const a = ((i % N) + N) % N, b = (((i + 1) % N) + N) % N;
        let e = this.th[b] - this.th[a];
        while (e > Math.PI) e -= 2 * Math.PI;
        while (e < -Math.PI) e += 2 * Math.PI;
        turn += e;
      }
      const note = Track.noteVirage(radius, Math.abs(turn) * 180 / Math.PI);
      const kind = typeof note === 'number' ? 'normal' : note;
      const grade = typeof note === 'number' ? note : 3;
      const entry = z.from * this.ds;
      for (const dist of [200, 100, 50]) {
        const s = this.wrap(entry - dist);
        const i = this.idx(s);
        if (inAZone(i)) continue;                 // the straight is too short for this one
        // Outside of the corner, where there is room and where the panel stays clear of the apex.
        // nx,ny is the left normal, and a positive curvature turns right on screen, so the outside
        // of a right-hander is the left side: side and sign match.
        const side = z.sign || 1;
        const hw = side > 0 ? this.hwL[i] : this.hwR[i];
        const off = hw + 4.2;
        out.push({
          x: this.xs[i] + this.nx[i] * off * side,
          y: this.ys[i] + this.ny[i] * off * side,
          // le marquage se peint SUR la piste : il lui faut le centre et la largeur, pas le bas-côté
          cx: this.xs[i], cy: this.ys[i], hw: (this.hwL[i] + this.hwR[i]) / 2,
          th: this.th[i], dist, grade, kind, sign: z.sign, side,
          at: i / N,                          // fraction de tour : ce que l'éditeur enregistre
          from: z.from, to: z.firstTo,        // the corner the arrow describes, for checking
        });
      }
    }
    // Two boards on top of each other read as neither: where the end of one approach meets the
    // start of the next, keep the one closest to its own corner.
    out.sort((a, b) => a.dist - b.dist);
    const kept = [];
    for (const b of out) {
      if (kept.some(k => (k.x - b.x) ** 2 + (k.y - b.y) ** 2 < 22 * 22)) continue;
      kept.push(b);
    }
    return kept;
  }

  /* Une liste de panneaux reprise à la main, replacée sur la piste.

  Chaque entrée est `[fraction de tour, distance annoncée, note, sens]`. La note est le chiffre 1 à
  6 des notes de rallye, ou l'un des trois noms — `square`, `hairpin`, `acute`. Le sens est +1 à
  droite, −1 à gauche, et il décide à la fois du dessin de la flèche et du côté de piste où le
  panneau se plante : un panneau se met à l'extérieur du virage, là où il y a de la place et où il
  ne cache pas la corde.

  UNE DISTANCE DE ZÉRO VEUT DIRE « SANS CHIFFRE ». Deux virages qui s'enchaînent sont à moins de
  cinquante mètres l'un de l'autre : annoncer une distance y serait faux et l'arrondir à 50 mentirait.
  L'indication se réduit alors au sens et à la sévérité. Zéro plutôt que `null` parce que la liste
  voyage en tableau de nombres jusque dans `tracks.js`, et parce qu'un panneau qui annoncerait
  vraiment « 0 m » n'a pas de sens : la valeur est libre.

  Une fraction plutôt qu'une station, comme pour les passerelles : elle survit au changement de
  longueur déclarée, qui ne garde pas le même nombre de stations. */
  _panneauxPoses(liste) {
    const N = this.n, out = [];
    for (const p of liste) {
      const [at, dist, note, sign] = Array.isArray(p)
        ? p : [p.at, p.dist, p.note != null ? p.note : (p.kind && p.kind !== 'normal' ? p.kind : p.grade), p.sign];
      const i = ((Math.round(at * N) % N) + N) % N;
      const side = sign > 0 ? 1 : -1;
      const hw = side > 0 ? this.hwL[i] : this.hwR[i];
      const off = hw + 4.2;
      out.push({
        x: this.xs[i] + this.nx[i] * off * side,
        y: this.ys[i] + this.ny[i] * off * side,
        cx: this.xs[i], cy: this.ys[i], hw: (this.hwL[i] + this.hwR[i]) / 2,
        th: this.th[i], dist: +dist, sign: side, side,
        grade: typeof note === 'number' ? note : 3,
        kind: typeof note === 'number' ? 'normal' : note,
        at: i / N,
      });
    }
    return out;
  }

  // Lines generated from curvature: racing = out-in-out, inside/outside hug the road edges
  // on the side of the next corner.
  /* The racing line, found rather than guessed.

  The old rule was a formula on smoothed curvature: hug the inside in proportion to how tight the
  corner is. It produced something that mostly followed the middle of the road, because a formula
  on the road's own curvature cannot know that the fast way through a corner starts on the far side
  of the road two hundred metres earlier.

  So the line is solved for instead. Write it as a lateral offset a(i) at every metre of the track,
  giving the point P(i) = C(i) + n(i)·a(i), and look for the offsets that make the path bend as
  little as possible:

      minimise  Σ |P(i-1) − 2·P(i) + P(i+1)|²      subject to the line staying on the road

  That is the classic minimum-curvature line, and it is what produces out-in-out on its own: the
  solver discovers that starting wide lets the corner be taken with a bigger radius, and that the
  corner after decides which side to exit on. Nothing about corners is coded anywhere — only the
  road's shape and its width.

  It is solved by relaxation. The energy above is quadratic in the offsets, so a step of Gauss-
  Seidel on one offset, holding its neighbours, is a division: the second derivative of the energy
  with respect to a(i) is 6·|n|² = 6, and the first is n(i)·(D(i-1) − 2·D(i) + D(i+1)) where D is
  the second difference of P. Clamp to the road after every step and repeat.
  */
  _autoLines() {
    const N = this.n, margin = 1.7;
    const lo = new Float32Array(N), hi = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      hi[i] = Math.max(0.2, this.hwL[i] - margin);
      lo[i] = -Math.max(0.2, this.hwR[i] - margin);
    }
    const racing = this._minCurvature(lo, hi, 120);

    /* Les deux autres lignes : celle qui ferme la porte, et celle qui passe autour.

    Elles ne sont pas des trajectoires en soi mais des écarts à la rapide, et tout tient à une seule
    question : de quel côté est l'intérieur du virage. Elle se tranche par la géométrie et non par
    une convention de signe — le fichier en portait deux, contradictoires, et la ligne « intérieure »
    se trouvait de fait à l'extérieur du virage 99 % du temps. `tools/cotes.js` le mesure, et
    `tools/curseur.js` le vérifie en conduisant, ce qui n'est pas la même chose.

    Chaque ligne se déporte d'une fraction de la place qui reste de son côté. Cela donne deux voies
    nettement asymétriques, et c'est une propriété de la géométrie plutôt qu'un réglage : la ligne de
    course est la trajectoire de courbure minimale, donc elle vient déjà toucher le bord intérieur à
    chaque apex. Il n'y a rien « de plus à l'intérieur » dans un virage, et rien de plus à
    l'extérieur dans une ligne droite, où elle se place déjà du côté extérieur du virage qui vient.
    Mesuré en médiane, l'écart à la rapide vaut :

                        en virage   à l'approche   en ligne droite
        intérieure          0,7 m        3,8 m           7,2 m
        extérieure          6,5 m        3,5 m           1,2 m

    Les deux se séparent donc dans des zones opposées, ce qui est juste : on ferme la porte AVANT le
    virage, et on passe autour PENDANT. Le curseur n'en reste pas moins asymétrique au ressenti.

    Deux autres constructions ont été essayées et mesurées, et toutes deux coûtent trop cher à l'IA
    pour ce qu'elles apportent. Viser franchement les deux bords plutôt qu'une fraction de la place
    restante : 217 sorties de piste sur les douze circuits contre 94, sans gagner un point sur le
    curseur. Faire de l'intérieure le chemin le plus court du couloir — le fil tendu, qui est la
    vraie ligne défensive et serre tous les apex : 228 sorties, parce que la plus courte est aussi
    celle de plus petit rayon, et que les voitures ne la tiennent pas. */
    const g = this.sens;
    const inside = new Float32Array(N), outside = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const r = racing[i];
      const toL = hi[i] - r, toR = r - lo[i];
      const vers = (q, sg) => (sg > 0 ? q * toL : -q * toR);   // se déporter de q, du côté sg
      inside[i] = r + vers(Math.abs(g[i]) * 0.85, g[i]);       // vers l'intérieur du virage
      outside[i] = r + vers(Math.abs(g[i]) * 0.85, -g[i]);     // et l'autre, vers l'extérieur
    }
    this.lines.racing = racing;
    const li = Track.smooth(inside, 16), lo2 = Track.smooth(outside, 16);
    this.tracees = { racing, inside: li, outside: lo2 };
    this._fusionneCotes(li, lo2);
  }

  /* Ranger les deux lignes secondaires PAR CÔTÉ au lieu de par rôle.

  `lat` se mesure sur la normale GAUCHE (`nx = dy/l, ny = -dx/l`), donc un écart positif est à
  gauche du sens de marche, partout et tout le tour : le signe de `lat` est le seul repère de côté
  qui ne tourne pas avec le circuit. À chaque station on garde donc la plus à gauche des deux pour
  le jaune et la plus à droite pour le bleu.

  LE RÉSULTAT EST CONTINU, et c'est la raison de prendre un maximum plutôt que de choisir une
  source par tronçon : là où les deux lignes se croisent elles sont égales, donc l'échange de source
  se fait sans saut. Elles se croisent de 4 à 14 fois selon le circuit — mesuré sur les douze — et
  Monaco fait exception avec zéro croisement, ses deux lignes tracées à la main se confondant sur
  les trois cinquièmes du tour, dans les parties où il n'y a pas la place de choisir.

  La fusion a lieu AVANT `_limitLines`, pour que le limiteur de pente et le lissage passent sur les
  lignes fusionnées : un croisement laisse un angle, et c'est à ce moment-là qu'on le casse. */
  /* `tracees` garde ce qui a été DESSINÉ, `lines` ce qui est JOUÉ.

  L'éditeur de lignes dessine et relit en intérieure / idéale / extérieure, et il a besoin du profil
  latéral projeté, que lui seul ne sait pas calculer. Garder les deux coûte deux tableaux par
  circuit et évite d'avoir à choisir entre un éditeur qui marche et un jeu qui a des bords fixes.
  `tracees` n'est pas lissé par `_limitLines` : c'est le tracé brut, celui que l'auteur reconnaît. */
  _fusionneCotes(a, b) {
    const N = this.n, jaune = new Float32Array(N), bleu = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      jaune[i] = Math.max(a[i], b[i]);     // la plus à GAUCHE
      bleu[i] = Math.min(a[i], b[i]);      // la plus à DROITE, du côté des stands
    }
    this.lines.jaune = jaune;
    this.lines.bleu = bleu;
  }

  /* De quel côté est l'intérieur du virage, en tout point du tour.

  Deux exigences qui tirent en sens contraire. Chaque virage doit imposer son vrai sens, sinon la
  ligne « intérieure » se retrouve à l'extérieur — elle y était 99 % du temps, avant. Et les lignes
  doivent rester écartées dans les lignes droites, sinon il n'y a pas de place pour doubler ; elles
  s'y confondaient sur 13 % du tour. Un simple lissage ne peut pas les satisfaire toutes les deux :
  large, il écrase les virages courts ; étroit, il laisse les lignes se rejoindre dès que la route
  est droite.

  La sortie est de ne pas moyenner du tout. Chaque virage décide de son sens, franchement ; entre
  deux virages, le sens est **tenu** plutôt qu'interpolé. Deux virages de même main laissent donc les
  lignes écartées d'un bout à l'autre de la droite qui les sépare, et deux virages de mains opposées
  se partagent la droite en deux, le croisement tombant au milieu. C'est le principe des voies qui se
  croisent à des endroits choisis, et non d'un fondu qui les colle l'une à l'autre sur des centaines
  de mètres.

  Le sens local se lit sur la dérivée seconde de l'axe, ouverte sur quinze mètres : elle pointe vers
  le centre de courbure, et projetée sur la normale gauche elle dit de quel côté il se trouve. Prise
  sur un seul pas elle ne pèserait que quelques millimètres pour un virage de 250 m de rayon, et sa
  direction ne serait que du bruit. */
  _sensVirages() {
    const N = this.n, W = 15;
    const dir = new Float32Array(N), poids = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = (i - W + N) % N, b = (i + W) % N;
      const cx = this.xs[b] - 2 * this.xs[i] + this.xs[a];
      const cy = this.ys[b] - 2 * this.ys[i] + this.ys[a];
      const m = Math.hypot(cx, cy);
      poids[i] = m;
      dir[i] = m > 1e-9 ? (cx * this.nx[i] + cy * this.ny[i]) / m : 0;
    }
    // Le sens de chaque virage, sur un lissage court : assez pour ôter le bruit, pas assez pour
    // qu'un virage emprunte le sens de son voisin.
    const num = new Float32Array(N);
    for (let i = 0; i < N; i++) num[i] = dir[i] * poids[i];
    const numS = Track.smooth(num, 30), poidsS = Track.smooth(poids, 30);

    /* Où il y a assez de virage pour décider — et le seuil est d'abord absolu.

    Un seuil seulement relatif au virage le plus serré du circuit se trompe sur les tracés
    contrastés. À Monza les chicanes font 22 m de rayon ; une grande courbe de 234 m tombait donc
    très en dessous de 18 % du maximum, se voyait classée « ligne droite », et héritait du sens de
    ses voisines — les deux lignes s'y retrouvaient franchement inversées, sur cinq mètres d'écart.
    C'est exactement le genre de virage rapide où le choix de ligne décide d'un dépassement.

    Le seuil absolu dit la chose physique : en deçà de 400 m de rayon, il y a un côté à choisir.
    Pour un arc de rayon R, la dérivée seconde ouverte sur W échantillons vaut (W·ds)²/R, d'où le
    calcul. Le seuil relatif reste, mais comme plafond : sur un tracé sans aucun virage serré il
    laisse quand même les grandes courbes décider. */
    let max = 0;
    for (let i = 0; i < N; i++) max = Math.max(max, poidsS[i]);
    const seuil = Math.min(max * 0.18, (W * this.ds) * (W * this.ds) / 400);
    const signe = new Int8Array(N);
    for (let i = 0; i < N; i++) {
      signe[i] = poidsS[i] > seuil ? (numS[i] >= 0 ? 1 : -1) : 0;
    }

    // Aucun virage franc — un anneau parfait : on garde le sens brut plutôt que de rendre zéro,
    // qui collerait les trois lignes.
    let décidés = 0;
    for (let i = 0; i < N; i++) if (signe[i]) décidés++;
    if (!décidés) {
      const out = new Float32Array(N);
      for (let i = 0; i < N; i++) out[i] = Math.tanh((numS[i] / (poidsS[i] + 1e-9)) * 3.5);
      return out;
    }

    /* Tenir le sens entre deux virages — et basculer tôt, vers le virage qui vient.

    Une ligne intérieure n'est pas d'abord une ligne de virage : c'est celle qui **arrive** du côté
    intérieur du virage qui vient, cent mètres avant le point de corde. C'est là qu'elle ferme la
    porte, et c'est là que le joueur la voit.

    La première version partageait chaque ligne droite en deux, moitié au sens du virage précédent,
    moitié à celui du suivant. Mesurée sur l'approche — les quatre-vingts mètres qui précèdent
    l'entrée d'un virage — elle n'était du bon côté que 71 % du temps, et 55 % au Nürburgring : sur
    la première moitié de chaque droite, l'intérieure longeait encore le côté du virage d'avant,
    c'est-à-dire l'extérieur de celui qu'elle abordait.

    Le sens du virage précédent n'est donc tenu que le temps de se déplier — une trentaine de mètres
    — puis toute la suite de la droite appartient au virage qui vient. Le limiteur de pente étire de
    toute façon la traversée sur une centaine de mètres ; basculer tôt, c'est lui laisser le temps
    d'arriver. */
    let début = 0;
    while (!signe[début]) début++;
    const plein = new Int8Array(N);
    for (let n = 0; n < N; n++) {
      const i = (début + n) % N;
      plein[i] = signe[i];
    }
    for (let n = 0; n < N; n++) {
      const i = (début + n) % N;
      if (plein[i]) continue;
      let len = 0;
      while (len < N && !plein[(i + len) % N]) len++;
      const avant = plein[(i - 1 + N) % N];
      const après = plein[(i + len) % N] || avant;
      const tenu = Math.min(len * 0.25, Math.round(30 / this.ds));
      for (let k = 0; k < len; k++) plein[(i + k) % N] = k < tenu ? avant : après;
      n += len - 1;
    }

    /* Le créneau est adouci juste ce qu'il faut pour que le croisement ne soit pas une marche.
    Vingt mètres suffisent : le limiteur de pente, appliqué ensuite, étire de toute façon un
    changement de côté sur la distance qu'une voiture met à traverser la piste. Ce qui est décidé
    ici, c'est **où** le croisement tombe, pas à quelle vitesse il se fait. */
    const doux = Track.smooth(Float32Array.from(plein), 20);
    const out = new Float32Array(N);
    for (let i = 0; i < N; i++) out[i] = Math.tanh(doux[i] * 3);
    return out;
  }

  /* Relaxes a line to the least-bending path that stays between `lo` and `hi`.

  Done at one metre only, this never finishes: a pass of relaxation carries a change by one sample,
  so after six hundred passes the far end of a straight still knows nothing about the corner it
  leads into — and a racing line is precisely the corner reaching back up the straight. The first
  attempt did exactly that and came out worse than the formula it replaced: a kinked line with a
  minimum radius of eight metres where the old one managed thirteen.

  So the same relaxation runs over a ladder of spans. Measuring the bend between samples sixty-four
  metres apart makes a pass carry sixty-four metres of news, and finds the broad shape — which side
  to be on, where to start moving. Each finer span then sharpens it without undoing it, down to the
  metre. Same energy, same step, only the distance over which the bend is measured changes.
  */
  _minCurvature(lo, hi, passes) {
    const RELAX = 0.5;              // the stencil is wide; a full Newton step overshoots
    // Bending alone, with no term for the path's own length. Adding one is the textbook blend —
    // the widest arc against the shortest way round — and it was tried: a tenth of length weight
    // costs six seconds over eight circuits, half a weight costs fourteen. On a road this wide
    // relative to its corners, the shortest way round is simply slower.
    const N = this.n, xs = this.xs, ys = this.ys, nx = this.nx, ny = this.ny;
    const a = new Float32Array(N);
    const px = new Float32Array(N), py = new Float32Array(N);
    const dx = new Float32Array(N), dy = new Float32Array(N);
    const at = (i) => ((i % N) + N) % N;
    const place = (i) => { px[i] = xs[i] + nx[i] * a[i]; py[i] = ys[i] + ny[i] * a[i]; };
    // Start in the middle of the corridor: where the road is not symmetric, that is the line's home.
    for (let i = 0; i < N; i++) { a[i] = (lo[i] + hi[i]) / 2; place(i); }

    // One clean Jacobi step per pass: the whole gradient is read from the positions as they were
    // at the start of the pass, every offset moves, and only then are the positions rebuilt.
    // Moving a point in the middle of reading the gradient mixes old and new, and on this stencil
    // that is unstable — the line diverges and pins itself to the edges of the road, which showed
    // up as an eleven-metre jump across the start line.
    const grad = new Float32Array(N);
    const spans = [64, 32, 16, 8, 4, 2, 1].filter(h => h * 4 < N);
    for (const h of spans) {
      for (let it = 0; it < passes; it++) {
        for (let i = 0; i < N; i++) {
          const p = at(i - h), q = at(i + h);
          dx[i] = px[p] - 2 * px[i] + px[q];
          dy[i] = py[p] - 2 * py[i] + py[q];
        }
        for (let i = 0; i < N; i++) {
          const p = at(i - h), q = at(i + h);
          // d²E/da² = 6 for this stencil, so the Newton step is the gradient over six
          grad[i] = (nx[i] * (dx[p] - 2 * dx[i] + dx[q]) + ny[i] * (dy[p] - 2 * dy[i] + dy[q])) / 6;
        }
        for (let i = 0; i < N; i++) a[i] = clamp(a[i] - RELAX * grad[i], lo[i], hi[i]);
        for (let i = 0; i < N; i++) place(i);
      }
    }
    return a;
  }

  // A line must be something a car can actually follow: limit how fast it moves across the road
  // (metres of lateral per metre travelled), forward and backward so both ends of a move are gentle.
  /* Limite la vitesse à laquelle une ligne traverse la piste — mais pas la même chose pour chacune.

  La ligne de course est bridée sur sa position, et généreusement : elle est résolue, pas devinée, et
  sa courbure est déjà la plus faible que la route autorise. Un plafond sévère ne pourrait que la
  rabattre vers le milieu, ce qu'il faisait — à sept centimètres par mètre, traverser sept mètres de
  piste demande cent mètres, et elle n'atteignait jamais l'extérieur avant un virage.

  Les deux autres sont bridées sur leur **écart à la ligne de course**, et non sur leur position.
  C'est la correction d'un défaut qui rendait la ligne « intérieure » inutilisable : bridée en
  absolu à 0,07 m/m quand la ligne de course se déporte jusqu'à 0,30, elle ne pouvait pas suivre
  celle-ci dans une entrée de virage et se faisait littéralement rabattre — les deux lignes ne se
  trouvaient de part et d'autre que 60 % du temps, et l'intérieure passait du mauvais côté. Brider
  l'écart plutôt que la position est d'ailleurs ce qui a un sens : une voiture sur la ligne
  intérieure roule sensiblement parallèle à la ligne de course, et ne s'en écarte que
  progressivement. */
  _limitLines(maxSlope, racingSlope) {
    const N = this.n;
    const lisse = (a, limit) => {
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 1; i <= N; i++) { const j = i % N, k = (i - 1) % N; a[j] = clamp(a[j], a[k] - limit, a[k] + limit); }
        for (let i = N - 1; i >= -1; i--) { const j = (i + N) % N, k = (i + 1) % N; a[j] = clamp(a[j], a[k] - limit, a[k] + limit); }
      }
      return Track.smooth(a, 4);
    };
    this.lines.racing = lisse(this.lines.racing, racingSlope == null ? maxSlope : racingSlope);
    const r = this.lines.racing;
    for (const name of LINE_NAMES) {
      if (name === 'racing') continue;
      const a = this.lines[name];
      const ec = new Float32Array(N);
      for (let i = 0; i < N; i++) ec[i] = a[i] - r[i];
      const lim = lisse(ec, maxSlope);
      const out = new Float32Array(N);
      for (let i = 0; i < N; i++) out[i] = r[i] + lim[i];
      this.lines[name] = out;
    }
  }

  // Editor tracks: each drawn line becomes a lateral profile by walking it along the centreline.
  /** La part moyenne des stations où les trois lignes projetées sortent de la chaussée. */
  _partHorsPiste() {
    let hors = 0, tot = 0;
    for (const nom of NOMS_AUTEUR) {
      const t = this.tracees && this.tracees[nom];
      if (!t) continue;
      for (let i = 0; i < this.n; i++) {
        tot++;
        if (Math.abs(t[i]) > (t[i] > 0 ? this.hwL[i] : this.hwR[i]) + 0.5) hors++;
      }
    }
    return tot ? hors / tot : 0;
  }

  _projectLines(lines, scale) {
    const N = this.n, xs = this.xs, ys = this.ys, nx = this.nx, ny = this.ny;
    /* On projette sous les noms de l'AUTEUR, puis on range par côté.

    Les tracés de `tracks.js` et de l'éditeur sont écrits en intérieure / idéale / extérieure, et ils
    le restent : c'est le format dans lequel Bruno les dessine et les relit, et le changer casserait
    tout ce qui les édite. La conversion vers les deux côtés fixes se fait ici, à la projection, et
    nulle part ailleurs. */
    const projete = {};
    for (const name of NOMS_AUTEUR) {
      const pts = lines[name];
      const lat = new Float32Array(N);
      if (!pts || pts.length < 3) { lat.fill(0); projete[name] = lat; continue; }
      const dense = Track.spline(pts.map(p => [p[0] * scale, p[1] * scale]), 16);
      const acc = new Float32Array(N), cnt = new Uint16Array(N);
      // start: nearest centre sample to the first point
      let j = 0, best = Infinity;
      for (let i = 0; i < N; i++) { const d = (xs[i] - dense[0][0]) ** 2 + (ys[i] - dense[0][1]) ** 2; if (d < best) { best = d; j = i; } }
      for (const p of dense) {
        // search a forward window so crossovers don't jump branches
        let bj = j, bd = Infinity;
        for (let w = -6; w <= 40; w++) {
          const i = (j + w + N) % N;
          const d = (xs[i] - p[0]) ** 2 + (ys[i] - p[1]) ** 2;
          if (d < bd) { bd = d; bj = i; }
        }
        j = bj;
        acc[j] += (p[0] - xs[j]) * nx[j] + (p[1] - ys[j]) * ny[j];
        cnt[j]++;
      }
      // fill gaps by interpolation around the loop
      let firstFilled = -1;
      for (let i = 0; i < N; i++) if (cnt[i]) { firstFilled = i; break; }
      if (firstFilled < 0) { lat.fill(0); projete[name] = lat; continue; }
      let i = firstFilled, guard = 0;
      while (guard++ < N + 2) {
        const v0 = acc[i] / cnt[i];
        let nxt = (i + 1) % N, gap = 1;
        while (!cnt[nxt] && gap < N) { nxt = (nxt + 1) % N; gap++; }
        const v1 = acc[nxt] / cnt[nxt];
        for (let g = 0; g < gap; g++) lat[(i + g) % N] = v0 + (v1 - v0) * (g / gap);
        i = nxt;
        if (i === firstFilled) break;
      }
      projete[name] = Track.smooth(lat, 4);
    }
    this.lines.racing = projete.racing;
    this.tracees = projete;
    this._fusionneCotes(projete.inside, projete.outside);
  }

  // Apply local width adjustments after the base road width is known.
  _applyRoadWidenings() {
    for(const zone of this.def.roadWidenings||[]){
      const pts=zone.points,key=zone.side>0?this.hwL:this.hwR;
      for(let i=0;i<this.n;i++){
        let f=i/this.n;if(f<pts[0][0])f+=1;
        if(f<pts[0][0]||f>pts.at(-1)[0])continue;
        let j=0;while(j<pts.length-2&&f>pts[j+1][0])j++;
        const [a,b]=[pts[j],pts[j+1]],u=(f-a[0])/(b[0]-a[0]);
        key[i]=Math.max(2.5,key[i]+(a[1]+(b[1]-a[1])*u)*this.widthScale);
      }
    }
  }

  // Road edges for custom tracks: cover drawn lines plus a margin.
  _widthFromLines() {
    const N = this.n, m = 2.2, minHw = 4.5;
    const L = new Float32Array(N), R = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      let maxL = 0, maxR = 0;
      for (const name of LINE_NAMES) { const v = this.lines[name][i]; if (v > maxL) maxL = v; if (-v > maxR) maxR = -v; }
      L[i] = Math.max(minHw, maxL + m); R[i] = Math.max(minHw, maxR + m);
    }
    this.hwL = Track.smooth(L, 8); this.hwR = Track.smooth(R, 8);
  }

  _clampLines() {
    const N = this.n;
    const borner = (a) => { for (let i = 0; i < N; i++) a[i] = clamp(a[i], -(this.hwR[i] - 1.3), this.hwL[i] - 1.3); };
    for (const name of LINE_NAMES) borner(this.lines[name]);
    /* LE LEVIER NE DOIT JAMAIS RECULER, et pour ça les deux bords doivent ENCADRER l'idéale.

    `targetLat` va de la bleue à l'idéale puis de l'idéale à la jaune. La course est donc monotone
    si et seulement si bleue ≤ idéale ≤ jaune — et rien ne le garantissait. Deux causes : une ligne
    idéale tracée à la main s'appuie parfois contre un bord au-delà des deux lignes secondaires, et
    le lissage de `_limitLines` déplace les trois indépendamment.

    MESURÉ, et c'est le défaut que Bruno décrit depuis le début. Avec l'intérieure et l'extérieure
    du virage, le levier reculait sur 51,8 % des stations des douze circuits, de 11,4 m au pire :
    normal, les deux extrémités échangeaient de place à chaque changement de main. Ranger par côté
    le ramène à 10,2 %. Cette ligne-ci finit le travail : elle tombe à zéro.

    Ce qu'on perd : là où l'idéale dépasse un bord, ce bord devient l'idéale elle-même, et le levier
    n'offre plus rien de ce côté-là, localement. Un levier qui ne fait rien vaut mieux qu'un levier
    qui part à l'envers. */
    const R = this.lines.racing;
    let J = this.lines.jaune, B = this.lines.bleu;
    const encadrer = () => {
      borner(J); borner(B);
      for (let i = 0; i < N; i++) {
        if (J[i] < R[i]) J[i] = R[i];
        if (B[i] > R[i]) B[i] = R[i];
      }
    };
    encadrer();
    /* LISSER CONTRE LES BORNES, PAS AVANT ELLES.

    Les lignes de côté étaient lissées dans `_limitLines`, puis bornées ici : collées au bord de la
    piste, et empêchées de passer de l'autre côté de l'idéale. Chacune de ces deux bornes coupe la
    courbe là où elle s'applique, et laisse un angle — la ligne arrive en biais contre le bord ou
    contre l'idéale et repart d'un coup. Mesuré en variation de courbure, sur six circuits : les lignes
    de côté changeaient deux fois plus vite que l'idéale (99e centile), avec des coudes jusqu'à dix
    fois plus vifs — 3 645 contre 383 à Spa, 1 796 contre 863 à Suzuka (millièmes par mètre carré).

    On alterne donc un lissage court et les bornes, douze fois : la ligne vient s'appuyer contre le
    bord et contre l'idéale au lieu de s'y briser. Les coudes tombent à 820 et 368, le 99e centile au
    niveau de l'idéale, et la largeur offerte par le levier ne bouge pas (2,59 m vers l'intérieur
    contre 2,58, `tools/curseur.js`). Un joueur qui tient la jaune pleins gaz sort 91 fois au lieu de
    108 sur 151 km, et les tours sur les lignes de côté vont plus vite. */
    for (let passe = 0; passe < LIGNES_COTES.passes; passe++) {
      J = Track.smooth(J, LIGNES_COTES.fenetre); B = Track.smooth(B, LIGNES_COTES.fenetre);
      encadrer();
    }
    this.lines.jaune = J; this.lines.bleu = B;
  }

  // Real curvature of each line: the road curvature at that offset plus the bending of the line
  // itself as it moves across the road (a line drifting from outside to inside bends more than
  // the road at corner entry). This is what the cars actually have to turn, so the braking AI
  // and the speed profile use it.
  /* How hard each line actually bends — the number the speed profile brakes for.

  Measured on the line's own points rather than from a formula on the road's curvature plus the
  offset's second difference. The formula is right in the limit, but it was evaluated over a
  six-metre stencil and then smoothed again, so a line that tightened over a couple of metres came
  out gentler than it is. The car was sent into those places carrying speed it could not hold: the
  grip demand peaked at three times what the tyres had, and it slid rather than turned.
  */
  _lineCurvatures() {
    const N = this.n;
    this.lineK = {};
    const at = (i) => ((i % N) + N) % N;
    for (const name of LINE_NAMES) {
      const lat = this.lines[name], out = new Float32Array(N);
      const px = new Float32Array(N), py = new Float32Array(N);
      for (let i = 0; i < N; i++) { px[i] = this.xs[i] + this.nx[i] * lat[i]; py[i] = this.ys[i] + this.ny[i] * lat[i]; }
      for (let i = 0; i < N; i++) {
        const p = at(i - 1), q = at(i + 1);
        // signed turn per metre travelled: the circle through the three points
        const ax = px[i] - px[p], ay = py[i] - py[p];
        const bx = px[q] - px[i], by = py[q] - py[i];
        const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
        if (la < 1e-4 || lb < 1e-4) { out[i] = 0; continue; }
        let d = Math.atan2(by, bx) - Math.atan2(ay, ax);
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        out[i] = 2 * d / (la + lb);
      }
      this.lineK[name] = Track.smooth(out, 2);
    }
  }

  _findCrossings() {
    const N = this.n, xs = this.xs, ys = this.ys, step = 4, res = [];
    const seg = (i) => [xs[i % N], ys[i % N], xs[(i + step) % N], ys[(i + step) % N]];
    for (let i = 0; i < N; i += step) {
      const a = seg(i);
      for (let j = i + 40; j < N && j < i + N - 40; j += step) {
        const b = seg(j);
        const d = (a[2] - a[0]) * (b[3] - b[1]) - (a[3] - a[1]) * (b[2] - b[0]);
        if (Math.abs(d) < 1e-9) continue;
        const t = ((b[0] - a[0]) * (b[3] - b[1]) - (b[1] - a[1]) * (b[2] - b[0])) / d;
        const u = ((b[0] - a[0]) * (a[3] - a[1]) - (b[1] - a[1]) * (a[2] - a[0])) / d;
        if (t >= 0 && t < 1 && u >= 0 && u < 1) res.push({ under: i, over: j });
      }
    }
    return res;
  }

  // ---------- queries ----------
  wrap(s) { const L = this.length; s = s % L; return s < 0 ? s + L : s; }
  idx(s) { return Math.floor(this.wrap(s) / this.ds) % this.n; }
  // Samples sit one metre apart; everything positional is interpolated between them, otherwise
  // the car advances in one-metre hops instead of moving continuously.
  _at(s) {
    const w = this.wrap(s) / this.ds, fl = Math.floor(w);
    const i = fl % this.n;
    return { i, j: (i + 1) % this.n, f: w - fl };
  }
  _lerp(arr, s) { const a = this._at(s); return arr[a.i] + (arr[a.j] - arr[a.i]) * a.f; }
  curvAt(s) { return this._lerp(this.k, s); }
  headingAt(s) {
    const a = this._at(s);
    let d = this.th[a.j] - this.th[a.i];
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return this.th[a.i] + d * a.f;
  }
  // curvature of the offset curve at lateral offset lat (positive = left)
  curvAtLat(s, lat) {
    const k = this.curvAt(s);
    return k / Math.max(0.25, 1 + k * lat);
  }
  // metres of centreline per metre travelled at offset lat
  advanceFactor(s, lat) { return 1 / Math.max(0.25, 1 + this.curvAt(s) * lat); }
  /** La largeur de vibreur qui compte comme piste à cette station — zéro dans les lignes droites. */
  kerbAt(s) { return this.kerb ? this._lerp(this.kerb, s) : 0; }
  hwLeftAt(s) { return this._lerp(this.hwL, s); }
  hwRightAt(s) { return this._lerp(this.hwR, s); }
  lineLat(name, s) { return this._lerp(this.lines[name], s); }

  /* La voie des stands, calculée et non dessinée.

  Aucun circuit n'en a. Les douze intégrés sont une ligne centrale et des largeurs, ceux de
  l'éditeur aussi, et en dessiner douze à la main aurait laissé les circuits perso sans stands —
  donc la moitié du chantier inutilisable pour qui fabrique ses propres tracés.

  Elle est donc déduite du tracé : un couloir décalé latéralement du côté DROIT, qui s'écarte de la
  piste avant la ligne d'arrivée, longe la case d'arrêt, et revient se fondre après. Le côté droit
  plutôt que l'intérieur du virage : « intérieur » change de sens à chaque courbe, alors qu'un côté
  fixe donne une voie qui ne traverse jamais la piste.

  Les trois repères sont proportionnels à la longueur du circuit et bornés : sur un tracé court la
  voie occuperait sinon un quart du tour, sur un tracé long elle serait ridicule. */
  /* La voie est placée par défaut sur la ligne d'arrivée, et se déplace par circuit.

  Le défaut vaut pour onze tracés sur douze. Spa fait exception : sa zone d'arrêt tombait dans le
  dernier virage, la voiture y passait en portant la vitesse de la courbe et sa vitesse minimale
  dans la zone ne descendait jamais en dessous de 12,7 m/s. Aucun arrêt de toute la course, sur ce
  seul circuit. Le tracé n'a aucun croisement, contrairement à ce que j'avais d'abord supposé.

  `def.pitAt` — la fraction du tour où se trouve la ZONE D'ARRÊT — le corrige, et sert aussi aux
  circuits de l'éditeur.

  J'AI ESSAYÉ DE LE CHOISIR AUTOMATIQUEMENT, en cherchant le tronçon le plus droit quand la ligne
  est trop tordue, et la mesure a refusé : la courbure ne prédit pas l'échec. Le défaut de Spa a
  une courbure maximale de 49,6 pour mille dans sa zone — mais celui du Nürburgring vaut 65,3 et
  fonctionne, Red Bull Ring 43,5 fonctionne, Le Mans 34,3 fonctionne. Aucun seuil ne sépare le cas
  qui casse des cas qui marchent. Un placement automatique aurait donc déplacé six circuits sains
  sur un critère faux, pour en sauver un. */
  /* Une reprise annotée peut aussi donner l'entrée et la sortie elles-mêmes (`pitFrom`, `pitTo`,
  en fraction du tour) : la voie suit alors le trait noir du dessin, et la zone d'arrêt reste où
  `pitAt` la met — les garages ne bougent pas quand seule une bretelle est reprise. */
  _buildPits(def) {
    const L = this.length;
    if (def && def.pitFrom != null && def.pitTo != null) {
      const entree = this.wrap(def.pitFrom * L), sortie = this.wrap(def.pitTo * L);
      const long = this.wrap(sortie - entree);
      const boite = def.pitAt != null ? this.wrap(def.pitAt * L) : this.wrap(entree + long / 2);
      this.pit = { entree, boite, sortie, long, separation: 1.2, largeur: 6.0, zone: 26 };
      return;
    }
    const long = def && def.pitLength != null ? clamp(def.pitLength, 120, L * 0.3)
      : Math.max(160, Math.min(L * 0.22, 340));
    const ancre = def && def.pitAt != null ? this.wrap(def.pitAt * L) : this.wrap(-long * 0.20);
    this.pit = {
      entree: this.wrap(ancre - long * 0.50),
      boite: ancre,
      sortie: this.wrap(ancre + long * 0.50),
      long,
      separation: 1.2,   // bande neutre entre le bord de piste et le bord intérieur de la voie
      largeur: 6.0,      // largeur de la voie elle-même
      zone: 26,          // demi-longueur de la zone d'arrêt — il suffit de s'y arrêter
    };
  }

  // Géométrie commune au rendu et aux contraintes des branches voisines.
  pitGarages() {
    if(!this.pit)return [];
    const w=16,h=w*287/880,out=[];
    for(const dec of [-w,0,w]){
      const s=this.wrap(this.pit.boite+dec),z=this.pitAt(s);
      if(!z)continue;
      const c=this.pos(s,z.externe-h/2);
      out.push({x:c.x,y:c.y,a:this.headingAt(s)+Math.PI,w,h,s});
    }
    return out;
  }

  /* Où se trouve la voie des stands à cette abscisse, et à quel point on y est engagé.

  UNE VOIE PARALLÈLE, comme sur un vrai circuit : deux courtes bretelles aux extrémités, et entre
  les deux un couloir à écart CONSTANT du bord de piste. La première version biseautait sur toute
  la longueur, ce qui donnait un losange — on s'écartait puis on revenait sans jamais longer quoi
  que ce soit, et il n'y avait pas de « voie » à proprement parler.

  L'écart se mesure depuis le bord droit de la piste et non depuis l'axe : `hwRightAt` varie avec
  l'abscisse, donc suivre le bord garde la voie parallèle à la PISTE plutôt qu'à sa ligne médiane.
  C'est ce que fait un vrai circuit, et c'est ce qui évite que la voie morde dans l'asphalte là où
  la piste s'élargit.

  Rend `null` hors de la voie. `u` va de 0 à 1 de l'entrée à la sortie. */
  pitAt(s) {
    const p = this.pit;
    if (!p) return null;
    const span = this.wrap(p.sortie - p.entree);
    const d = this.wrap(s - p.entree);
    if (d > span) return null;
    const u = d / span;
    // bretelles courtes : 12 % à l'entrée, 14 % à la sortie. Entre les deux, écart plein.
    const ecart = Math.min(1, Math.min(u / 0.12, (1 - u) / 0.14));
    const dBoite = this.wrap(s - p.boite);
    /* Les deux bords, mesurés depuis le bord de piste vers l'EXTÉRIEUR.

    La première version posait l'axe de la voie à un écart fixe et en déduisait les bords par
    demi-largeur. Aux extrémités, où l'écart tombe à zéro, le bord intérieur passait donc DANS la
    piste, et le polygone tracé couvrait tout depuis l'asphalte jusqu'aux garages : une dalle large
    de quinze mètres au lieu d'une voie de six. On construit donc depuis le bord, vers le dehors,
    et la voie ne peut plus mordre sur la piste. */
    const bord = this.hwRightAt(s);
    const interne = -(bord + p.separation * ecart);
    const externe = interne - p.largeur * (0.4 + 0.6 * ecart);
    return {
      u, ecart, interne, externe,
      lat: (interne + externe) / 2,
      // distance signée à la zone d'arrêt : négative avant, positive après
      boite: dBoite > this.length / 2 ? dBoite - this.length : dBoite,
      // dans la zone d'arrêt ? il suffit d'y être arrêté, la précision n'est pas le jeu
      dansZone: Math.abs(dBoite > this.length / 2 ? dBoite - this.length : dBoite) < p.zone,
    };
  }
  // blend of the three lines: sel in [-1, 1] (-1 bleu/droite, 0 racing, +1 jaune/gauche)
  /* Où viser, à cette abscisse, pour la position de levier demandée.

  `sel` va de -1 (corde) à +1 (extérieur), et AU-DELÀ DE -1 vient la voie des stands : c'est la
  coche de plus sur le levier. En dessous de -1 on mélange donc la ligne intérieure et le couloir
  des stands, ce qui donne un rabattement progressif plutôt qu'un saut — et, hors de la voie, la
  position -2 ne vaut rien de plus que la corde, si bien qu'un pilote qui la demande trop tôt reste
  simplement à l'intérieur jusqu'à l'entrée. */
  targetLat(s, sel) {
    const r = this._lerp(this.lines.racing, s);
    if (sel >= 0) return r + (this._lerp(this.lines.jaune, s) - r) * Math.min(1, sel);
    const dedans = r + (this._lerp(this.lines.bleu, s) - r) * Math.min(1, -sel);
    if (sel > -1) return dedans;
    const p = this.pitAt(s);
    if (!p) return dedans;
    return dedans + (p.lat - dedans) * Math.min(1, -sel - 1);
  }
  // curvature of the blended line (what a car following it really turns)
  lineCurv(s, sel) {
    const r = this._lerp(this.lineK.racing, s);
    if (sel < 0) return r + (this._lerp(this.lineK.bleu, s) - r) * Math.min(1, -sel);
    return r + (this._lerp(this.lineK.jaune, s) - r) * Math.min(1, sel);
  }
  // strongest curvature ahead along a line
  curvAhead(s, dist, sel) {
    const i0 = this.idx(s), cnt = Math.max(1, Math.round(dist / this.ds));
    let best = 0;
    for (let j = 0; j < cnt; j++) {
      const i = (i0 + j) % this.n;
      const v = sel == null ? this.k[i] : this.lineCurv(i * this.ds, sel);
      if (Math.abs(v) > Math.abs(best)) best = v;
    }
    return best;
  }
  // nearest centreline sample to a world point, searched in a window around `nearS`
  project(x, y, nearS, window) {
    const N = this.n, W = window || 8;   // small window: a crossing must never latch the other branch
    const i0 = this.idx(nearS || 0);
    let best = i0, bd = Infinity;
    for (let d = -W; d <= W; d++) {
      const i = ((i0 + d) % N + N) % N;
      const dx = x - this.xs[i], dy = y - this.ys[i], dd = dx * dx + dy * dy;
      if (dd < bd) { bd = dd; best = i; }
    }
    const i = best, j = (i + 1) % N, h = (i - 1 + N) % N;
    // refine onto the neighbouring segment so `s` is continuous, not snapped to the sample
    let bi = i, t = 0;
    for (const [a, b] of [[h, i], [i, j]]) {
      const ax = this.xs[a], ay = this.ys[a], vx = this.xs[b] - ax, vy = this.ys[b] - ay;
      const l2 = vx * vx + vy * vy || 1e-9;
      const u = clamp(((x - ax) * vx + (y - ay) * vy) / l2, 0, 1);
      const px = ax + vx * u, py = ay + vy * u;
      const dd = (x - px) * (x - px) + (y - py) * (y - py);
      if (dd < bd) { bd = dd; bi = a; t = u; }
    }
    const sOut = (bi + t) * this.ds;
    const nx = this.nx[bi], ny = this.ny[bi];
    return { s: sOut, i: bi, lat: (x - this.xs[bi]) * nx + (y - this.ys[bi]) * ny };
  }

  pos(s, lat) {
    const a = this._at(s), i = a.i, j = a.j, f = a.f;
    const x = this.xs[i] + (this.xs[j] - this.xs[i]) * f, y = this.ys[i] + (this.ys[j] - this.ys[i]) * f;
    const nx = this.nx[i] + (this.nx[j] - this.nx[i]) * f, ny = this.ny[i] + (this.ny[j] - this.ny[i]) * f;
    return { x: x + nx * lat, y: y + ny * lat };
  }
  diff(a, b) {
    let d = this.wrap(b) - this.wrap(a);
    const L = this.length;
    if (d > L / 2) d -= L;
    if (d <= -L / 2) d += L;
    return d;
  }
}

Track.BAC_M = 12;

if (typeof module !== 'undefined') module.exports = { Track, LINE_NAMES, NOMS_AUTEUR, KERB_IN, KERB_LARGE, KERB_RAMPE };
