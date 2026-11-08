#!/usr/bin/env python3
"""Detent Machined Bold. Every glyph is built here from straight cuts and corner radii.

Run from the repo root: .venv/bin/python font/build.py
"""
import math
from collections import defaultdict
from pathlib import Path

from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

HERE = Path(__file__).resolve().parent
DIST = HERE / 'dist'
FAMILY = 'Detent Machined'
VERSION = '0.100'

UPM = 1000
CAP, XH, ASC, DSC = 700, 530, 740, -200
CV, CH = 128, 112  # capital stems: vertical, horizontal
LV, LH = 120, 104  # lowercase stems
FV, FH = 124, 108  # figures
RI = 34  # every inside corner: the radius a cutter leaves
RC = RI + (CV + CH) // 2  # outer bowl radius that keeps the stroke even around a corner
RL = RI + (LV + LH) // 2
RF = RI + (FV + FH) // 2
OS = 4  # overshoot for bowls
FIG = 600  # every figure has this advance, so numbers never jump
STEP = math.radians(3)
BIG = 4000


# ---------- geometry ----------

def unit(x, y):
    d = math.hypot(x, y)
    return (x / d, y / d)


def rpoly(pts):
    """A closed polygon. A point (x, y, r) gets a round corner of radius r; (x, y, 0, 'sharp') is never filleted."""
    out = []
    n = len(pts)
    for i, p in enumerate(pts):
        x, y = p[0], p[1]
        r = p[2] if len(p) > 2 else 0
        if r <= 0:
            out.append((x, y, None, len(p) > 3))
            continue
        u1 = unit(pts[i - 1][0] - x, pts[i - 1][1] - y)
        u2 = unit(pts[(i + 1) % n][0] - x, pts[(i + 1) % n][1] - y)
        phi = math.acos(max(-1, min(1, u1[0] * u2[0] + u1[1] * u2[1])))
        d = r / math.tan(phi / 2)
        t1 = (x + u1[0] * d, y + u1[1] * d)
        t2 = (x + u2[0] * d, y + u2[1] * d)
        b = unit(u1[0] + u2[0], u1[1] + u2[1])
        h = r / math.sin(phi / 2)
        c = (x + b[0] * h, y + b[1] * h)
        a1 = math.atan2(t1[1] - c[1], t1[0] - c[0])
        a2 = math.atan2(t2[1] - c[1], t2[0] - c[0])
        sweep = (a2 - a1 + math.pi) % (2 * math.pi) - math.pi
        k = max(2, math.ceil(abs(sweep) / STEP))
        arc = (round(c[0], 6), round(c[1], 6), r)
        for j in range(k):
            a = a1 + sweep * j / k
            q = t1 if j == 0 else (c[0] + r * math.cos(a), c[1] + r * math.sin(a))
            out.append((q[0], q[1], arc, False))
        out.append((t2[0], t2[1], None, False))
    return out


class Item:
    """Filled area of its contours (nonzero), minus its own local cuts."""

    def __init__(self, contours, subs=()):
        self.contours = contours
        self.subs = list(subs)

    def minus(self, *items):
        return Item(self.contours, self.subs + [it.contours for it in items])

    def tf(self, f):
        def one(c):
            out = []
            for x, y, arc, sharp in c:
                if arc:
                    cx, cy = f(arc[0], arc[1])
                    arc = (round(cx, 6), round(cy, 6), arc[2])
                out.append((*f(x, y), arc, sharp))
            return out

        return Item([one(c) for c in self.contours], [[one(c) for c in s] for s in self.subs])


def poly(pts):
    return Item([rpoly(pts)])


def rect(x0, y0, x1, y1, r=0):
    bl, br, tr, tl = r if isinstance(r, tuple) else (r,) * 4
    return poly([(x0, y0, bl), (x0, y1, tl), (x1, y1, tr), (x1, y0, br)])


def ring(x0, y0, x1, y1, sx, sy, ro, ri=RI):
    outer = rect(x0, y0, x1, y1, ro).contours[0]
    inner = rect(x0 + sx, y0 + sy, x1 - sx, y1 - sy, ri).contours[0][::-1]
    # each vertex carries the arc of the edge that leaves it, so after reversing, take it from the next vertex
    inner = [(x, y, inner[(i + 1) % len(inner)][2], sh) for i, (x, y, _, sh) in enumerate(inner)]
    return Item([outer, inner])


def mirror(items, w):
    return [it.tf(lambda x, y: (w - x, y)) for it in items]


def turn(items, w, h):
    return [it.tf(lambda x, y: (w - x, h - y)) for it in items]


def move(items, dx, dy=0):
    return [it.tf(lambda x, y: (x + dx, y + dy)) for it in items]


# lines are (point, direction)
def line(p, q):
    return (p, (q[0] - p[0], q[1] - p[1]))


def hl(y):
    return ((0.0, y), (1.0, 0.0))


def vl(x):
    return ((x, 0.0), (0.0, 1.0))


def meet(l1, l2):
    (p, r), (q, s) = l1, l2
    d = r[0] * s[1] - r[1] * s[0]
    t = ((q[0] - p[0]) * s[1] - (q[1] - p[1]) * s[0]) / d
    return (p[0] + t * r[0], p[1] + t * r[1])


def shift(l, t):
    """Move a line sideways by t, to the right of its direction."""
    p, r = l
    n = unit(r[1], -r[0])
    return ((p[0] + n[0] * t, p[1] + n[1] * t), r)


def quad(e1, e2, c1, c2):
    return poly([meet(e1, c1), meet(e2, c1), meet(e2, c2), meet(e1, c2)])


def hwidth(run, rise, t):
    return t * math.hypot(run, rise) / abs(rise)


def tick(x, y, w=24, d=46):
    """The index line of a knob: a narrow slot cut down from a top edge at (x, y). Its floor stays sharp."""
    return poly([(x - w / 2, y - d, 0, 'sharp'), (x - w / 2, y + 40), (x + w / 2, y + 40), (x + w / 2, y - d, 0, 'sharp')])


# ---------- boolean: union of items, minus cuts, then fillets ----------

def _key(p):
    return (round(p[0], 7), round(p[1], 7))


def _wind(contours, pt):
    x, y = pt
    w = 0
    for c in contours:
        n = len(c)
        for i in range(n):
            x0, y0 = c[i][0], c[i][1]
            x1, y1 = c[(i + 1) % n][0], c[(i + 1) % n][1]
            if y0 <= y < y1 or y1 <= y < y0:
                xi = x0 + (y - y0) * (x1 - x0) / (y1 - y0)
                if xi > x:
                    w += 1 if y1 > y0 else -1
    return w != 0


def _bbox(contours):
    xs = [p[0] for c in contours for p in c]
    ys = [p[1] for c in contours for p in c]
    return (min(xs), min(ys), max(xs), max(ys))


def outline(items, cuts):
    groups = [(it.contours, _bbox(it.contours), [(s, _bbox(s)) for s in it.subs]) for it in items]
    cutg = [(c.contours, _bbox(c.contours)) for c in cuts]

    def inb(b, p):
        return b[0] - 1 <= p[0] <= b[2] + 1 and b[1] - 1 <= p[1] <= b[3] + 1

    def inside(p):
        for cs, b, subs in groups:
            if inb(b, p) and _wind(cs, p) and not any(inb(sb, p) and _wind(s, p) for s, sb in subs):
                break
        else:
            return False
        return not any(inb(b, p) and _wind(cs, p) for cs, b in cutg)

    allc = [c for cs, _, subs in groups for c in cs + [x for s, _ in subs for x in s]] + [c for cs, _ in cutg for c in cs]
    edges, sharp = [], set()
    for c in allc:
        for i, a in enumerate(c):
            b = c[(i + 1) % len(c)]
            if a[3]:
                sharp.add(_key(a))
            if (a[0], a[1]) != (b[0], b[1]):
                edges.append(((a[0], a[1]), (b[0], b[1]), a[2]))
    boxes = [(min(a[0], b[0]), min(a[1], b[1]), max(a[0], b[0]), max(a[1], b[1])) for a, b, _ in edges]
    splits = [[] for _ in edges]
    E = 1e-9
    for i, (p, pb, _) in enumerate(edges):
        r = (pb[0] - p[0], pb[1] - p[1])
        rr = r[0] * r[0] + r[1] * r[1]
        bi = boxes[i]
        for j in range(i + 1, len(edges)):
            bj = boxes[j]
            if bj[0] > bi[2] + 1e-6 or bj[2] < bi[0] - 1e-6 or bj[1] > bi[3] + 1e-6 or bj[3] < bi[1] - 1e-6:
                continue
            q, qb, _ = edges[j]
            s = (qb[0] - q[0], qb[1] - q[1])
            ss = s[0] * s[0] + s[1] * s[1]
            d = r[0] * s[1] - r[1] * s[0]
            qp = (q[0] - p[0], q[1] - p[1])
            if abs(d) > 1e-9 * math.sqrt(rr * ss):
                t = (qp[0] * s[1] - qp[1] * s[0]) / d
                u = (qp[0] * r[1] - qp[1] * r[0]) / d
                if -E <= t <= 1 + E and -E <= u <= 1 + E:
                    if t <= 1e-7:
                        pt = p
                    elif t >= 1 - 1e-7:
                        pt = pb
                    elif u <= 1e-7:
                        pt = q
                    elif u >= 1 - 1e-7:
                        pt = qb
                    else:
                        pt = (p[0] + t * r[0], p[1] + t * r[1])
                    if 1e-7 < t < 1 - 1e-7:
                        splits[i].append((t, pt))
                    if 1e-7 < u < 1 - 1e-7:
                        splits[j].append((u, pt))
            elif abs(qp[0] * r[1] - qp[1] * r[0]) < 1e-6 * math.sqrt(rr):
                for pt in (q, qb):
                    t = ((pt[0] - p[0]) * r[0] + (pt[1] - p[1]) * r[1]) / rr
                    if 1e-7 < t < 1 - 1e-7:
                        splits[i].append((t, pt))
                for pt in (p, pb):
                    u = ((pt[0] - q[0]) * s[0] + (pt[1] - q[1]) * s[1]) / ss
                    if 1e-7 < u < 1 - 1e-7:
                        splits[j].append((u, pt))
    segs = {}
    for (a, b, arc), sp in zip(edges, splits):
        pts = [a] + [pt for _, pt in sorted(sp)] + [b]
        for p, q in zip(pts, pts[1:]):
            if math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-6:
                continue
            k = tuple(sorted((_key(p), _key(q))))
            if k not in segs:
                segs[k] = (p, q, arc)
    kept = []
    for p, q, arc in segs.values():
        m = ((p[0] + q[0]) / 2, (p[1] + q[1]) / 2)
        n = unit(-(q[1] - p[1]), q[0] - p[0])
        left = inside((m[0] + n[0] * 1e-4, m[1] + n[1] * 1e-4))
        right = inside((m[0] - n[0] * 1e-4, m[1] - n[1] * 1e-4))
        if left == right:
            continue
        kept.append((q, p, arc) if left else (p, q, arc))
    starts = defaultdict(list)
    for i, s in enumerate(kept):
        starts[_key(s[0])].append(i)
    used, loops = set(), []
    for i in range(len(kept)):
        if i in used:
            continue
        loop, cur = [], i
        while cur is not None and cur not in used:
            used.add(cur)
            loop.append(kept[cur])
            nxt = [j for j in starts[_key(kept[cur][1])] if j not in used]
            cur = nxt[0] if nxt else None
        if _key(loop[-1][1]) != _key(loop[0][0]):
            print('open contour', len(loop))
        loops.append(loop)
    out = []
    for loop in loops:
        v = [(s[0][0], s[0][1]) for s in loop]
        a = [s[2] for s in loop]
        v, a = _clean(v, a)
        if len(v) >= 3:
            out.append((v, a, [_key(p) in sharp for p in v]))
    return out


def _clean(v, a):
    changed = True
    while changed and len(v) > 3:
        changed = False
        n = len(v)
        for i in range(n):
            p, c, q = v[i - 1], v[i], v[(i + 1) % n]
            if math.hypot(c[0] - p[0], c[1] - p[1]) < 0.05:
                del v[i], a[i]
                changed = True
                break
            if a[i - 1] is None and a[i] is None:
                d1 = (c[0] - p[0], c[1] - p[1])
                d2 = (q[0] - c[0], q[1] - c[1])
                cr = d1[0] * d2[1] - d1[1] * d2[0]
                if abs(cr) < 1e-6 * math.hypot(*d1) * math.hypot(*d2) and d1[0] * d2[0] + d1[1] * d2[1] > 0:
                    del v[i], a[i]
                    changed = True
                    break
    return v, a


def draw(pen, contours, tool):
    for v, a, sharp in contours:
        n = len(v)
        trim = [None] * n  # fillet at vertex i: (t1, c1, c2, t2)
        for i in range(n):
            if a[i - 1] is not None or a[i] is not None or sharp[i]:
                continue
            p, c, q = v[i - 1], v[i], v[(i + 1) % n]
            din, dout = unit(c[0] - p[0], c[1] - p[1]), unit(q[0] - c[0], q[1] - c[1])
            cr = din[0] * dout[1] - din[1] * dout[0]
            if cr <= 1e-6:  # convex corners stay sharp, only inside corners get the cutter radius
                continue
            al = math.acos(max(-1, min(1, din[0] * dout[0] + din[1] * dout[1])))
            d = min(tool * math.tan(al / 2), 0.5 * math.hypot(c[0] - p[0], c[1] - p[1]), 0.5 * math.hypot(q[0] - c[0], q[1] - c[1]))
            r = d / math.tan(al / 2)
            k = 4 / 3 * math.tan(al / 4) * r
            t1 = (c[0] - din[0] * d, c[1] - din[1] * d)
            t2 = (c[0] + dout[0] * d, c[1] + dout[1] * d)
            trim[i] = (t1, (t1[0] + din[0] * k, t1[1] + din[1] * k), (t2[0] - dout[0] * k, t2[1] - dout[1] * k), t2)
        i0 = next(i for i in range(n) if a[i] is None or a[i] != a[i - 1])
        ops = []
        start = trim[i0][3] if trim[i0] else v[i0]
        i, done = i0, 0
        while done < n:
            j = (i + 1) % n
            if a[i] is None:
                if trim[j]:
                    ops.append(('L', trim[j][0]))
                    ops.append(('C', trim[j][1], trim[j][2], trim[j][3]))
                else:
                    ops.append(('L', v[j]))
                i, done = j, done + 1
                continue
            arc, m = a[i], i
            pts = [v[i]]
            while a[m] == arc and done < n:
                m = (m + 1) % n
                pts.append(v[m])
                done += 1
            ops += _arc(pts, arc)
            i = m
        pen.moveTo(start)
        for op in ops[:-1]:
            pen.lineTo(op[1]) if op[0] == 'L' else pen.curveTo(*op[1:])
        last = ops[-1]
        if last[0] == 'C':
            pen.curveTo(last[1], last[2], start)
        pen.closePath()


def _arc(pts, arc):
    cx, cy, R = arc
    ang = [math.atan2(p[1] - cy, p[0] - cx) for p in pts]
    sweep = sum((b - a + math.pi) % (2 * math.pi) - math.pi for a, b in zip(ang, ang[1:]))
    n = max(1, math.ceil(abs(sweep) / (math.pi / 2) - 1e-6))
    sg = 1 if sweep > 0 else -1
    ops = []
    for k in range(n):
        a0 = ang[0] + sweep * k / n
        a1 = ang[0] + sweep * (k + 1) / n
        p0 = pts[0] if k == 0 else (cx + R * math.cos(a0), cy + R * math.sin(a0))
        p3 = pts[-1] if k == n - 1 else (cx + R * math.cos(a1), cy + R * math.sin(a1))
        h = 4 / 3 * math.tan(abs(a1 - a0) / 4) * R
        c1 = (p0[0] - sg * math.sin(a0) * h, p0[1] + sg * math.cos(a0) * h)
        c2 = (p3[0] + sg * math.sin(a1) * h, p3[1] - sg * math.cos(a1) * h)
        ops.append(('C', c1, c2, p3))
    return ops


# ---------- glyphs ----------
# Each function returns (body width, items, cuts). Sidebearings are set in the table below.

G = {}


def glyph(ch, lsb, rsb, tool=RI):
    def deco(f):
        G[ch] = (f, lsb, rsb, tool)
        return f

    return deco


def hook_c(w, h, v, hh, r, top=True, bottom=True, y0=-OS):
    """A ring open on the right, with short stubs cut flat just past the corners."""
    y1 = y0 + h
    lo = y0 + r + 18 if bottom else y0 - 1
    hi = y1 - r - 18 if top else y1 + 1
    return ring(0, y0, w, y1, v, hh, r).minus(rect(w - v - RI - 1, lo, w + 1, hi))


def legs_a(w, t, h=CAP):
    hw = t
    for _ in range(6):
        hw = hwidth(w / 2 - hw / 2, h, t)
    run = w / 2 - hw / 2
    left = poly([(0, 0), (hw, 0), (run + hw, h), (run, h)])
    right = poly([(w, 0), (w - hw, 0), (w - run - hw, h), (w - run, h)])
    return left, right, hw, run


# capitals

@glyph('A', 16, 16)
def _():
    w = 680
    l, r, hw, run = legs_a(w, 124)
    yb, yt = 190, 190 + CH - 6
    x0 = yt / CAP * run + 6
    return w, [l, r, rect(x0, yb, w - x0, yt)], []


@glyph('B', 72, 52)
def _():
    w, ym = 560, 372
    return w, [rect(0, 0, CV, CAP), ring(0, ym - CH / 2, w - 34, CAP, CV, CH, (0, RC, RC, 0)), ring(0, 0, w, ym + CH / 2, CV, CH, (0, RC, RC, 0))], []


@glyph('C', 50, 44)
def _():
    return 590, [hook_c(590, CAP + 2 * OS, CV, CH, RC)], []


@glyph('D', 72, 50)
def _():
    return 600, [ring(0, 0, 600, CAP, CV, CH, (0, RC + 16, RC + 16, 0))], []


@glyph('E', 72, 46)
def _():
    w, ym = 500, 362
    return w, [rect(0, 0, CV, CAP), rect(0, CAP - CH, w, CAP), rect(0, ym - CH / 2, w - 44, ym + CH / 2), rect(0, 0, w, CH)], []


@glyph('F', 72, 40)
def _():
    w, ym = 490, 350
    return w, [rect(0, 0, CV, CAP), rect(0, CAP - CH, w, CAP), rect(0, ym - CH / 2, w - 50, ym + CH / 2)], []


@glyph('G', 50, 60)
def _():
    w, yb = 610, 352
    g = ring(0, -OS, w, CAP + OS, CV, CH, RC).minus(rect(w - CV - RI - 1, yb, w + 1, CAP + OS - RC - 18))
    return w, [g, rect(w * 0.47, yb - CH, w, yb)], []


@glyph('H', 72, 72)
def _():
    w, ym = 580, 362
    return w, [rect(0, 0, CV, CAP), rect(w - CV, 0, w, CAP), rect(0, ym - CH / 2, w, ym + CH / 2)], []


@glyph('I', 72, 72)
def _():
    return CV, [rect(0, 0, CV, CAP)], []


@glyph('J', 30, 72)
def _():
    w = 470
    j = ring(0, -OS, w, CAP + BIG, CV, CH, RC).minus(rect(-1, CAP, w + 1, CAP + BIG + 1), rect(-1, 236, CV + RI + 1, CAP + 1))
    return w, [j], []


@glyph('K', 72, 18)
def _():
    w, t = 600, 126
    er = line((CV, 236), (w, CAP))
    arm = quad(shift(er, -t), er, hl(CAP), vl(CV / 2))
    ac = shift(er, -t / 2)
    q = meet(ac, vl(CV + 0.36 * (w - CV)))
    lc = line((w - 70, 0), q)
    leg = quad(shift(lc, -t / 2), shift(lc, t / 2), hl(0), ac)
    return w, [rect(0, 0, CV, CAP), arm, leg], []


@glyph('L', 72, 30)
def _():
    w = 470
    return w, [rect(0, 0, CV, CAP), rect(0, 0, w, CH)], []


@glyph('M', 72, 72)
def _():
    w, t = 760, 116
    hw = t
    for _ in range(6):
        hw = hwidth(w / 2 - hw / 2, CAP, t)
    m = w / 2
    dl = poly([(0, CAP), (hw, CAP), (m + hw / 2, 0), (m - hw / 2, 0)])
    dr = poly([(w, CAP), (w - hw, CAP), (m - hw / 2, 0), (m + hw / 2, 0)])
    return w, [rect(0, 0, CV, CAP), rect(w - CV, 0, w, CAP), dl, dr], []


@glyph('N', 72, 72)
def _():
    w, t = 590, 120
    hw = t
    for _ in range(6):
        hw = hwidth(w - hw, CAP, t)
    return w, [rect(0, 0, CV, CAP), rect(w - CV, 0, w, CAP), poly([(0, CAP), (hw, CAP), (w, 0), (w - hw, 0)])], []


@glyph('O', 50, 50)
def _():
    return 640, [ring(0, -OS, 640, CAP + OS, CV, CH, RC)], []


@glyph('P', 72, 44)
def _():
    w = 560
    return w, [rect(0, 0, CV, CAP), ring(0, 286, w, CAP, CV, CH, (0, RC, RC, 0))], []


@glyph('Q', 50, 40)
def _():
    w = 640
    c = line((w - 210, CH / 2), (w - 70, -130))
    tail = quad(shift(c, -CH / 2), shift(c, CH / 2), hl(-130), hl(CH / 2))
    return w, [ring(0, -OS, w, CAP + OS, CV, CH, RC), tail], []


@glyph('R', 72, 22)
def _():
    w, yb, t = 570, 300, 124
    c = line((w - 66, 0), (w * 0.44, yb + CH / 2))
    leg = quad(shift(c, -t / 2), shift(c, t / 2), hl(0), hl(yb + CH / 2))
    return w, [rect(0, 0, CV, CAP), ring(0, yb, w - 10, CAP, CV, CH, (0, RC, RC, 0)), leg], []


@glyph('S', 46, 46)
def _():
    w, ym = 580, 364
    up = ring(14, ym - CH / 2, w - 14, CAP + OS, CV, CH, RC).minus(rect(w - RC, ym - CH / 2 - 1, w + 1, CAP + OS - RC - 18))
    lo = ring(0, -OS, w, ym + CH / 2, CV, CH, RC).minus(rect(-1, -OS + RC + 18, RC, ym + CH / 2 + 1))
    return w, [up, lo], []


@glyph('T', 20, 20)
def _():
    w = 610
    return w, [rect(0, CAP - CH, w, CAP), rect((w - CV) / 2, 0, (w + CV) / 2, CAP)], []


@glyph('U', 70, 70)
def _():
    w = 590
    return w, [ring(0, -OS, w, CAP + BIG, CV, CH, RC).minus(rect(-1, CAP, w + 1, CAP + BIG + 1))], []


@glyph('V', 14, 14)
def _():
    w = 670
    l, r, hw, run = legs_a(w, 124)
    return w, turn([l, r], w, CAP), []


@glyph('W', 14, 14)
def _():
    w, t = 940, 114
    b1, b2 = w * 0.27, w * 0.73

    def leg(xt, xb):
        hw = t
        for _ in range(6):
            hw = hwidth(xt - xb, CAP, t)
        return poly([(xb - hw / 2, 0), (xb + hw / 2, 0), (xt + hw / 2, CAP), (xt - hw / 2, CAP)]), hw

    l1, hw = leg(0, b1)
    l1 = leg(hw / 2, b1)[0]
    return w, [l1, leg(w / 2, b1)[0], leg(w / 2, b2)[0], leg(w - hw / 2, b2)[0]], []


@glyph('X', 18, 18)
def _():
    w, t = 640, 120
    hw = t
    for _ in range(6):
        hw = hwidth(w - hw, CAP, t)
    return w, [poly([(0, CAP), (hw, CAP), (w, 0), (w - hw, 0)]), poly([(w - hw, CAP), (w, CAP), (hw, 0), (0, 0)])], []


@glyph('Y', 14, 14)
def _():
    w, t, yj = 650, 122, 330
    m = w / 2
    el = line((0, CAP), (m - CV / 2, yj))
    er = line((w, CAP), (m + CV / 2, yj))
    al = quad(el, shift(el, -t), hl(CAP), vl(m))
    ar = quad(er, shift(er, t), hl(CAP), vl(m))
    return w, [al, ar, rect(m - CV / 2, 0, m + CV / 2, yj + 20)], []


@glyph('Z', 36, 36)
def _():
    w, t = 580, 122
    hw = t
    for _ in range(6):
        hw = hwidth(w - hw, CAP - 2 * CH, t)
    d = poly([(w - hw, CAP - CH), (w, CAP - CH), (hw, CH), (0, CH)])
    return w, [rect(0, CAP - CH, w, CAP), rect(0, 0, w, CH), d], []


# lowercase

def arch(x0, w, h=XH, tl=0):
    return ring(x0, -BIG, x0 + w, h, LV, LH, (0, 0, RL, tl)).minus(rect(x0 - 1, -BIG - 1, x0 + w + 1, 0))


@glyph('a', 40, 60)
def _():
    w, yt = 500, 316
    hood = poly([(26, XH + OS - LH), (26, XH + OS), (w, XH + OS, RL), (w, 0), (w - LV, 0), (w - LV, XH + OS - LH, RI)])
    bowl = ring(0, -OS, w, yt, LV, LH - 8, (RL, 0, 0, RL))
    return w, [hood, bowl], [tick(w * 0.56, XH + OS)]


@glyph('b', 62, 44)
def _():
    w = 530
    return w, [rect(0, 0, LV, ASC), ring(0, 0, w, XH + OS, LV, LH, (0, RL, RL, 0))], []


@glyph('c', 44, 34)
def _():
    return 500, [hook_c(500, XH + 2 * OS, LV, LH, RL)], []


@glyph('d', 44, 62)
def _():
    w = 530
    return w, mirror([rect(0, 0, LV, ASC), ring(0, 0, w, XH + OS, LV, LH, (0, RL, RL, 0))], w), []


@glyph('e', 44, 42)
def _():
    w, yb = 520, 206
    e = ring(0, -OS, w, XH + OS, LV, LH, RL).minus(rect(w - LV - RI - 1, LH - OS, w + 1, yb), rect(w - 96, -OS - 1, w + 1, yb))
    return w, [e, rect(LV - 1, yb, w, yb + LH - 6)], [tick(w / 2, XH + OS)]


@glyph('f', 20, 10)
def _():
    a, wh = 70, 340
    top = poly([(a, 0), (a, ASC + OS, RL), (a + wh, ASC + OS), (a + wh, ASC + OS - LH), (a + LV, ASC + OS - LH, RI), (a + LV, 0)])
    return a + wh, [top, rect(0, XH - LH, a + LV + 170, XH)], []


@glyph('g', 44, 62)
def _():
    w = 530
    tail = poly([(w - LV, XH), (w, XH), (w, DSC, RL), (30, DSC), (30, DSC + LH), (w - LV, DSC + LH, RI)])
    return w, [ring(0, 0, w, XH + OS, LV, LH, (RL, 0, 0, RL)), tail], []


@glyph('h', 62, 62)
def _():
    w = 520
    return w, [rect(0, 0, LV, ASC), arch(0, w)], []


@glyph('i', 62, 62)
def _():
    return LV, [rect(0, 0, LV, XH), rect(0, 622, LV, 622 + 118, 12)], []


@glyph('j', 10, 62)
def _():
    w = 230
    j = poly([(w - LV, XH), (w, XH), (w, DSC, RL), (0, DSC), (0, DSC + LH), (w - LV, DSC + LH, RI)])
    return w, [j, rect(w - LV, 622, w, 622 + 118, 12)], []


@glyph('k', 62, 16)
def _():
    w, t = 500, 118
    er = line((LV, 170), (w, XH))
    arm = quad(shift(er, -t), er, hl(XH), vl(LV / 2))
    ac = shift(er, -t / 2)
    q = meet(ac, vl(LV + 0.36 * (w - LV)))
    lc = line((w - 64, 0), q)
    leg = quad(shift(lc, -t / 2), shift(lc, t / 2), hl(0), ac)
    return w, [rect(0, 0, LV, ASC), arm, leg], []


@glyph('l', 62, 20)
def _():
    w = 250
    return w, [poly([(0, ASC), (0, 0, RL), (w, 0), (w, LH), (LV, LH, RI), (LV, ASC)])], []


@glyph('m', 62, 62)
def _():
    w = 820
    mid = (w - LV) / 2
    return w, [rect(0, 0, LV, XH), arch(0, mid + LV), arch(mid, w - mid)], []


@glyph('n', 62, 62)
def _():
    w = 520
    return w, [rect(0, 0, LV, XH), arch(0, w)], []


@glyph('o', 44, 44)
def _():
    return 530, [ring(0, -OS, 530, XH + OS, LV, LH, RL)], []


@glyph('p', 62, 44)
def _():
    w = 530
    return w, [rect(0, DSC, LV, XH), ring(0, 0, w, XH, LV, LH, (0, RL, RL, 0))], []


@glyph('q', 44, 62)
def _():
    w = 530
    return w, mirror([rect(0, DSC, LV, XH), ring(0, 0, w, XH, LV, LH, (0, RL, RL, 0))], w), []


@glyph('r', 62, 16)
def _():
    w = 340
    arm = ring(0, -BIG, w, XH + OS, LV, LH, (0, 0, RL, 0)).minus(rect(-1, -BIG - 1, w + 1, XH + OS - RL - 16))
    return w, [rect(0, 0, LV, XH), arm], []


@glyph('s', 40, 40)
def _():
    w, ym = 500, 268
    up = ring(12, ym - LH / 2, w - 12, XH + OS, LV, LH, RL).minus(rect(w - RL, ym - LH / 2 - 1, w + 1, XH + OS - RL - 16))
    lo = ring(0, -OS, w, ym + LH / 2, LV, LH, RL).minus(rect(-1, -OS + RL + 16, RL, ym + LH / 2 + 1))
    return w, [up, lo], []


@glyph('t', 20, 20)
def _():
    a, foot = 110, 120
    st = poly([(a, 660), (a, 0, RL), (a + LV + foot, 0), (a + LV + foot, LH), (a + LV, LH, RI), (a + LV, 660)])
    bar = rect(0, XH - LH, a + LV + 130, XH)
    return a + LV + 130, [st, bar], []


@glyph('u', 62, 62)
def _():
    w = 520
    return w, turn([rect(0, 0, LV, XH), arch(0, w)], w, XH), []


@glyph('v', 12, 12)
def _():
    w = 540
    l, r, hw, run = legs_a(w, 116, XH)
    return w, turn([l, r], w, XH), []


@glyph('w', 12, 12)
def _():
    w, t = 800, 108
    b1, b2 = w * 0.27, w * 0.73

    def leg(xt, xb):
        hw = t
        for _ in range(6):
            hw = hwidth(xt - xb, XH, t)
        return poly([(xb - hw / 2, 0), (xb + hw / 2, 0), (xt + hw / 2, XH), (xt - hw / 2, XH)]), hw

    hw = leg(0, b1)[1]
    return w, [leg(hw / 2, b1)[0], leg(w / 2, b1)[0], leg(w / 2, b2)[0], leg(w - hw / 2, b2)[0]], []


@glyph('x', 16, 16)
def _():
    w, t = 520, 114
    hw = t
    for _ in range(6):
        hw = hwidth(w - hw, XH, t)
    return w, [poly([(0, XH), (hw, XH), (w, 0), (w - hw, 0)]), poly([(w - hw, XH), (w, XH), (hw, 0), (0, 0)])], []


@glyph('y', 12, 12)
def _():
    w, t = 550, 116
    er = line((w, XH), (w * 0.3, DSC))
    el = shift(er, t)
    right = quad(el, er, hl(XH), hl(DSC))
    join = meet(el, hl(0))
    al = line((0, XH), (join[0] - 6, 0))
    left = quad(al, shift(al, -t), hl(XH), shift(er, t / 2))
    return w, [right, left], []


@glyph('z', 34, 34)
def _():
    w, t = 470, 116
    hw = t
    for _ in range(6):
        hw = hwidth(w - hw, XH - 2 * LH, t)
    d = poly([(w - hw, XH - LH), (w, XH - LH), (hw, LH), (0, LH)])
    return w, [rect(0, XH - LH, w, XH), rect(0, 0, w, LH), d], []


# figures: all on the same advance

def fig(ch, w):
    sb = (FIG - w) / 2

    def deco(f):
        G[ch] = (f, sb, sb, RI)
        return f

    return deco


@fig('0', 500)
def _():
    return 500, [ring(0, -OS, 500, CAP + OS, FV, FH, RF)], []


@fig('1', 440)
def _():
    w, xs = 440, 170
    e = line((xs, CAP), (xs - 150, CAP - 140))
    flag = quad(e, shift(e, -FH * 1.05), vl(xs - 150), vl(xs))
    return w, [rect(xs, 0, xs + FV, CAP), flag, rect(0, 0, w, FH)], []


@fig('2', 500)
def _():
    w, yd = 500, 420
    top = CAP + OS
    e1 = line((0, FH), (w - FV, yd))
    e2 = shift(e1, FH * 1.04)
    yr = meet(e2, vl(w))[1]
    hook = poly([(0, top - RF - 18), (0, top, RF), (w, top, RF), (w, yr), (w - FV, yr), (w - FV, top - FH, RI), (FV, top - FH, RI), (FV, top - RF - 18)])
    diag = poly([(0, FH), (w - FV, yd), (w, yr), meet(e2, hl(FH))])
    return w, [hook, diag, rect(0, 0, w, FH)], []


@fig('3', 490)
def _():
    w, ym, xm = 490, 380, 150
    up = ring(24, ym - FH / 2, w - 18, CAP + OS, FV, FH, RF).minus(rect(-1, ym - FH / 2 - 1, xm, CAP + OS - RF - 18))
    lo = ring(0, -OS, w, ym + FH / 2, FV, FH, RF).minus(rect(-1, -OS + RF + 18, xm, ym + FH / 2 + 1))
    return w, [up, lo], []


@fig('4', 520)
def _():
    w, xs, yb = 520, 340, 170
    e1 = line((0, yb + FH), (xs, CAP))
    e2 = shift(e1, FV * 0.96)
    diag = poly([(0, yb + FH), (xs, CAP), meet(e2, vl(xs)), meet(e2, hl(yb + FH))])
    return w, [rect(xs, 0, xs + FV, CAP), diag, rect(0, yb, w, yb + FH)], []


@fig('5', 490)
def _():
    w, yb = 490, 430
    bowl = ring(0, -OS, w, yb, FV, FH, (RF, RF, RF, 0)).minus(rect(-1, -OS + RF + 18, FV + RI + 1, yb - FH))
    return w, [bowl, rect(0, yb - FH, FV, CAP), rect(0, CAP - FH, w - 16, CAP)], []


@fig('6', 500)
def _():
    w, y6 = 500, 430
    c = ring(0, -OS, w, CAP + OS, FV, FH, RF).minus(rect(w - FV - RI - 1, y6 - RF, w + 1, CAP + OS - RF - 18))
    return w, [c, ring(0, -OS, w, y6, FV, FH, (RF, RF, RF, 0))], []


@fig('7', 490)
def _():
    w, t, xb = 490, 124, 120
    er = line((w, CAP - FH), (xb + 60, 0))
    el = shift(er, t)
    return w, [rect(0, CAP - FH, w, CAP), quad(el, er, hl(0), hl(CAP - FH))], [tick(w * 0.5, CAP)]


@fig('8', 510)
def _():
    w, ym = 510, 382
    return w, [ring(22, ym - FH / 2, w - 22, CAP + OS, FV, FH, RF), ring(0, -OS, w, ym + FH / 2, FV, FH, RF)], []


@fig('9', 500)
def _():
    w = 500
    f, _, _, _ = G['6']
    _, items, cuts = f()
    return w, turn(items, w, CAP), []


# punctuation and symbols

DOT = 128


def dot(x=0, y=0):
    return rect(x, y, x + DOT, y + DOT, 12)


@glyph(' ', 0, 0)
def _():
    return 250, [], []


@glyph('.', 56, 56)
def _():
    return DOT, [dot()], []


@glyph(',', 46, 56)
def _():
    tail = poly([(DOT - 58, 24), (DOT, 24), (DOT, 0), (36, -160), (-22, -160)])
    return DOT, [dot(), tail], []


@glyph(':', 56, 56)
def _():
    return DOT, [dot(), dot(0, XH - DOT)], []


@glyph(';', 46, 56)
def _():
    f, _, _, _ = G[',']
    _, items, _ = f()
    return DOT, items + [dot(0, XH - DOT)], []


@glyph('!', 60, 60)
def _():
    return DOT, [poly([(0, CAP), (DOT, CAP), (DOT - 16, 230), (16, 230)]), dot()], []


@glyph('?', 40, 40)
def _():
    w, yq, xc = 470, 300, 170
    top = CAP + OS
    hook = ring(0, yq, w, top, CV, CH, RC).minus(rect(-1, yq - 1, xc, top - RC - 18))
    return w, [hook, rect(xc, 230, xc + DOT, yq + CH), dot(xc, 0)], []


@glyph("'", 60, 60)
def _():
    return 112, [poly([(0, CAP), (112, CAP), (98, 450), (14, 450)])], []


@glyph('"', 60, 60)
def _():
    return 290, [poly([(0, CAP), (112, CAP), (98, 450), (14, 450)]), poly([(178, CAP), (290, CAP), (276, 450), (192, 450)])], []


@glyph('-', 44, 44)
def _():
    return 270, [rect(0, 265 - LH / 2, 270, 265 + LH / 2)], []


@glyph('(', 70, 20)
def _():
    w = 210
    return w, [ring(0, -150, w + BIG, 790, CV - 6, CH - 6, (180, 0, 0, 180)).minus(rect(w, -BIG, BIG * 3, BIG))], []


@glyph(')', 20, 70)
def _():
    w = 210
    f, _, _, _ = G['(']
    return w, mirror(f()[1], w), []


@glyph('[', 76, 20)
def _():
    w = 200
    return w, [ring(0, -150, w + BIG, 790, CV - 6, CH - 6, 0).minus(rect(w, -BIG, BIG * 3, BIG))], []


@glyph(']', 20, 76)
def _():
    w = 200
    return w, mirror(G['['][0]()[1], w), []


@glyph('{', 40, 20)
def _():
    w, a, m = 270, 70, 320
    body = ring(a, -150, a + BIG, 790, CV - 10, CH - 8, (96, 0, 0, 96)).minus(rect(w, -BIG, BIG * 3, BIG))
    return w, [body, rect(0, m - CH / 2 + 4, a + 20, m + CH / 2 - 4)], []


@glyph('}', 20, 40)
def _():
    w = 270
    return w, mirror(G['{'][0]()[1], w), []


@glyph('/', 10, 10)
def _():
    w, t = 420, 112
    e = line((0, -130), (w - hwidth(w, 920, t), 790))
    return w, [quad(e, shift(e, t), hl(-130), hl(790))], []


@glyph('&', 44, 20)
def _():
    w = 650
    up = ring(40, 392, 400, CAP + OS, CV - 8, CH - 6, 130)
    lo = ring(0, -OS, 500, 440, CV - 8, CH - 6, RC).minus(rect(210, 300, 600, 600), rect(500 - CV - RI, 250, 600, 600))
    e = line((150, 470), (w - 60, 0))
    leg = quad(shift(e, -62), shift(e, 62), hl(0), hl(470))
    return w, [up, lo, leg], []


@glyph('@', 40, 40)
def _():
    w, t = 820, 92
    y0, y1 = -150, 650
    outer = ring(0, y0, w, y1, t, t - 4, 190, RI).minus(rect(w - t - RI - 1, y0 + 160, w + 1, 150))
    inner = ring(250, 110, 560, 430, t, t - 4, (120, 0, 0, 120))
    stem = rect(560 - t, 110, 560, 430)
    foot = rect(560 - t, 110, w, 110 + t - 4)
    return w, [outer, inner, stem, foot], []


@glyph('#', 20, 20)
def _():
    w = 620
    bars = [rect(0, 190, w, 190 + CH - 8), rect(0, 450, w, 450 + CH - 8)]
    sl = []
    for x in (150, 380):
        e = line((x, 0), (x + 90, 680))
        sl.append(quad(e, shift(e, -CV + 14), hl(0), hl(680)))
    return w, bars + sl, []


@glyph('%', 30, 30)
def _():
    w, t = 720, 92
    a = ring(0, 360, 250, CAP, t, t - 4, 96)
    b = ring(w - 250, 0, w, 340, t, t - 4, 96)
    e = line((150, 0), (w - 150 - hwidth(w - 300, CAP, 108), CAP))
    return w, [a, b, quad(e, shift(e, 108), hl(0), hl(CAP))], []


@glyph('+', 40, 40)
def _():
    w, m = 500, 330
    return w, [rect(0, m - LH / 2, w, m + LH / 2), rect(w / 2 - LV / 2, m - w / 2, w / 2 + LV / 2, m + w / 2)], []


@glyph('=', 40, 40)
def _():
    w, m = 500, 330
    return w, [rect(0, m + 40, w, m + 40 + LH), rect(0, m - 40 - LH, w, m - 40)], []


@glyph('×', 50, 50)
def _():
    w, m, t = 400, 330, 112
    s = w / 2
    out = []
    for d in ((1, 1), (1, -1)):
        c = line((s - d[0] * s, m - d[1] * s), (s + d[0] * s, m + d[1] * s))
        n = unit(d[0], d[1])
        out.append(quad(shift(c, -t / 2), shift(c, t / 2), ((s - d[0] * s, m - d[1] * s), (-n[1], n[0])), ((s + d[0] * s, m + d[1] * s), (-n[1], n[0]))))
    return w, out, []


@glyph('_', 0, 0)
def _():
    return 540, [rect(0, -150, 540, -150 + LH)], []


@glyph('*', 30, 30)
def _():
    w, cy, s, t = 420, 520, 190, 100
    cx = w / 2
    out = []
    for deg in (90, 30, 150):
        a = math.radians(deg)
        d = (math.cos(a) * s, math.sin(a) * s)
        p0, p1 = (cx - d[0], cy - d[1]), (cx + d[0], cy + d[1])
        c = line(p0, p1)
        nrm = (-math.sin(a), math.cos(a))
        out.append(quad(shift(c, -t / 2), shift(c, t / 2), (p0, nrm), (p1, nrm)))
    return w, out, []


@glyph('<', 50, 60)
def _():
    w, m, t = 440, 330, 112
    up = line((0, m), (w, m + 250))
    lo = line((0, m), (w, m - 250))
    return w, [quad(shift(up, -t / 2), shift(up, t / 2), vl(0), vl(w)), quad(shift(lo, -t / 2), shift(lo, t / 2), vl(0), vl(w))], []


@glyph('>', 60, 50)
def _():
    w = 440
    return w, mirror(G['<'][0]()[1], w), []


NAMES = {
    ' ': 'space', '.': 'period', ',': 'comma', ':': 'colon', ';': 'semicolon', '!': 'exclam', '?': 'question',
    "'": 'quotesingle', '"': 'quotedbl', '-': 'hyphen', '(': 'parenleft', ')': 'parenright', '[': 'bracketleft',
    ']': 'bracketright', '{': 'braceleft', '}': 'braceright', '/': 'slash', '&': 'ampersand', '@': 'at',
    '#': 'numbersign', '%': 'percent', '+': 'plus', '=': 'equal', '×': 'multiply', '_': 'underscore',
    '*': 'asterisk', '<': 'less', '>': 'greater', '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four',
    '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine',
}


def name(ch):
    return NAMES.get(ch, ch)


# ---------- kerning ----------
# Pairs are measured from the outlines: the mean gap over the height both glyphs share is pulled toward
# the gap of two straight stems, then capped so nothing ever touches.

PAIRS = (
    'AT AV AW AY Av Aw Ay A\' A" FA F. F, Fa Fe Fo LT LV LW LY Ly L\' L" PA P. P, Pa Pe Po '
    'TA T. T, Ta Tc Te To Tr Ts Tu Tw Ty T- VA V. V, Va Ve Vo Vu V- WA W. W, Wa We Wo YA Y. Y, Ya Ye Yo Yu Y- '
    'KO Ko Ky RT RV RW RY r. r, ra v. v, w. w, y. y, f. f, k. ko "A \'A 7. 7, 1. '
    'av aw ay ev ew ey ov ow oy va ve vo wa we wo ya ye yo'
).split()


def profiles(contours):
    rows = {}
    for y in range(-250, 860, 10):
        xs = []
        for v, a, _ in contours:
            for i in range(len(v)):
                (x0, y0), (x1, y1) = v[i], v[(i + 1) % len(v)]
                if y0 <= y < y1 or y1 <= y < y0:
                    xs.append(x0 + (y - y0) * (x1 - x0) / (y1 - y0))
        if xs:
            rows[y] = (min(xs), max(xs))
    return rows


def kern_value(lg, rg):
    pl, adv_l = lg
    pr, _ = rg
    ys = [y for y in pl if y in pr]
    if not ys:
        return 0
    gaps = [adv_l - pl[y][1] + pr[y][0] for y in ys]
    mean = sum(min(g, 300) for g in gaps) / len(gaps)
    k = -(mean - 140) * 0.55
    k = max(k, 44 - min(gaps), -130)
    k = int(round(k / 5) * 5)
    return k if k <= -10 else 0


# ---------- font ----------

def build():
    DIST.mkdir(exist_ok=True)
    order = ['.notdef'] + [name(c) for c in G]
    glyphs, metrics, cmap, prof = {}, {}, {}, {}

    pen = TTGlyphPen(None)
    for c in [[(50, 0), (50, CAP), (450, CAP), (450, 0)], [(110, 60), (390, 60), (390, CAP - 60), (110, CAP - 60)]]:
        pen.moveTo(c[0])
        for p in c[1:]:
            pen.lineTo(p)
        pen.closePath()
    glyphs['.notdef'] = pen.glyph()
    metrics['.notdef'] = (500, 50)

    for ch, (f, lsb, rsb, tool) in G.items():
        w, items, cuts = f()
        items = move(items, lsb)
        cuts = move(cuts, lsb)
        contours = outline(items, cuts) if items else []
        pen = TTGlyphPen(None)
        draw(Cu2QuPen(pen, 0.5, reverse_direction=False), contours, tool)
        g = pen.glyph()
        nm = name(ch)
        glyphs[nm] = g
        adv = round(lsb + w + rsb)
        xmin = min((p[0] for p in g.coordinates), default=0)
        metrics[nm] = (adv, int(xmin))
        cmap[ord(ch)] = nm
        prof[ch] = (profiles(contours), adv)

    fea = ['languagesystem DFLT dflt;', 'languagesystem latn dflt;', 'feature kern {']
    for p in PAIRS:
        k = kern_value(prof[p[0]], prof[p[1]])
        if k:
            fea.append(f'  pos {name(p[0])} {name(p[1])} {k};')
    fea.append('} kern;')

    fb = FontBuilder(UPM, isTTF=True)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics(metrics)
    ys = [y for g in glyphs.values() if g.numberOfContours > 0 for _, y in g.coordinates]
    fb.setupHorizontalHeader(ascent=800, descent=-220, lineGap=0)
    year = '2026'
    fb.setupNameTable({
        'copyright': f'Copyright {year} hilmanhaikal',
        'familyName': FAMILY,
        'styleName': 'Bold',
        'uniqueFontIdentifier': f'{VERSION};hilmanhaikal;DetentMachined-Bold',
        'fullName': f'{FAMILY} Bold',
        'psName': 'DetentMachined-Bold',
        'version': f'Version {VERSION}',
        'manufacturer': 'hilmanhaikal',
        'designer': 'hilmanhaikal',
        'vendorURL': 'https://github.com/hilmanhaikal/detent',
        'licenseDescription': 'This Font Software is licensed under the SIL Open Font License, Version 1.1. This license is available with a FAQ at: https://openfontlicense.org',
        'licenseInfoURL': 'https://openfontlicense.org',
    })
    fb.setupOS2(
        version=4, usWeightClass=700, fsType=0, fsSelection=0x20 | 0x80, achVendID='HLMN',
        sTypoAscender=800, sTypoDescender=-220, sTypoLineGap=0,
        usWinAscent=max(ys) + 10, usWinDescent=-min(ys) + 10,
        sxHeight=XH, sCapHeight=CAP, ulUnicodeRange1=0b11, ulCodePageRange1=1,
    )
    fb.setupPost(underlinePosition=-130, underlineThickness=60)
    fb.updateHead(macStyle=1, fontRevision=float(VERSION))
    addOpenTypeFeaturesFromString(fb.font, '\n'.join(fea))
    ttf = DIST / 'DetentMachined-Bold.ttf'
    fb.save(ttf)
    font = TTFont(ttf)
    font.flavor = 'woff2'
    font.save(DIST / 'DetentMachined-Bold.woff2')
    print('\n'.join(fea[3:-1]))
    print(f'{len(order)} glyphs, {ttf.stat().st_size} bytes ttf, {(DIST / "DetentMachined-Bold.woff2").stat().st_size} bytes woff2')


if __name__ == '__main__':
    build()
