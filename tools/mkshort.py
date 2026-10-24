"""Build a silent 1080x1920 Short from a folder of slide PNGs (1080x1350, sorted by name).
Same recipe as the old mkvid.py: blurred backdrop, 2.5s cover, 3.5s per slide. Usage: python mkshort.py <slides-folder> [out.mp4]"""
import glob, os, subprocess, sys, tempfile
from PIL import Image, ImageFilter, ImageEnhance
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()


def frame(src, out):
    im = Image.open(src).convert("RGB")
    bg = im.resize((1536, 1920)).crop((228, 0, 1308, 1920)).filter(ImageFilter.GaussianBlur(30))
    bg = ImageEnhance.Brightness(bg).enhance(0.55)
    bg.paste(im.resize((1080, 1350)), (0, (1920 - 1350) // 2))
    bg.save(out, quality=92)


def main(folder, out):
    files = sorted(glob.glob(os.path.join(folder, "*.png")))
    if len(files) < 2:
        sys.exit(f"need 2+ png slides in {folder}")
    with tempfile.TemporaryDirectory() as tmp:
        frames = []
        for i, f in enumerate(files):
            o = os.path.join(tmp, f"f{i:02d}.jpg")
            frame(f, o)
            frames.append(o.replace("\\", "/"))
        durs = [2.5] + [3.5] * (len(frames) - 1)
        lst = os.path.join(tmp, "list.txt")
        with open(lst, "w") as fh:
            for p, d in zip(frames, durs):
                fh.write(f"file '{p}'\nduration {d}\n")
            fh.write(f"file '{frames[-1]}'\n")
        subprocess.run([FF, "-y", "-f", "concat", "-safe", "0", "-i", lst,
                        "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
                        "-vf", "fps=30,format=yuv420p", "-t", str(sum(durs)),
                        "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-c:a", "aac", "-b:a", "96k",
                        "-movflags", "+faststart", "-shortest", out], check=True, capture_output=True)
    print(out, sum(durs), "s", round(os.path.getsize(out) / 1e6, 1), "MB")


if __name__ == "__main__":
    folder = sys.argv[1]
    main(folder, sys.argv[2] if len(sys.argv) > 2 else os.path.join(folder, "short.mp4"))
