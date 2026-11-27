# Pico Analemma Planner: shows the analemma on a Waveshare 7.5 inch e-paper (800 x 480) and moves
# the sun's dot to today's date once a day.
#
# Copy these to the Pico (Thonny works well):
#   main.py           this file
#   analemma.bin      the picture, from the web page
#   analemma_data.py  the day-by-day points, from the web page
#   epd.py            Waveshare's MicroPython driver for the 7.5 inch panel, renamed to epd.py
#                     (from github.com/waveshareteam/Pico_ePaper_Code, folder "python")
#
# The Pico has no clock battery. On a Pico W, fill in your Wi-Fi below and it sets the date from the
# internet. On a plain Pico, set the date in Thonny before starting, or add a clock module.

import time
import framebuf
import analemma_data as A

WIFI_NAME = ""      # your Wi-Fi name, Pico W only (leave blank to skip)
WIFI_PASSWORD = ""

W, H = 800, 480
BLACK = 1 if A.ONE_IS_BLACK else 0
INK = BLACK if getattr(A, "DARK_ON_LIGHT", True) else 1 - BLACK  # colour of the dot and the text
PAPER = 1 - INK


def set_clock_from_internet():
    if not WIFI_NAME:
        return
    try:
        import network
        import ntptime
        w = network.WLAN(network.STA_IF)
        w.active(True)
        w.connect(WIFI_NAME, WIFI_PASSWORD)
        for _ in range(30):
            if w.isconnected():
                break
            time.sleep(1)
        if w.isconnected():
            ntptime.settime()  # sets the clock to UTC
        w.active(False)
    except Exception as e:
        print("No internet time:", e)


def local_now():
    return time.localtime(time.time() + int(A.UTC_OFFSET * 3600 if WIFI_NAME else 0))


def day_of_year(t):
    return t[7]


def open_panel():
    import epd
    cls = getattr(epd, "EPD_7in5", None)
    if cls is None:
        for name in dir(epd):
            if name.startswith("EPD_7in5"):
                cls = getattr(epd, name)
                break
    panel = cls()
    # use the driver's own 48,000-byte picture memory so there is only one copy
    buf = None
    for name in ("buffer_1Gray", "buffer_black", "buffer", "imageblack"):
        b = getattr(panel, name, None)
        if isinstance(b, bytearray) and len(b) == W * H // 8:
            buf = b
            break
    if buf is None:
        buf = bytearray(W * H // 8)
    return panel, buf


def show(panel, buf):
    if hasattr(panel, "display"):
        try:
            panel.display(buf)
            return
        except TypeError:
            panel.display()
            return
    panel.show()


# ---- the sun, same formulas as the web page ----
def sun_numbers(doy, year):
    from math import sin, cos, tan, asin, radians, degrees
    jd = _jd(year) + doy - 1 + 0.5 - A.UTC_OFFSET / 24
    T = (jd - 2451545) / 36525
    L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360
    M = 357.52911 + T * (35999.05029 - 0.0001537 * T)
    e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T)
    C = (sin(radians(M)) * (1.914602 - T * (0.004817 + 0.000014 * T))
         + sin(radians(2 * M)) * (0.019993 - 0.000101 * T) + sin(radians(3 * M)) * 0.000289)
    om = 125.04 - 1934.136 * T
    lam = L0 + C - 0.00569 - 0.00478 * sin(radians(om))
    eps = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60 + 0.00256 * cos(radians(om))
    decl = degrees(asin(sin(radians(eps)) * sin(radians(lam))))
    y = tan(radians(eps / 2)) ** 2
    eot = 4 * degrees(y * sin(radians(2 * L0)) - 2 * e * sin(radians(M))
                      + 4 * e * y * sin(radians(M)) * cos(radians(2 * L0))
                      - 0.5 * y * y * sin(radians(4 * L0)) - 1.25 * e * e * sin(radians(2 * M)))
    return decl, eot


def _jd(year):
    # Julian date at 0h UTC on January 1 of the year
    y = year - 1
    return 1721425.5 + 365 * y + y // 4 - y // 100 + y // 400


MONTHS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")


# ---- drawing ----
def disc(fb, x, y, r, c):
    for dy in range(-r, r + 1):
        dx = int((r * r - dy * dy) ** 0.5)
        fb.hline(x - dx, y + dy, 2 * dx + 1, c)


def big_text(fb, s, x, y, scale, turn):
    # draws text at x, y (top-left of the text as it will be read), made bigger and turned to match the panel
    tw = 8 * len(s)
    tmp = bytearray(tw)  # 8 rows high, 1 byte per row-column in MONO_VLSB
    t = framebuf.FrameBuffer(tmp, tw, 8, framebuf.MONO_VLSB)
    t.fill(0)
    t.text(s, 0, 0, 1)
    for ty in range(8):
        for tx in range(tw):
            if t.pixel(tx, ty):
                u, v = tx * scale, ty * scale
                if turn == 90:
                    px, py = x - v - scale + 1, y + u
                elif turn == 270:
                    px, py = x + v, y - u - scale + 1
                else:
                    px, py = x + u, y + v
                fb.fill_rect(px, py, scale, scale, INK)
    return tw * scale


def draw_today(fb, now):
    doy = day_of_year(now)
    pts = A.POINTS
    p = pts[min(doy, len(pts)) - 1]
    if p:
        x, y = p
        disc(fb, x, y, A.DOT_R + 3, PAPER)
        disc(fb, x, y, A.DOT_R, INK)
    if A.TODAY_BOX:
        bx, by, bw, bh = A.TODAY_BOX
        decl, eot = sun_numbers(doy, now[0])
        m = round(abs(eot))
        lines = [("%s %d" % (MONTHS[now[1] - 1], now[2]), 3),
                 ("Sundial %d min %s" % (m, "fast" if eot > 0 else "slow") if m else "Sundial on time", 2),
                 ("Sun %.1f deg %s" % (abs(decl), "N" if decl >= 0 else "S"), 2)]
        gap = 10
        if A.TEXT_TURN == 0:
            ty = by + 4
            for s, sc in lines:
                big_text(fb, s, bx, ty, sc, 0)
                ty += 8 * sc + gap
        elif A.TEXT_TURN == 90:   # reading top-to-bottom is right-to-left on the panel
            tx = bx + bw - 4
            for s, sc in lines:
                big_text(fb, s, tx, by, sc, 90)
                tx -= 8 * sc + gap
        else:
            tx = bx + 4
            for s, sc in lines:
                big_text(fb, s, tx, by + bh, sc, 270)
                tx += 8 * sc + gap


def refresh(now):
    panel, buf = open_panel()
    with open("analemma.bin", "rb") as f:
        f.readinto(buf)
    fb = framebuf.FrameBuffer(buf, W, H, framebuf.MONO_HLSB)
    draw_today(fb, now)
    show(panel, buf)
    if hasattr(panel, "sleep"):
        panel.sleep()  # the picture stays on the e-paper with the power off


def main():
    set_clock_from_internet()
    shown = None
    while True:
        now = local_now()
        if now[7] != shown:
            refresh(now)
            shown = now[7]
        time.sleep(30 * 60)
        if now[3] == 3:  # about 3 am: check the internet time again
            set_clock_from_internet()


main()
