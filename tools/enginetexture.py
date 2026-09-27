#!/usr/bin/env python3
"""Prépare une **matière** de moteur : une prise sans axe des régimes.

    python3 tools/enginetexture.py <prise.wav> <nom> --garde=<chemin servi>
                                   [--debut=0] [--fin=] [--out=sounds/engine]

Une montée en régime porte une table régime → instant, parce qu'on la parcourt. Une matière, non :
la tête de lecture y tourne librement. C'est ce qui la rend exploitable, et c'est tout l'intérêt.

Deux prises sur trois ne peuvent pas porter d'axe des régimes. Une prise à plein régime ne change
presque pas de hauteur — c'est sa définition — donc la montée qu'on y mesure ne se distingue pas de
la dérive de la mesure. Une décélération de course erre de deux ou trois demi-tons sans chute nette,
parce que le pilote lève, reprend, freine. Leur faire porter une table, c'est fabriquer un axe faux :
le moteur monterait ou descendrait sans rapport avec le compte-tours, ce qui s'entend aussitôt.

Mais ces deux prises portent parfaitement un **timbre**, et c'est ce qui manquait. Une montée ne sait
rien dire de ce qu'un moteur fait installé au rupteur, ni pied levé, où la combustion cesse et où
seule la ligne d'échappement chante. Le lecteur choisit donc sa matière selon l'état du moteur, et
n'en parcourt que celle qui sait de quoi elle parle.

On ne réencode rien : le jeu lit le fichier tel qu'il a été déposé.
"""
import json
import os
import sys
import wave


def main():
    args = [x for x in sys.argv[1:] if not x.startswith('--')]
    opts = dict(x[2:].split('=', 1) for x in sys.argv[1:] if x.startswith('--') and '=' in x)
    if len(args) < 2 or 'garde' not in opts:
        print(__doc__)
        return 1
    src, nom = args[0], args[1]
    out_dir = opts.get('out', os.path.join('sounds', 'engine'))
    os.makedirs(out_dir, exist_ok=True)

    w = wave.open(src)
    duree = w.getnframes() / w.getframerate()
    debut = float(opts.get('debut', 0))
    fin = float(opts['fin']) if 'fin' in opts else duree
    if not (0 <= debut < fin <= duree + 1e-6):
        raise SystemExit(f'bornes hors de la prise, qui fait {duree:.2f} s')

    meta = {'src': opts['garde'].replace(os.sep, '/'), 'role': 'matiere',
            'debut': round(debut, 4), 'fin': round(fin, 4), 'secondes': round(duree, 4)}
    pj = os.path.join(out_dir, f'{nom}.json')
    json.dump(meta, open(pj, 'w', encoding='utf-8'), ensure_ascii=False)
    print(f'{nom} : {opts["garde"]} de {debut:.2f} à {fin:.2f} s sur {duree:.2f} — écrit {pj}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
