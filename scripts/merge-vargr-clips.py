#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""TuşLab PvP / Şerit H — Vargr koşu/geri yürüme kliplerini vargr.glb'ye ekler.

  python scripts/merge-vargr-clips.py

Kaynak: assets/models/vargr/kaynak/vargr-meshy-kosu.glb (aynı Meshy iskeleti, 26 düğüm,
aynı düğüm sırası/adları). Yalnız animasyon verisi alınır (mesh/doku eklenmez):
  Standard_Forward_Charge_inplace -> Run_Charge
  Walk_Fight_Forward_inplace      -> Walk_Back  (anahtar kareler TERSİNE çevrilir;
                                     kaynakta geri yürüme klibi yoksa ileri yürüyüşün tersi)
Kanallar düğüm ADIYLA yeniden hedeflenir. Betik yinelenebilir: aynı adlı klipler
varsa önce silinir. Çıktı vargr.glb yerinde güncellenir (<= 1 258 291 B).
"""
from __future__ import annotations

import importlib.util
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("ovm", ROOT / "scripts" / "optimize-vargr-meshy.py")
ovm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ovm)

OUT = ROOT / "assets" / "models" / "vargr" / "vargr.glb"
SRC = ROOT / "assets" / "models" / "vargr" / "kaynak" / "vargr-meshy-kosu.glb"
LIMIT = 1_258_291
# (kaynak klip adı, yeni ad, tersine çevir)
CLIPS = (
    ("Standard_Forward_Charge_inplace", "Run_Charge", False),
    ("Walk_Fight_Back_inplace", "Walk_Back", False),
    ("Walk_Fight_Forward_inplace", "Walk_Back", True),  # yukarıdaki yoksa yedek
)
COMP = {"SCALAR": 1, "VEC3": 3, "VEC4": 4}


def accessor_floats(js, bin_data, idx):
    acc = js["accessors"][idx]
    bv = js["bufferViews"][acc["bufferView"]]
    start = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
    n = acc["count"] * COMP[acc["type"]]
    return list(struct.unpack_from(f"<{n}f", bin_data, start)), COMP[acc["type"]], acc["type"]


def main() -> int:
    js, bin_data = ovm.read_glb(OUT)
    sjs, sbin = ovm.read_glb(SRC)
    names_dst = {n["name"]: i for i, n in enumerate(js["nodes"])}
    # eski eklemeleri temizle
    wanted = {"Run_Charge", "Walk_Back"}
    js["animations"] = [a for a in js["animations"] if a["name"] not in wanted]
    src_clips = {a["name"]: a for a in sjs["animations"]}
    new_bin = bytearray(bin_data)
    done = set()
    for src_name, dst_name, reverse in CLIPS:
        if dst_name in done or src_name not in src_clips:
            continue
        done.add(dst_name)
        clip = src_clips[src_name]
        samplers, channels = [], []
        cache = {}
        time_cache = {}
        for ch in clip["channels"]:
            sidx = ch["sampler"]
            smp = clip["samplers"][sidx]
            vals0, comp0, _ = accessor_floats(sjs, sbin, smp["output"])
            node_name0 = sjs["nodes"][ch["target"]["node"]]["name"]
            static = all(abs(v - vals0[i % comp0]) < 1e-6 for i, v in enumerate(vals0))
            # Sabit scale/translation kanalları (Hips çevirisi hariç) boyut tasarrufu için atılır:
            # diğer klipler aynı sabit değeri yazar, poz değişmez.
            if static and (ch["target"]["path"] == "scale" or (ch["target"]["path"] == "translation" and node_name0 != "Hips")):
                continue
            if sidx not in cache:
                times, _, _ = accessor_floats(sjs, sbin, smp["input"])
                vals, comp, typ = accessor_floats(sjs, sbin, smp["output"])
                if reverse:
                    total = times[-1]
                    times = [total - t for t in reversed(times)]
                    groups = [vals[i * comp:(i + 1) * comp] for i in range(len(times))]
                    vals = [x for g in reversed(groups) for x in g]
                if dst_name == "Walk_Back":  # boyut: her 2. anahtar kare (+ son), LINEAR enterpolasyon
                    keep = sorted(set(range(0, len(times), 2)) | {len(times) - 1})
                    groups = [vals[i * comp:(i + 1) * comp] for i in range(len(times))]
                    times = [times[i] for i in keep]
                    vals = [x for i in keep for x in groups[i]]
                accs = []
                tkey = tuple(round(x, 6) for x in times)
                for data, t, count_mul in ((times, "SCALAR", 1), (vals, typ, 1)):
                    if t == "SCALAR" and (dst_name, tkey) in time_cache:
                        accs.append(time_cache[(dst_name, tkey)])
                        continue
                    while len(new_bin) % 4:
                        new_bin.append(0)
                    off = len(new_bin)
                    new_bin += struct.pack(f"<{len(data)}f", *data)
                    js["bufferViews"].append({"buffer": 0, "byteOffset": off, "byteLength": len(data) * 4})
                    acc = {"bufferView": len(js["bufferViews"]) - 1, "componentType": 5126,
                           "count": len(data) // COMP[t], "type": t}
                    if t == "SCALAR":
                        acc["min"], acc["max"] = [min(data)], [max(data)]
                    js["accessors"].append(acc)
                    accs.append(len(js["accessors"]) - 1)
                    if t == "SCALAR":
                        time_cache[(dst_name, tkey)] = accs[-1]
                interp = "LINEAR" if reverse else smp.get("interpolation", "LINEAR")
                samplers.append({"input": accs[0], "output": accs[1], "interpolation": interp})
                cache[sidx] = len(samplers) - 1
            node_name = sjs["nodes"][ch["target"]["node"]]["name"]
            if node_name not in names_dst:
                continue
            channels.append({"sampler": cache[sidx], "target": {"node": names_dst[node_name], "path": ch["target"]["path"]}})
        js["animations"].append({"name": dst_name, "samplers": samplers, "channels": channels})
    js["buffers"][0]["byteLength"] = len(new_bin)
    glb = ovm.write_glb(js, bytes(new_bin))
    OUT.write_bytes(glb)
    print(f"eklendi: {sorted(done)} | {len(glb)} B (sınır {LIMIT}) {'OK' if len(glb) <= LIMIT else 'ASILDI'}")
    return 0 if len(glb) <= LIMIT else 1


if __name__ == "__main__":
    sys.exit(main())
