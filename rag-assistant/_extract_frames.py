import subprocess, re, os
import imageio_ffmpeg

ff = imageio_ffmpeg.get_ffmpeg_exe()
video = r"C:\Users\petra\OneDrive\Desktop\Video Project 2.mp4"
outdir = r"C:\Users\petra\rag-assistant\_frames"
os.makedirs(outdir, exist_ok=True)

p = subprocess.run([ff, "-i", video], capture_output=True, text=True)
info = p.stderr
m = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", info)
dur = (int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))) if m else None
print("Duration:", round(dur, 1) if dur else "?", "sec")

if dur:
    n = 3
    times = [dur * (i + 0.5) / n for i in range(n)]
    for i, t in enumerate(times, 1):
        out = os.path.join(outdir, f"clip_{i:02d}.png")
        subprocess.run([ff, "-y", "-ss", f"{t:.2f}", "-i", video,
                        "-frames:v", "1", out], capture_output=True)
        print(f"clip {i:02d}: t={t:5.1f}s")
