# -*- coding: utf-8 -*-
"""UserPromptSubmit hook: kullanıcı bir hata bildirdiğinde modele hafızaya
yazmasını hatırlatır.

stdin'e {"prompt": "...", "transcript_path": "..."} gelir. Mesajda düzeltme
sözcükleri varsa modelin bağlamına bir not eklenir: önce hatayı yeniden üret
ve düzelt, sonra hafıza klasörüne bir feedback dosyası yaz.
"""
import json
import os
import re
import sys

KALIP = re.compile(
    r"yanl[ıi][sş]|hatal[ıi]|\bhata\b|hatas[ıi]|olmam[ıi][sş]|olmad[ıi]|"
    r"çal[ıi][sş]m[ıi]yor|calism[ıi]yor|bozuk|bozul|bozdun|"
    r"kontrol etmeden|kontrol etmedin|bakmad[ıi]n|test etmedin|denemedin|"
    r"düzelmemi[sş]|düzelmedi|duzelmedi|hâlâ|hala ayn[ıi]|yine ayn[ıi]|gene ayn[ıi]|"
    r"görünmüyor|gorunmuyor|eksik kalm|kayboldu|yalan",
    re.I,
)


def main():
    try:
        veri = json.loads(sys.stdin.buffer.read().decode("utf-8") or "{}")
    except Exception:
        return 0
    metin = veri.get("prompt") or ""
    # Ajan raporları ve sistem bildirimleri de bu olayla gelir; onlar kullanıcının hata bildirimi değildir.
    if re.search(r"Another Claude session sent a message|\[Subagent hand-back\]|<task-notification>|SYSTEM NOTIFICATION|<side-sessions-event>|<system-reminder>|^\s*<[a-z-]+-event>|ci-monitor-event", metin):
        return 0
    if not metin or metin.lstrip().startswith("/") or not KALIP.search(metin):
        return 0
    tp = veri.get("transcript_path") or ""
    hafiza = os.path.join(os.path.dirname(tp), "memory") if tp else "~/.claude/projects/<proje>/memory"
    not_ = (
        "HATA HAFIZASI: Kullanıcı bu mesajda bir hata/düzeltme bildiriyor. Sırayla:\n"
        "1) Hatayı önce yeniden üret (ekran görüntüsü geldiyse tarayıcıda aynı durumu göster), sonra düzelt ve doğrula.\n"
        "2) Düzeltme doğrulandıktan sonra " + hafiza + " altına feedback türünde bir hafıza dosyası yaz "
        "(ya da aynı konuda varsa onu güncelle): ne yanlıştı, neden oldu (**Why:**), bir dahaki sefere nasıl "
        "önlenecek (**How to apply:**). MEMORY.md'ye tek satırlık işaretçi ekle.\n"
        "3) Hata 'kontrol etmeden bitti dedim' türündeyse bunu da açıkça kaydet.\n"
        "Mesaj aslında bir hata bildirmiyorsa bu notu yok say."
    )
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": not_}}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main())
