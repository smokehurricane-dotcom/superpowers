"""Render a RAG-assistant portfolio image from a real Q&A output."""
import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

OUT = r"C:\Users\petra\fiverr\rag-portfolio"
os.makedirs(OUT, exist_ok=True)
HEAD, GRN, ACC = "#1F4E78", "#2f8f4e", "#6b3fa0"

fig = plt.figure(figsize=(12.8, 7.2), facecolor="white")
fig.text(0.03, 0.93, "Ask Your Data — RAG Assistant", fontsize=22, fontweight="bold", color=HEAD)
fig.text(0.03, 0.886, "semantic search over your documents  +  grounded answers with sources    ·    Claude-powered",
         fontsize=11, color="#5b6470")

# ---- Q&A panel (left) ----
ax = fig.add_axes([0.03, 0.05, 0.58, 0.80]); ax.axis("off"); ax.set_xlim(0, 1); ax.set_ylim(0, 1)
ax.add_patch(FancyBboxPatch((0.0, 0.88), 0.92, 0.095, boxstyle="round,pad=0.008,rounding_size=0.02",
                            facecolor="#EEF3FA", edgecolor="#D6DEE8"))
ax.text(0.02, 0.927, "Q:  What is the latest on the Iran nuclear deal?", fontsize=12,
        fontweight="bold", color="#222", va="center")

ax.text(0.0, 0.82, "Answer  —  grounded in your sources, with citations", fontsize=10.5, fontweight="bold", color=GRN)
ans = [
    "Both sides appear close to signing the first stage of a deal [3][5],",
    "but disagree on timing. Trump said it could be signed by Sunday [4]",
    "and later “today” [1][5]; Tehran downplayed his optimism and said no",
    "final decision has been taken yet [1][3]. The deal could see the Strait",
    "of Hormuz “open to all” [1][4]. The signing is not on Trump’s schedule [2].",
]
y = 0.765
for ln in ans:
    ax.text(0.0, y, ln, fontsize=11.2, color="#222"); y -= 0.054

ax.text(0.0, y - 0.02, "Sources", fontsize=10.5, fontweight="bold", color=HEAD); y -= 0.085
for s in ["[1] The Guardian — Trump says Iran deal will be signed today …",
          "[2] Al Jazeera — Signing of US-Iran deal not on Trump’s schedule",
          "[3] Al Jazeera — Washington, Tehran close to signing first stage"]:
    ax.text(0.0, y, s, fontsize=9.7, color="#3a6ea5"); y -= 0.052

# ---- right panel ----
rx = 0.66
fig.text(rx, 0.81, "How it works", fontsize=13, fontweight="bold", color="#333")
for i, s in enumerate(["1   Your documents (txt · pdf · md)", "2   Local semantic index (embeddings)",
                       "3   Retrieve the most relevant passages", "4   Claude answers — only from those, cited"]):
    fig.text(rx + 0.005, 0.765 - i * 0.046, s, fontsize=10.6, color="#333")

fig.text(rx, 0.55, "Why it's different", fontsize=13, fontweight="bold", color="#333")
for i, p in enumerate(["Grounded — no hallucinated facts", "Every claim cited to a source",
                       "Search runs locally (data stays put)", "Works on any document set"]):
    fig.text(rx + 0.005, 0.505 - i * 0.046, "✓   " + p, fontsize=10.6, color="#2f6f43")

axb = fig.add_axes([rx, 0.09, 0.31, 0.10]); axb.axis("off"); axb.set_xlim(0, 1); axb.set_ylim(0, 1)
for i, (lab, col) in enumerate([("Claude", ACC), ("Embeddings", HEAD), ("Streamlit", GRN)]):
    x = i * 0.34
    axb.add_patch(FancyBboxPatch((x, 0.3), 0.31, 0.42, boxstyle="round,pad=0.02,rounding_size=0.12", facecolor=col))
    axb.text(x + 0.155, 0.51, lab, ha="center", va="center", color="white", fontsize=9.3, fontweight="bold")

fig.savefig(os.path.join(OUT, "1_rag_assistant.png"), dpi=120, facecolor="white")
plt.close(fig)
print("OK ->", OUT, "|", [f for f in os.listdir(OUT) if f.endswith(".png")])
