#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""TuşLab — genel Meshy model paketleyici (Konyalı, Harf Muhafızı…).

  python scripts/paketle-meshy.py <ham.glb> <cikti.glb> [ek.glb:KaynakKlip=YeniAd ...]

1. Ek GLB'lerden (aynı iskelet) istenen klipler düğüm ADIYLA ham modele eklenir.
2. Gömülü PNG doku WebP'ye çevrilir (1024, sığmazsa 768) — optimize-vargr-meshy.py ile aynı yöntem.
Çıktı sınırı 1,2 MiB (1 258 291 B). Draco/meshopt yok.
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

LIMIT = 1_258_291
COMP = {"SCALAR": 1, "VEC3": 3, "VEC4": 4}


def floats(js, bin_data, idx):
    acc = js["accessors"][idx]
    bv = js["bufferViews"][acc["bufferView"]]
    start = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
    n = acc["count"] * COMP[acc["type"]]
    return list(struct.unpack_from(f"<{n}f", bin_data, start)), acc["type"]


def add_clip(js, new_bin, sjs, sbin, src_name, dst_name):
    clip = next((a for a in sjs["animations"] if a["name"] == src_name), None)
    if clip is None:
        raise SystemExit(f"klip yok: {src_name}")
    names = {n.get("name"): i for i, n in enumerate(js["nodes"])}
    js["animations"] = [a for a in js["animations"] if a["name"] != dst_name]
    samplers, channels, cache = [], [], {}

    def push(data, typ):
        while len(new_bin) % 4:
            new_bin.append(0)
        off = len(new_bin)
        new_bin.extend(struct.pack(f"<{len(data)}f", *data))
        js["bufferViews"].append({"buffer": 0, "byteOffset": off, "byteLength": len(data) * 4})
        acc = {"bufferView": len(js["bufferViews"]) - 1, "componentType": 5126,
               "count": len(data) // COMP[typ], "type": typ}
        if typ == "SCALAR":
            acc["min"], acc["max"] = [min(data)], [max(data)]
        js["accessors"].append(acc)
        return len(js["accessors"]) - 1

    for ch in clip["channels"]:
        node = sjs["nodes"][ch["target"]["node"]].get("name")
        if node not in names:
            continue
        sidx = ch["sampler"]
        if sidx not in cache:
            smp = clip["samplers"][sidx]
            times, _ = floats(sjs, sbin, smp["input"])
            vals, typ = floats(sjs, sbin, smp["output"])
            samplers.append({"input": push(times, "SCALAR"), "output": push(vals, typ),
                             "interpolation": smp.get("interpolation", "LINEAR")})
            cache[sidx] = len(samplers) - 1
        channels.append({"sampler": cache[sidx], "target": {"node": names[node], "path": ch["target"]["path"]}})
    js["animations"].append({"name": dst_name, "samplers": samplers, "channels": channels})


def main(argv) -> int:
    if len(argv) < 3:
        print(__doc__)
        return 2
    src, out = Path(argv[1]), Path(argv[2])
    js, bin_data = ovm.read_glb(src)
    new_bin = bytearray(bin_data)
    for extra in argv[3:]:
        path, mapping = extra.rsplit(":", 1)
        s, d = mapping.split("=")
        sjs, sbin = ovm.read_glb(Path(path))
        add_clip(js, new_bin, sjs, sbin, s, d)
    js["buffers"][0]["byteLength"] = len(new_bin)
    glb = b""
    for size in (1024, 768, 512):
        glb, _ = ovm.build(js, bytes(new_bin), size)
        if len(glb) <= LIMIT:
            break
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(glb)
    clips = [a["name"] for a in js["animations"]]
    print(f"{out}: {len(glb)} B (sınır {LIMIT}) doku {size}px {'OK' if len(glb) <= LIMIT else 'ASILDI'} | {clips}")
    return 0 if len(glb) <= LIMIT else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
