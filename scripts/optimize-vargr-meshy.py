#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""TuşLab PvP / paket 23 — Vargr (Meshy) model sıkıştırma betiği.

  python scripts/optimize-vargr-meshy.py            # sıkıştır ve yaz
  python scripts/optimize-vargr-meshy.py --check    # yalnız boyut raporla

Kaynak: assets/models/vargr/kaynak/vargr-meshy-ham.glb (≈4,6 MB; Meshy AI (Pro)
üretimi — tek mesh, 24 kemikli iskelet, kök Armature ölçeği 0,01, gömülü tek
2048×2048 PNG doku ≈3,56 MB). Draco/meshopt KULLANILMAZ (projede çözücü yok,
pvp/vendor'a dokunmak yasak).

Yapılanlar:
  1. Gömülü PNG dokusu 1024×1024'e küçültülür (LANCZOS) ve WebP'ye çevrilir
     (kalite 82, method 6). Çıktı GLB'si hedefi (1,5 MB) aşarsa 768×768 denenir.
  2. GLB yeniden paketlenir: images[0].mimeType 'image/webp' olur,
     textures[0].extensions.EXT_texture_webp.source ayarlanır (textures[0].source
     alanı da kalır), extensionsUsed'a 'EXT_texture_webp' eklenir. bufferView'lar
     sırayla yeniden yazılır: her view 4 bayta hizalanır, byteOffset/byteLength
     güncellenir, buffers[0].byteLength yeniden hesaplanır (eski PNG verisi düşer).
  3. asset.generator ve asset.extras'a "Meshy AI (Pro) — TuşLab için üretildi"
     notu eklenir (lisans: assets/models/vargr/LISANS.txt).

Çıktı: assets/models/vargr/vargr.glb (hedef ≤ 1 500 000 bayt).
Yalnız Python 3 + Pillow gerekir (başka paket kurulmaz, ağa çıkılmaz).
"""
from __future__ import annotations

import io
import json
import struct
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "models" / "vargr" / "kaynak" / "vargr-meshy-ham.glb"
OUT = ROOT / "assets" / "models" / "vargr" / "vargr.glb"
LICENSE = ROOT / "assets" / "models" / "vargr" / "LISANS.txt"

TARGET_BYTES = 1_500_000
WEBP_QUALITY = 82
WEBP_METHOD = 6
TEXTURE_SIZES = (1024, 768)  # hedef aşılırsa sırayla küçül
GENERATED_AT = "2026-11-11"
GENERATOR_NOTE = "TuşLab optimize (scripts/optimize-vargr-meshy.py); model: Meshy AI (Pro) — TuşLab için üretildi"

JSON_CHUNK = 0x4E4F534A  # 'JSON'
BIN_CHUNK = 0x004E4942   # 'BIN'


# ------------------------------------------------------------------ GLB I/O

def read_glb(path: Path):
    """GLB'yi ayrıştırır → (glTF JSON sözlüğü, BIN chunk baytları)."""
    data = path.read_bytes()
    magic, version, total = struct.unpack_from("<III", data, 0)
    if magic != 0x46546C67 or version != 2:
        raise SystemExit(f"GLB v2 değil: {path}")
    if total != len(data):
        raise SystemExit(f"GLB başlık uzunluğu uyuşmuyor: {total} != {len(data)}")
    off = 12
    js = None
    bin_data = b""
    while off + 8 <= len(data):
        clen, ctype = struct.unpack_from("<II", data, off)
        payload = data[off + 8 : off + 8 + clen]
        if ctype == JSON_CHUNK and js is None:
            js = json.loads(payload.decode("utf-8"))
        elif ctype == BIN_CHUNK:
            bin_data = payload
        off += 8 + clen + ((4 - clen % 4) % 4)
    if js is None:
        raise SystemExit("JSON chunk yok")
    return js, bin_data


def write_glb(js: dict, bin_data: bytes) -> bytes:
    """GLB yazar: JSON chunk 0x20 ile, BIN chunk 0x00 ile 4 bayta hizalanır."""
    js_buf = json.dumps(js, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    js_buf += b" " * ((4 - len(js_buf) % 4) % 4)
    bin_buf = bin_data + b"\x00" * ((4 - len(bin_data) % 4) % 4)
    total = 12 + 8 + len(js_buf) + 8 + len(bin_buf)
    out = struct.pack("<III", 0x46546C67, 2, total)
    out += struct.pack("<II", len(js_buf), JSON_CHUNK) + js_buf
    out += struct.pack("<II", len(bin_buf), BIN_CHUNK) + bin_buf
    return out


# ------------------------------------------------------------------ repack

def webp_texture(png_bytes: bytes, size: int) -> bytes:
    """PNG baytlarını verilen boyuta küçültüp WebP'ye çevirir."""
    img = Image.open(io.BytesIO(png_bytes))
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGBA")
    if img.width != size or img.height != size:
        img = img.resize((size, size), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, "WEBP", quality=WEBP_QUALITY, method=WEBP_METHOD)
    return buf.getvalue()


def rebuild(js: dict, bin_data: bytes, image_bv_index: int, webp_bytes: bytes) -> bytes:
    """Doku bufferView'ını WebP ile değiştirip BIN'i sırayla yeniden paketler."""
    if len(js.get("buffers", [])) != 1:
        raise SystemExit("beklenmedik: birden çok buffer")
    views = js["bufferViews"]
    payloads = []
    for i, bv in enumerate(views):
        start = bv.get("byteOffset", 0)
        payloads.append(webp_bytes if i == image_bv_index else bin_data[start : start + bv["byteLength"]])
    new_bin = bytearray()
    for bv, payload in zip(views, payloads):
        new_bin += b"\x00" * ((4 - len(new_bin) % 4) % 4)
        bv["byteOffset"] = len(new_bin)
        bv["byteLength"] = len(payload)
        new_bin += payload
    js["buffers"][0]["byteLength"] = len(new_bin)
    return bytes(new_bin)


def build(js: dict, bin_data: bytes, size: int) -> tuple[bytes, bytes]:
    """Verilen doku boyutuyla çıktı GLB'sini üretir → (glb baytları, webp baytları)."""
    js = json.loads(json.dumps(js))  # derin kopya: orijinali koru
    image = js["images"][0]
    bv_index = image["bufferView"]
    bv = js["bufferViews"][bv_index]
    start = bv.get("byteOffset", 0)
    png_bytes = bin_data[start : start + bv["byteLength"]]
    if png_bytes[:8] != b"\x89PNG\r\n\x1a\n":
        raise SystemExit("gömülü doku PNG değil")

    webp_bytes = webp_texture(png_bytes, size)
    new_bin = rebuild(js, bin_data, bv_index, webp_bytes)

    # Doku uzantısı: EXT_texture_webp (source alanı korunur; GLTFLoader kendisi çözer).
    image["mimeType"] = "image/webp"
    texture = js["textures"][0]
    texture.setdefault("extensions", {})["EXT_texture_webp"] = {"source": texture.get("source", 0)}
    used = js.setdefault("extensionsUsed", [])
    if "EXT_texture_webp" not in used:
        used.append("EXT_texture_webp")

    # Üretim notu (lisans kaydı için): önce orijinal üreticiyi sakla, sonra üzerine yaz.
    source_generator = js["asset"].get("generator", "")
    js["asset"]["generator"] = GENERATOR_NOTE
    js["asset"]["extras"] = {
        "generatedBy": "Meshy AI (Pro)",
        "generatedFor": "TuşLab",
        "generatedAt": GENERATED_AT,
        "license": "assets/models/vargr/LISANS.txt",
        "optimizedWith": "scripts/optimize-vargr-meshy.py",
        "sourceGenerator": source_generator,
    }
    return write_glb(js, new_bin), webp_bytes


def main() -> int:
    check = "--check" in sys.argv
    if not SRC.is_file():
        raise SystemExit(f"kaynak yok: {SRC}")
    js, bin_data = read_glb(SRC)
    names = [a.get("name") for a in js.get("animations", [])]
    print(f"kaynak: {SRC.name} {SRC.stat().st_size / 1_048_576:.2f} MB | {len(names)} klip | {names}")
    if check and OUT.is_file():
        print(f"çıktı:  {OUT.name} {OUT.stat().st_size / 1024:.1f} KB (hedef <= {TARGET_BYTES // 1024} KB)")
        return 0

    chosen = None
    for size in TEXTURE_SIZES:
        glb, webp = build(js, bin_data, size)
        print(f"deneme: doku {size}x{size} -> WebP {len(webp) / 1024:.1f} KB | GLB {len(glb) / 1024:.1f} KB")
        chosen = (glb, size)
        if len(glb) <= TARGET_BYTES:
            break
    glb, size = chosen
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_bytes(glb)
    ok = len(glb) <= TARGET_BYTES
    print(f"yazıldı: {OUT} {len(glb) / 1024:.1f} KB (doku {size}x{size}) - {'hedef içinde' if ok else 'HEDEF ASILDI'}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
