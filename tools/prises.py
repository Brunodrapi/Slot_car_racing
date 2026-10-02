#!/usr/bin/env python3
"""Ramene les prises de moteur a un format que le jeu n a aucune raison de depasser.

    python3 tools/prises.py <fichier.wav...> [--bits=16] [--essai]

Les prises de markeasting/engine-audio sont des WAV en VIRGULE FLOTTANTE 32 bits : quatre octets par
echantillon et par canal. C est le format d un atelier de montage, pas celui d un jeu — il garde une
dynamique de 1500 dB dont aucune n est utilisee ici, les pics mesures tenant entre 0,17 et 0,87.

En entier 16 bits, c est deux fois moins lourd pour 96 dB de dynamique, soit trente fois le rapport
signal sur bruit de n importe quelle voiture de course. Et SURTOUT : rien d autre ne change. Pas de
codec, pas de delai d encodage, pas de remplissage en fin de fichier — les boucles se raccordent au
meme echantillon qu avant.

C est ce dernier point qui disqualifie le MP3 ici. Ces prises bouclent en permanence, bout a bout,
et un encodeur MP3 ajoute un delai au debut et un remplissage a la fin. Le raccord n est plus au bon
endroit, et un moteur qui tourne a 6000 tours repasse par ce raccord plusieurs fois par seconde.

`--essai` mesure sans rien ecrire.
"""
import glob
import os
import struct
import sys

import numpy as np


def lis(chemin):
    d = open(chemin, 'rb').read()
    assert d[:4] == b'RIFF' and d[8:12] == b'WAVE', 'pas un WAV'
    i, fmt, data = 12, None, None
    while i + 8 <= len(d):
        cid = d[i:i + 4]
        n = struct.unpack('<I', d[i + 4:i + 8])[0]
        corps = d[i + 8:i + 8 + n]
        if cid == b'fmt ':
            fmt = struct.unpack('<HHIIHH', corps[:16])
        elif cid == b'data':
            data = corps
        i += 8 + n + (n & 1)
    tag, ch, sr, _, _, bits = fmt
    if tag == 3 and bits == 32:
        a = np.frombuffer(data, dtype='<f4').astype(np.float64)
    elif tag == 1 and bits == 16:
        a = np.frombuffer(data, dtype='<i2').astype(np.float64) / 32768.0
    else:
        raise SystemExit(f'format non gere : tag {tag}, {bits} bits')
    return a.reshape(-1, ch), sr, ch, tag, bits


def ecris(chemin, a, sr, ch):
    """PCM 16 bits. On arrondit au plus proche et on borne : un depassement boucle, sinon."""
    q = np.clip(np.round(a * 32767.0), -32768, 32767).astype('<i2')
    corps = q.tobytes()
    bloc = ch * 2
    entete = struct.pack('<4sI4s4sIHHIIHH4sI', b'RIFF', 36 + len(corps), b'WAVE', b'fmt ', 16,
                         1, ch, sr, sr * bloc, bloc, 16, b'data', len(corps))
    with open(chemin, 'wb') as f:
        f.write(entete + corps)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    opts = {a.split('=')[0][2:]: (a.split('=')[1] if '=' in a else '1') for a in sys.argv[1:] if a.startswith('--')}
    fichiers = []
    for a in args:
        fichiers.extend(sorted(glob.glob(a)) if any(c in a for c in '*?') else [a])
    if not fichiers:
        print(__doc__)
        return 1
    essai = 'essai' in opts
    print(f'\n  {len(fichiers)} prise(s){" · essai, rien ne sera ecrit" if essai else ""}\n')
    avant = apres = 0
    for p in fichiers:
        a, sr, ch, tag, bits = lis(p)
        o = os.path.getsize(p)
        if tag == 1 and bits == 16:
            print(f'  {os.path.basename(p)[:34]:36} deja en 16 bits, rien a faire')
            avant += o
            apres += o
            continue
        pic = float(np.max(np.abs(a)))
        # Le bruit de quantification, mesure et non suppose : on requantifie et on compare.
        q = np.clip(np.round(a * 32767.0), -32768, 32767) / 32767.0
        err = float(np.sqrt(np.mean((a - q) ** 2)))
        sig = float(np.sqrt(np.mean(a ** 2)))
        snr = 20 * np.log10(max(sig, 1e-12) / max(err, 1e-12))
        if not essai:
            ecris(p, a, sr, ch)
        n = os.path.getsize(p) if not essai else o // 2
        avant += o
        apres += n
        print(f'  {os.path.basename(p)[:34]:36} {o // 1024:5} → {n // 1024:5} ko'
              f' · pic {pic:.3f} · bruit de quantification à {snr:5.1f} dB sous le signal')
    print(f'\n  {avant // 1024} ko → {apres // 1024} ko'
          f' ({avant / max(1, apres):.2f} fois plus leger)\n')
    return 0


if __name__ == '__main__':
    sys.exit(main())
