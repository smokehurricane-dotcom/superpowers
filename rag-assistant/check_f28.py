import json
chunks = json.load(open("index/meta.json", encoding="utf-8"))
hits = [c for c in chunks if "F.28" in c["text"] or "F28" in c["text"]]
print("Chunks mit F.28/F28:", len(hits))
for c in hits[:3]:
    print("---", c["title"][:40])
    print(c["text"][:400])
    print()