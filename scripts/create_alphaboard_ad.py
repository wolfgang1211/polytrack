#!/usr/bin/env python3
"""Generate a modern AlphaBoard launch ad video using ffmpeg filters.

Output: public/alphaboard-launch-ad.mp4
"""
from __future__ import annotations

import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public"
BUILD_DIR = ROOT / ".video-build" / "alphaboard-ad"
BUILD_DIR.mkdir(parents=True, exist_ok=True)

LOGO_WORDMARK = ROOT / "public" / "alphaboard-logo-wordmark.png"
LOGO_MARK = ROOT / "public" / "alphaboard-logo-mark-purple-512.png"
SCREENSHOT = Path(os.environ.get(
    "ALPHABOARD_SCREENSHOT",
    r"C:\Users\wolfgang\AppData\Local\hermes\cache\screenshots\browser_screenshot_c7d22702831a4494804f0bb08ade9406.png",
))
OUTPUT = OUT_DIR / "alphaboard-launch-ad.mp4"
POSTER = OUT_DIR / "alphaboard-launch-ad-poster.png"

FONT_BOLD = "C\\:/Windows/Fonts/segoeuib.ttf"
FONT_SEMI = "C\\:/Windows/Fonts/seguisb.ttf"
FONT_REG = "C\\:/Windows/Fonts/segoeui.ttf"
FONT_MONO = "C\\:/Windows/Fonts/consolab.ttf"

W, H = 1080, 1920
FPS = 30


def esc_text(s: str) -> str:
    # Escape for ffmpeg drawtext text= in a single filter string.
    return s.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'").replace("%", "\\%")


def drawtext(text: str, x: str, y: str, size: int, color: str = "white", font: str = FONT_BOLD,
             alpha: str = "1", extra: str = "") -> str:
    return (
        "drawtext="
        f"fontfile='{font}':"
        f"text='{esc_text(text)}':"
        f"fontsize={size}:fontcolor={color}:alpha='{alpha}':"
        f"x={x}:y={y}"
        + (":" + extra if extra else "")
    )


def panel(x: int, y: int, w: int, h: int, color: str = "white@0.055", border: str = "0x8b5cf640") -> str:
    return (
        f"drawbox=x={x}:y={y}:w={w}:h={h}:color={color}:t=fill,"
        f"drawbox=x={x}:y={y}:w={w}:h={h}:color={border}:t=2"
    )


def make_scene(name: str, duration: float, filters: list[str], inputs: list[str] | None = None, maps: list[str] | None = None) -> Path:
    path = BUILD_DIR / f"{name}.mp4"
    input_args: list[str] = ["-f", "lavfi", "-i", f"color=c=0x030507:s={W}x{H}:r={FPS}:d={duration}"]
    if inputs:
        for inp in inputs:
            input_args += ["-i", inp]
    vf = ",".join(filters)
    cmd = ["ffmpeg", "-y", *input_args, "-filter_complex", vf]
    if maps:
        for m in maps:
            cmd += ["-map", m]
    cmd += ["-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", str(FPS), "-t", str(duration), str(path)]
    run(cmd)
    return path


def run(cmd: list[str]) -> None:
    print("RUN", " ".join(map(str, cmd[:10])), "...")
    proc = subprocess.run([str(c) for c in cmd], cwd=ROOT, text=True, capture_output=True)
    if proc.returncode:
        print(proc.stdout)
        print(proc.stderr)
        raise SystemExit(proc.returncode)


def main() -> None:
    for required in [LOGO_WORDMARK, LOGO_MARK, SCREENSHOT]:
        if not required.exists():
            raise FileNotFoundError(required)

    scenes: list[Path] = []

    # Scene 1: cinematic brand intro.
    s1_filters = [
        "geq=r='3+8*sin((X+T*80)/120)+12*exp(-((X-760-70*sin(T))^2+(Y-390-50*cos(T*0.8))^2)/160000)':g='5+5*sin((Y+T*60)/140)':b='7+35*exp(-((X-760)^2+(Y-420)^2)/150000)+16*exp(-((X-230)^2+(Y-1480)^2)/250000)'",
        "format=rgba",
        "drawgrid=width=90:height=90:thickness=1:color=0x8b5cf60f",
        "drawbox=x=0:y=0:w=1080:h=1920:color=black@0.18:t=fill",
        "drawbox=x=68:y=78:w=944:h=4:color=0x8b5cf6aa:t=fill",
        "drawbox=x=68:y=1838:w=944:h=2:color=0xffffff22:t=fill",
        drawtext("ALPHABOARD", "68", "150", 46, "0xc4b5fd", FONT_MONO, "if(lt(t,0.35),t/0.35,1)"),
        drawtext("LAUNCH FILM", "68", "214", 22, "0xffffff66", FONT_MONO, "if(lt(t,0.55),0,if(lt(t,0.9),(t-0.55)/0.35,1))"),
        drawtext("Real-time", "68", "700", 92, "white", FONT_BOLD, "if(lt(t,0.4),0,if(lt(t,0.9),(t-0.4)/0.5,1))"),
        drawtext("alpha", "68", "802", 118, "0xa855f7", FONT_BOLD, "if(lt(t,0.65),0,if(lt(t,1.15),(t-0.65)/0.5,1))"),
        drawtext("from the best", "68", "944", 76, "white", FONT_BOLD, "if(lt(t,1.0),0,if(lt(t,1.45),(t-1.0)/0.45,1))"),
        drawtext("Discover top Polymarket traders before the crowd.", "72", "1118", 34, "0xffffffb8", FONT_REG, "if(lt(t,1.45),0,if(lt(t,1.9),(t-1.45)/0.45,1))"),
        "drawbox=x=70:y=1260:w=16:h=16:color=0x22c55e:t=fill",
        drawtext("LIVE MARKET INTELLIGENCE", "104", "1244", 28, "0x86efac", FONT_MONO, "if(lt(t,1.8),0,if(lt(t,2.2),(t-1.8)/0.4,1))"),
    ]
    scenes.append(make_scene("01_intro", 3.0, s1_filters))

    # Scene 2: product dashboard reveal with local screenshot.
    s2_filters = [
        "[0:v]geq=r='3+10*exp(-((X-870)^2+(Y-250)^2)/190000)':g='5':b='7+48*exp(-((X-870)^2+(Y-250)^2)/190000)',format=rgba[bg]",
        "[1:v]scale=900:-1,crop=900:1520:0:0,format=rgba,colorchannelmixer=aa=0.98[shot]",
        "[bg][shot]overlay=x='90+16*sin(t*1.2)':y='250-28*t':enable='gte(t,0)'[a]",
        "[a]drawbox=x=64:y=210:w=952:h=1365:color=0x00000070:t=fill[b]",
        "[b]drawbox=x=64:y=210:w=952:h=1365:color=0x8b5cf677:t=3[c]",
        "[c]" + drawtext("One screen.", "72", "82", 58, "white", FONT_BOLD, "if(lt(t,0.2),0,if(lt(t,0.65),(t-0.2)/0.45,1))"),
        drawtext("Every signal that matters.", "72", "150", 43, "0xc4b5fd", FONT_SEMI, "if(lt(t,0.55),0,if(lt(t,1.0),(t-0.55)/0.45,1))"),
        "drawbox=x=82:y=1650:w=916:h=132:color=0x10091faa:t=fill",
        "drawbox=x=82:y=1650:w=916:h=132:color=0x8b5cf677:t=2",
        drawtext("Leaderboard  •  Wallets  •  Live Trades  •  Markets", "118", "1690", 35, "0xffffffdc", FONT_SEMI, "if(lt(t,1.25),0,if(lt(t,1.65),(t-1.25)/0.4,1))"),
        drawtext("Built for speed, clarity and edge.", "118", "1738", 25, "0xffffff7c", FONT_REG, "if(lt(t,1.55),0,if(lt(t,1.95),(t-1.55)/0.4,1))"),
    ]
    scenes.append(make_scene("02_dashboard", 3.5, s2_filters, [str(SCREENSHOT)]))

    # Scene 3: metrics / signal cards.
    s3 = [
        "geq=r='3+20*exp(-((X-300-140*sin(T))^2+(Y-360)^2)/210000)':g='5+9*exp(-((X-800)^2+(Y-1540)^2)/250000)':b='7+52*exp(-((X-310)^2+(Y-360)^2)/240000)',format=rgba",
        "drawgrid=width=72:height=72:thickness=1:color=0xffffff0a",
        drawtext("Follow the money", "72", "128", 64, "white", FONT_BOLD, "if(lt(t,0.1),0,if(lt(t,0.55),(t-0.1)/0.45,1))"),
        drawtext("not the noise.", "72", "202", 64, "0xa855f7", FONT_BOLD, "if(lt(t,0.45),0,if(lt(t,0.9),(t-0.45)/0.45,1))"),
        panel(72, 410, 430, 270), panel(578, 410, 430, 270), panel(72, 740, 936, 270), panel(72, 1070, 430, 270), panel(578, 1070, 430, 270),
        drawtext("SMART MONEY", "112", "456", 28, "0xffffff80", FONT_MONO, "if(lt(t,0.9),0,if(lt(t,1.15),(t-0.9)/0.25,1))"),
        drawtext("+$22.05M", "112", "512", 62, "0x34d399", FONT_BOLD, "if(lt(t,1.0),0,if(lt(t,1.35),(t-1.0)/0.35,1))"),
        drawtext("Top trader P&L", "112", "590", 26, "0xffffff70", FONT_REG, "if(lt(t,1.25),0,if(lt(t,1.55),(t-1.25)/0.3,1))"),
        drawtext("24H VOLUME", "618", "456", 28, "0xffffff80", FONT_MONO, "if(lt(t,1.15),0,if(lt(t,1.4),(t-1.15)/0.25,1))"),
        drawtext("$189M", "618", "512", 66, "0xc4b5fd", FONT_BOLD, "if(lt(t,1.25),0,if(lt(t,1.6),(t-1.25)/0.35,1))"),
        drawtext("Market momentum", "618", "590", 26, "0xffffff70", FONT_REG, "if(lt(t,1.5),0,if(lt(t,1.8),(t-1.5)/0.3,1))"),
        drawtext("LIVE ACTIVITY", "112", "790", 28, "0xffffff80", FONT_MONO, "if(lt(t,1.55),0,if(lt(t,1.85),(t-1.55)/0.3,1))"),
        "drawbox=x=116:y=862:w=760:h=16:color=0x22c55eaa:t=fill",
        "drawbox=x=116:y=915:w=620:h=16:color=0xef444477:t=fill",
        "drawbox=x=116:y=968:w=825:h=16:color=0x8b5cf6aa:t=fill",
        drawtext("Whale trades. Price moves. Hot bets.", "112", "1018", 28, "0xffffffcc", FONT_SEMI, "if(lt(t,1.9),0,if(lt(t,2.2),(t-1.9)/0.3,1))"),
        drawtext("WALLET CHECKER", "112", "1116", 27, "0xffffff80", FONT_MONO, "if(lt(t,2.15),0,if(lt(t,2.4),(t-2.15)/0.25,1))"),
        drawtext("P&L / Win rate", "112", "1174", 42, "white", FONT_BOLD, "if(lt(t,2.25),0,if(lt(t,2.55),(t-2.25)/0.3,1))"),
        drawtext("MARKET EXPLORER", "618", "1116", 27, "0xffffff80", FONT_MONO, "if(lt(t,2.4),0,if(lt(t,2.65),(t-2.4)/0.25,1))"),
        drawtext("190+ active", "618", "1174", 42, "white", FONT_BOLD, "if(lt(t,2.5),0,if(lt(t,2.8),(t-2.5)/0.3,1))"),
        drawtext("AlphaBoard turns Polymarket data into action.", "72", "1530", 38, "0xffffffd0", FONT_SEMI, "if(lt(t,2.75),0,if(lt(t,3.1),(t-2.75)/0.35,1))"),
    ]
    scenes.append(make_scene("03_signals", 4.0, s3))

    # Scene 4: final CTA with brand assets.
    s4_filters = [
        "[0:v]geq=r='3+18*exp(-((X-520)^2+(Y-610)^2)/260000)+6*exp(-((X-220)^2+(Y-1560)^2)/520000)':g='5+7*exp(-((X-520)^2+(Y-610)^2)/290000)':b='7+86*exp(-((X-540)^2+(Y-620)^2)/280000)+22*exp(-((X-220)^2+(Y-1560)^2)/520000)',format=rgba[bg]",
        "[1:v]scale=420:-1,format=rgba,colorchannelmixer=aa=0.88[mark]",
        "[2:v]scale=620:-1,format=rgba[word]",
        "[bg][mark]overlay=x=330:y='270+10*sin(t*1.8)'[a]",
        "[a][word]overlay=x=230:y=810[b]",
        "[b]drawbox=x=138:y=1125:w=804:h=96:color=0x8b5cf633:t=fill[c]",
        "[c]drawbox=x=138:y=1125:w=804:h=96:color=0x8b5cf6aa:t=2[d]",
        "[d]" + drawtext("Launch-ready Polymarket intelligence", "132", "1010", 44, "white", FONT_SEMI, "if(lt(t,0.35),0,if(lt(t,0.75),(t-0.35)/0.4,1))"),
        drawtext("alphaboard.xyz", "244", "1145", 44, "0xc4b5fd", FONT_BOLD, "if(lt(t,0.7),0,if(lt(t,1.05),(t-0.7)/0.35,1))"),
        drawtext("Discover. Track. Act.", "306", "1290", 38, "0xffffffc8", FONT_REG, "if(lt(t,1.1),0,if(lt(t,1.5),(t-1.1)/0.4,1))"),
        drawtext("Real-time analytics for traders who move early.", "176", "1360", 28, "0xffffffb8", FONT_REG, "if(lt(t,1.45),0,if(lt(t,1.85),(t-1.45)/0.4,1))"),
        "drawbox=x=68:y=1800:w=944:h=2:color=0xffffff22:t=fill",
        drawtext("Independent analytics tool. Not financial advice.", "194", "1832", 21, "0xffffff5f", FONT_REG, "if(lt(t,1.9),0,if(lt(t,2.25),(t-1.9)/0.35,1))"),
    ]
    scenes.append(make_scene("04_cta", 3.5, s4_filters, [str(LOGO_MARK), str(LOGO_WORDMARK)]))

    concat = BUILD_DIR / "concat.txt"
    concat.write_text("".join(f"file '{p.as_posix()}'\n" for p in scenes), encoding="utf-8")

    # Subtle synth pulse bed.
    audio = BUILD_DIR / "pulse.wav"
    audio_filter = (
        "sine=frequency=62:sample_rate=48000:duration=14,volume=0.10[a0];"
        "sine=frequency=124:sample_rate=48000:duration=14,volume=0.045[a1];"
        "anoisesrc=color=pink:sample_rate=48000:duration=14,volume=0.008[n];"
        "[a0][a1][n]amix=inputs=3,afade=t=in:st=0:d=0.4,afade=t=out:st=13.2:d=0.8[a]"
    )
    run(["ffmpeg", "-y", "-filter_complex", audio_filter, "-map", "[a]", str(audio)])

    run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat), "-i", str(audio),
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart", "-shortest", str(OUTPUT),
    ])
    run(["ffmpeg", "-y", "-ss", "12.0", "-i", str(OUTPUT), "-frames:v", "1", str(POSTER)])
    print(f"Wrote {OUTPUT}")
    print(f"Wrote {POSTER}")


if __name__ == "__main__":
    main()
