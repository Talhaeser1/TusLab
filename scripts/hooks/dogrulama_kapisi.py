# -*- coding: utf-8 -*-
"""Stop hook: kod değişen bir tur, doğrulama yapılmadan bitirilemez.

Claude Code turu bitirmek istediğinde stdin'e JSON gelir (transcript_path,
stop_hook_active). Bu betik son kullanıcı mesajından beri olan araç
çağrılarına bakar:
  - Kod dosyası (.js .mjs .css .html .py) düzenlendiyse ya da kod yazan bir alt
    ajan çalıştırıldıysa -> ana model `node --test` çalıştırmış olmalı.
  - Oyunda görünen bir dosya (home/, pvp/, .css, .html) değiştiyse -> ana model
    tarayıcıda ekran görüntüsü almış olmalı.
Eksik varsa {"decision":"block"} döner ve model devam etmek zorunda kalır.
İkinci denemede (stop_hook_active) sonsuz döngü olmasın diye engellemez ama
kullanıcıya görünür bir uyarı basar.
"""
import json
import re
import sys

KOD_UZANTI = re.compile(r"\.(m?js|css|html?|py)$", re.I)
GORSEL = re.compile(r"(^|[\\/])(home|pvp)[\\/]|\.(css|html?)$", re.I)
TEST_KOMUT = re.compile(r"node(\.exe)?[\"']?\s+--test|npm\s+(run\s+)?test", re.I)
SHOT_BASH = re.compile(r"screenshot|sshot|bandshot", re.I)
OKUYAN_AJAN = {"Explore", "Plan", "claude-code-guide", "statusline-setup"}
YAZAN_BASH = re.compile(r"sed\s+-i|>\s*\S+\.(m?js|css|html?)\b|tee\s+\S+\.(m?js|css|html?)\b", re.I)


def gercek_kullanici(e):
    if e.get("type") != "user" or e.get("isMeta") or e.get("isSidechain"):
        return False
    c = (e.get("message") or {}).get("content")
    if isinstance(c, str):
        return True
    if isinstance(c, list):
        return not any(isinstance(x, dict) and x.get("type") == "tool_result" for x in c)
    return False


def ekran_goruntusu_mu(name, inp):
    if name.endswith("__computer") and inp.get("action") in ("screenshot", "zoom"):
        return True
    if name.endswith("__browser_batch"):
        for a in inp.get("actions") or []:
            if (a.get("name") or "").endswith("computer") and (a.get("input") or {}).get("action") in ("screenshot", "zoom"):
                return True
    return False


def main():
    try:
        veri = json.loads(sys.stdin.buffer.read().decode("utf-8") or "{}")
    except Exception:
        return 0
    yol = veri.get("transcript_path")
    if not yol:
        return 0
    try:
        satirlar = []
        with open(yol, encoding="utf-8") as f:
            for l in f:
                try:
                    satirlar.append(json.loads(l))
                except Exception:
                    pass
    except OSError:
        return 0

    bas = 0
    for i, e in enumerate(satirlar):
        if gercek_kullanici(e):
            bas = i

    kod = gorsel = test = shot = False
    dosyalar = []
    for e in satirlar[bas:]:
        if e.get("type") != "assistant" or e.get("isSidechain"):
            continue
        for b in (e.get("message") or {}).get("content") or []:
            if not isinstance(b, dict) or b.get("type") != "tool_use":
                continue
            ad, inp = b.get("name") or "", b.get("input") or {}
            if ad in ("Edit", "Write", "MultiEdit", "NotebookEdit"):
                p = inp.get("file_path") or inp.get("notebook_path") or ""
                if KOD_UZANTI.search(p) and "scripts" + "\\hooks" not in p and "scripts/hooks" not in p:
                    kod = True
                    dosyalar.append(p)
                    if GORSEL.search(p):
                        gorsel = True
            elif ad in ("Agent", "Task"):
                if inp.get("subagent_type") not in OKUYAN_AJAN:
                    kod = gorsel = True
                    dosyalar.append("(alt ajan: " + (inp.get("description") or "?") + ")")
            elif ad in ("Bash", "PowerShell"):
                k = inp.get("command") or ""
                if TEST_KOMUT.search(k):
                    test = True
                if SHOT_BASH.search(k):
                    shot = True
                if YAZAN_BASH.search(k):
                    kod = True
                    dosyalar.append("(kabuk komutuyla dosya yazımı)")
            if ekran_goruntusu_mu(ad, inp):
                shot = True

    eksik = []
    if kod and not test:
        eksik.append("`node --test tests/*.test.mjs` çalıştırılmadı (gerçek sayıları yaz)")
    if gorsel and not shot:
        eksik.append("tarayıcıda http://127.0.0.1:5177/index.html açılıp ekran görüntüsüne bakılmadı")
    if not eksik:
        return 0

    ozet = "; ".join(eksik)
    if veri.get("stop_hook_active"):
        print(json.dumps({"systemMessage": "⚠ Doğrulama kapısı: tur doğrulanmadan bitti — " + ozet}, ensure_ascii=False))
        return 0
    neden = (
        "DOĞRULAMA KAPISI: Bu turda kod değişti ("
        + ", ".join(dosyalar[:5])
        + ") ama " + ozet + ". 'Bitti' demeden önce bunları kendin yap ve "
        "ekran görüntüsünde gördüğünü yaz. Yapamıyorsan son mesajda açıkça "
        "'görmedim / denenmedi' de."
    )
    print(json.dumps({"decision": "block", "reason": neden}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main())
