#!/usr/bin/env python3
"""MCFC plan takeoff: the computer measures, the agent only classifies.

Commands (run with python3 -I takeoff.py <cmd> ...):
  sheets    PDF                         list pages: sheet number, title, stated scales, page size, vector or scanned
  calibrate PDF --page N [--stated 1/4] fit pt-per-foot from the dimension strings on the sheet (robust line fit),
                                        compare with the stated scale and the page size; prints PASS/FAIL
  grid      PDF --page N --ptft X --clip x0,y0,x1,y1 [--step 5] [--out DIR]
                                        PRIMARY: render a region (display points) with a labelled feet grid
  area      --grid DIR/grid.json --poly "x,y x,y ..." [--poly ...] [--minus "x,y ..."] [--snap 0.75] [--name N]
                                        PRIMARY: corners read in feet off the grid, snapped to drawn line endpoints;
                                        prints SF, range, perimeter and writes a check image DIR/<name>.png
  faces     PDF --page N --ptft X [--widths 0.96,1.44] [--clip x0,y0,x1,y1] [--min-sf 15] [--out DIR]
                                        build closed regions from the wall linework, area each one in SF,
                                        list the text tags inside it, and write faces.json + overlay.png (numbered)
  measure   --faces DIR/faces.json --pick 3,5,7 [--minus 12] [--wall-pct 0]
                                        sum picked faces (minus deductions) -> SF, perimeter LF, low/high range
  poly      --ptft X --pts "x,y x,y ..." | --feet "w*l + w*l - w*l"
                                        manual fallback: a polygon in PDF points, or rectangles from written dimensions
  doors     PDF --page N --ptft X       door-swing arcs on the sheet -> implied leaf widths (third check vs door schedule)

All lengths are reported in feet, areas in SF. Coordinates are unrotated PDF points (what PyMuPDF returns).
Requires: pymupdf, shapely (pip install pymupdf shapely --break-system-packages).
"""
import argparse, json, math, os, re, statistics, sys

import pymupdf as fitz
from shapely.geometry import LineString, Polygon, Point
from shapely.ops import polygonize, unary_union

DIM_RE = re.compile(r"^(\d{1,3})'\s*-?\s*(\d{1,2})?(?:\s*(\d)/(\d))?\"?$")
SCALE_RE = re.compile(r"(\d+(?:/\d+)?)\s*\"\s*=\s*1'\s*-?\s*0")


def frac(s):
    if "/" in s:
        a, b = s.split("/"); return float(a) / float(b)
    return float(s)


def ft_of(txt):
    m = DIM_RE.match(txt.strip())
    if not m:
        return None
    f = int(m.group(1)) + int(m.group(2) or 0) / 12
    if m.group(3):
        f += int(m.group(3)) / int(m.group(4)) / 12
    return f


def segments(page, widths=None, min_len=3.0):
    out = []
    for g in page.get_drawings():
        w = round(g.get("width") or 0, 2)
        if widths and w not in widths:
            continue
        for it in g["items"]:
            if it[0] == "l":
                a, b = it[1], it[2]
                if math.hypot(b.x - a.x, b.y - a.y) >= min_len:
                    out.append((a.x, a.y, b.x, b.y, w))
            elif it[0] == "re":
                r = it[1]
                for (x0, y0, x1, y1) in ((r.x0, r.y0, r.x1, r.y0), (r.x1, r.y0, r.x1, r.y1),
                                         (r.x1, r.y1, r.x0, r.y1), (r.x0, r.y1, r.x0, r.y0)):
                    out.append((x0, y0, x1, y1, w))
            elif it[0] == "qu":
                q = it[1]; pts = [q.ul, q.ur, q.lr, q.ll, q.ul]
                for a, b in zip(pts, pts[1:]):
                    out.append((a.x, a.y, b.x, b.y, w))
    return out


# ---------------------------------------------------------------- sheets
def cmd_sheets(a):
    d = fitz.open(a.pdf)
    for i, p in enumerate(d):
        t = p.get_text()
        nums = []      # sheet number = the sheet-number-shaped text in the largest font on the page
        for b in p.get_text("dict")["blocks"]:
            for l in b.get("lines", []):
                for sp_ in l["spans"]:
                    if re.fullmatch(r"[A-Z]{1,2}-?\d{3}(?:\.\d)?", sp_["text"].strip()):
                        nums.append((sp_["size"], sp_["text"].strip()))
        nums = [max(nums)[1]] if nums else []
        scales = sorted(set(m.group(0) for m in SCALE_RE.finditer(t.replace("’", "'").replace("”", '"'))))
        title = next((l.strip() for l in t.splitlines() if "PLAN" in l.upper() and len(l) < 60), "")
        w_in, h_in = p.mediabox.width / 72, p.mediabox.height / 72
        kind = "vector" if len(p.get_drawings()) > 200 and len(t) > 200 else "SCANNED? (use raster fallback)"
        print(f"p{i:>3}  sheet={nums[-1] if nums else '?':<8} size={w_in:.0f}x{h_in:.0f}in  {kind:<10} "
              f"scales={scales[:3]}  {title[:50]}")


# ---------------------------------------------------------------- calibrate
def dim_pairs(page):
    segs = [s for s in segments(page) if math.hypot(s[2] - s[0], s[3] - s[1]) >= 15]
    pairs = []
    for w in page.get_text("words"):
        F = ft_of(w[4])
        if not F or F < 2:
            continue
        cx, cy = (w[0] + w[2]) / 2, (w[1] + w[3]) / 2
        cands = []
        for x0, y0, x1, y1, _ in segs:
            if abs(y1 - y0) < 0.5 and min(x0, x1) - 2 <= cx <= max(x0, x1) + 2 and abs(y0 - cy) < 14:
                cands.append(abs(x1 - x0))
            elif abs(x1 - x0) < 0.5 and min(y0, y1) - 2 <= cy <= max(y0, y1) + 2 and abs(x0 - cx) < 14:
                cands.append(abs(y1 - y0))
        if cands:
            # the dimension line is the candidate closest to a plausible scale; keep the shortest that is >= F*4pt
            c = [x for x in cands if x >= F * 4] or cands
            pairs.append((F, min(c), w[4]))
    return pairs


def robust_fit(pairs, tol=0.03):
    """L = s*F + k  (k = constant overshoot of dimension lines past the ticks).
    RANSAC over every pair of dimensions: keep the line with the most inliers (reads within 3%), then least-squares on them."""
    best = []
    for i in range(len(pairs)):
        for j in range(i + 1, len(pairs)):
            (F1, L1, _), (F2, L2, _) = pairs[i], pairs[j]
            if abs(F1 - F2) < 1:
                continue
            s = (L2 - L1) / (F2 - F1); k = L1 - s * F1
            if s <= 0:
                continue
            inl = [p for p in pairs if abs((p[1] - k) / s - p[0]) <= max(tol * p[0], 0.2)]
            if len(inl) > len(best):
                best = inl
    if len(best) < 2:
        return None, None, best
    n = len(best); mx = sum(p[0] for p in best) / n; my = sum(p[1] for p in best) / n
    sxx = sum((p[0] - mx) ** 2 for p in best)
    s = sum((p[0] - mx) * (p[1] - my) for p in best) / sxx
    return s, my - s * mx, best


def cmd_calibrate(a):
    d = fitz.open(a.pdf); p = d[a.page]
    pairs = dim_pairs(p)
    s, k, used = robust_fit(pairs)
    t = p.get_text().replace("’", "'").replace("”", '"')
    stated = [frac(m.group(1)) for m in SCALE_RE.finditer(t)]
    st = frac(a.stated) if a.stated else (statistics.mode(stated) if stated else None)
    exp = st * 72 if st else None
    print(f"page {a.page}: {p.mediabox.width/72:.0f}x{p.mediabox.height/72:.0f} in "
          f"(ARCH D 24x36 / ARCH E1 30x42 are normal; 11x17 or 8.5x11 means shrunk -> stated scale is WRONG)")
    print(f"dimension strings found: {len(pairs)}, used in fit: {len(used)}")
    for F, L, txt in sorted(used, key=lambda x: -x[0]):
        print(f"   {txt:>8}  {F:6.2f} ft  line {L:7.1f} pt" + (f"  -> reads {(L-k)/s:6.2f} ft" if s else ""))
    if s is None:
        print("FAIL: could not fit a scale from dimension strings. Use poly --feet with written dimensions, "
              "or calibrate by hand on two long written dimensions."); sys.exit(2)
    print(f"fitted: {s:.3f} pt/ft (overshoot {k:.1f} pt)" + (f"; stated {a.stated or st}\" = 1'-0\" -> {exp:.3f} pt/ft" if exp else ""))
    if exp:
        err = (s - exp) / exp * 100
        verdict = "PASS" if abs(err) <= 2 and len(used) >= 3 else "FAIL"
        print(f"{verdict}: fitted vs stated {err:+.1f}%  (pass = within 2% on >= 3 dimensions)")
        print(f"use --ptft {exp:.3f}" if verdict == "PASS" else f"use --ptft {s:.3f} and flag the scale mismatch")
    json.dump({"page": a.page, "ptft_fit": s, "overshoot_pt": k, "ptft_stated": exp, "n_dims": len(used)},
              open(os.path.join(a.out, "calibration.json"), "w"), indent=1)


# ---------------------------------------------------------------- faces
def cmd_faces(a):
    d = fitz.open(a.pdf); p = d[a.page]
    widths = set(float(x) for x in a.widths.split(",")) if a.widths else None
    if widths is None:
        # default: the heaviest stroke widths that carry walls (top widths by total length, excluding hairlines)
        tot = {}
        for x0, y0, x1, y1, w in segments(p):
            tot[w] = tot.get(w, 0) + math.hypot(x1 - x0, y1 - y0)
        widths = set(w for w in tot if w >= 0.9)
        print(f"auto widths (>=0.9 pt): {sorted(widths)}   all widths by length: "
              f"{sorted(((round(v), w) for w, v in tot.items()), reverse=True)[:8]}")
    clip = [float(x) for x in a.clip.split(",")] if a.clip else None     # display points, same as grid
    R = (fitz.Rect(*clip) * ~p.rotation_matrix) if clip else None          # -> unrotated, to filter segments
    lines = []
    for x0, y0, x1, y1, w in segments(p, widths):
        if R is not None and not (R.contains(fitz.Point(x0, y0)) and R.contains(fitz.Point(x1, y1))):
            continue
        lines.append(LineString([(x0, y0), (x1, y1)]))
    faces = [f for f in polygonize(unary_union(lines)) if f.area / a.ptft ** 2 >= a.min_sf]
    page_area = p.mediabox.width * p.mediabox.height
    faces = [f for f in faces if f.area < 0.5 * page_area]       # drop the sheet border / title block frame
    faces.sort(key=lambda f: (round(f.centroid.y / 50), f.centroid.x))
    words = p.get_text("words")
    out = []
    for i, f in enumerate(faces, 1):
        tags = [w[4] for w in words if f.contains(Point((w[0] + w[2]) / 2, (w[1] + w[3]) / 2))]
        out.append({"id": i, "sf": round(f.area / a.ptft ** 2, 1), "perim_lf": round(f.length / a.ptft, 1),
                    "tags": " ".join(tags)[:120], "wkt": f.wkt})
        print(f"#{i:>3}  {out[-1]['sf']:>8.1f} SF  {out[-1]['perim_lf']:>6.1f} LF  {out[-1]['tags'][:80]}")
    os.makedirs(a.out, exist_ok=True)
    json.dump({"pdf": a.pdf, "page": a.page, "ptft": a.ptft, "widths": sorted(widths), "faces": out},
              open(os.path.join(a.out, "faces.json"), "w"), indent=1)
    # overlay: draw each face in display (rotated) space, numbered
    shp = p.new_shape(); m = p.rotation_matrix
    for i, f in enumerate(faces, 1):
        pts = [fitz.Point(x, y) for x, y in f.exterior.coords]
        shp.draw_polyline(pts)
        hue = (i * 0.37) % 1
        shp.finish(color=(0.8, 0, 0), fill=(hue, 1 - hue, 0.6), fill_opacity=0.28, width=1.2)
        c = f.representative_point()
        shp.insert_text(fitz.Point(c.x, c.y), str(i), fontsize=22, color=(0, 0, 0.8), rotate=p.rotation)
    shp.commit()
    rect = fitz.Rect(*clip) if clip else None
    p.get_pixmap(dpi=a.dpi, clip=rect).save(os.path.join(a.out, "overlay.png"))
    print(f"wrote {a.out}/faces.json and overlay.png ({len(out)} faces >= {a.min_sf} SF)")



# ---------------------------------------------------------------- grid + area (primary method)
def display_vertices(page):
    """All line endpoints in DISPLAY space (what you see on screen), for snapping."""
    m = page.rotation_matrix; pts = []
    for x0, y0, x1, y1, _ in segments(page, min_len=2.0):
        a_ = fitz.Point(x0, y0) * m; b_ = fitz.Point(x1, y1) * m
        pts.append((a_.x, a_.y)); pts.append((b_.x, b_.y))
    return pts


def cmd_grid(a):
    """Render a region with a labelled feet grid. Read corners off it in FEET (x right, y down from the origin)."""
    d = fitz.open(a.pdf); p = d[a.page]
    x0, y0, x1, y1 = [float(v) for v in a.clip.split(",")] if a.clip else (0, 0, p.rect.width, p.rect.height)
    # clip is in display points; --clip-ft lets you give it in feet relative to the page's top-left instead
    step = a.step * a.ptft
    shp = p.new_shape(); inv = ~p.rotation_matrix
    def D(x, y):           # display -> unrotated (what draw_* expects)
        return fitz.Point(x, y) * inv
    gx = x0; i = 0
    while gx <= x1 + 0.1:
        shp.draw_line(D(gx, y0), D(gx, y1)); i += 1; gx += step
    gy = y0
    while gy <= y1 + 0.1:
        shp.draw_line(D(x0, gy), D(x1, gy)); gy += step
    shp.finish(color=(0, 0.45, 1), width=0.5, stroke_opacity=0.55)
    gx = x0
    while gx <= x1 + 0.1:
        shp.insert_text(D(gx + 2, y0 + 10), f"{(gx - x0) / a.ptft:g}", fontsize=9, color=(0, 0.3, 0.9), rotate=p.rotation)
        gx += step
    gy = y0
    while gy <= y1 + 0.1:
        shp.insert_text(D(x0 + 2, gy - 2), f"{(gy - y0) / a.ptft:g}", fontsize=9, color=(0, 0.3, 0.9), rotate=p.rotation)
        gy += step
    shp.commit()
    os.makedirs(a.out, exist_ok=True)
    p.get_pixmap(dpi=a.dpi, clip=fitz.Rect(x0, y0, x1, y1)).save(os.path.join(a.out, "grid.png"))
    json.dump({"pdf": a.pdf, "page": a.page, "ptft": a.ptft, "origin": [x0, y0], "clip": [x0, y0, x1, y1], "step_ft": a.step},
              open(os.path.join(a.out, "grid.json"), "w"), indent=1)
    print(f"wrote {a.out}/grid.png: {(x1-x0)/a.ptft:.0f} x {(y1-y0)/a.ptft:.0f} ft, grid every {a.step:g} ft. "
          f"Read polygon corners in feet, then run: area --grid {a.out}/grid.json --poly \"x,y x,y ...\"")


def cmd_area(a):
    g = json.load(open(a.grid)); d = fitz.open(g["pdf"]); p = d[g["page"]]
    ptft, (ox, oy) = g["ptft"], g["origin"]
    verts = display_vertices(p)
    def snap(fx, fy):
        X, Y = ox + fx * ptft, oy + fy * ptft
        best, bd = (X, Y), a.snap * ptft
        for vx, vy in verts:
            dd = math.hypot(vx - X, vy - Y)
            if dd < bd:
                best, bd = (vx, vy), dd
        return best, (bd if best != (X, Y) else None)
    polys = []; report = []
    for sign, spec in [(1, s) for s in a.poly] + [(-1, s) for s in (a.minus or [])]:
        raw = [tuple(map(float, q.split(","))) for q in spec.split()]
        sn = [snap(*r) for r in raw]
        pts = [s_[0] for s_ in sn]
        moved = [round(s_[1] / ptft, 2) if s_[1] is not None else None for s_ in sn]
        poly = Polygon(pts)
        if not poly.is_valid:
            poly = poly.buffer(0)
        polys.append((sign, poly))
        report.append({"sign": "+" if sign > 0 else "-", "sf": round(poly.area / ptft ** 2, 1),
                       "perim_lf": round(poly.length / ptft, 1), "unsnapped_corners": moved.count(None),
                       "snap_moves_ft": moved})
    plus = unary_union([q for s_, q in polys if s_ > 0])
    minus = unary_union([q for s_, q in polys if s_ < 0]) if any(s_ < 0 for s_, _ in polys) else None
    geom = plus.difference(minus) if minus is not None else plus
    sf = geom.area / ptft ** 2; lf = geom.length / ptft
    band = lf * 0.375 / 2 + sf * 0.02
    # check overlay
    shp = p.new_shape(); inv = ~p.rotation_matrix
    for s_, q in polys:
        geoms = q.geoms if hasattr(q, "geoms") else [q]
        for gg in geoms:
            shp.draw_polyline([fitz.Point(x, y) * inv for x, y in gg.exterior.coords])
            shp.finish(color=(0.85, 0, 0) if s_ > 0 else (0, 0, 0), fill=(1, 0.85, 0) if s_ > 0 else (0.6, 0.6, 0.6),
                       fill_opacity=0.35, width=1.5)
    shp.commit()
    out = os.path.join(os.path.dirname(a.grid), (a.name or "area") + ".png")
    p.get_pixmap(dpi=a.dpi, clip=fitz.Rect(*g["clip"])).save(out)
    res = {"name": a.name, "sf": round(sf), "sf_low": round(sf - band), "sf_high": round(sf + band),
           "perimeter_lf": round(lf), "parts": report, "check_image": out}
    print(json.dumps(res, indent=1))
    with open(os.path.join(os.path.dirname(a.grid), "areas.jsonl"), "a") as fh:
        fh.write(json.dumps(res) + "\n")


# ---------------------------------------------------------------- measure
def parse_ids(s):
    ids = []
    for part in (s or "").split(","):
        part = part.strip()
        if "-" in part:
            x, y = part.split("-"); ids += list(range(int(x), int(y) + 1))
        elif part:
            ids.append(int(part))
    return ids


def cmd_measure(a):
    from shapely import wkt
    data = json.load(open(a.faces))
    by = {f["id"]: f for f in data["faces"]}
    pick, minus = parse_ids(a.pick), parse_ids(a.minus)
    geom = unary_union([wkt.loads(by[i]["wkt"]) for i in pick])
    if minus:
        geom = geom.difference(unary_union([wkt.loads(by[i]["wkt"]) for i in minus]))
    sf = geom.area / data["ptft"] ** 2
    lf = geom.length / data["ptft"]
    # range: +/- half a wall (4.5 in) on the perimeter, plus the calibration tolerance (2%)
    band = lf * 0.375 / 2 + sf * 0.02
    print(json.dumps({"picked": pick, "minus": minus, "sf": round(sf), "perimeter_lf": round(lf),
                      "sf_low": round(sf - band), "sf_high": round(sf + band)}, indent=1))


# ---------------------------------------------------------------- poly / feet
def cmd_poly(a):
    if a.feet:
        expr = a.feet.replace("x", "*")
        if not re.fullmatch(r"[\d\.\s\*\+\-\(\)]+", expr):
            sys.exit("--feet accepts numbers, * + - ( ) only, e.g. '34.5*28.92 - 6*8'")
        print(json.dumps({"sf": round(eval(expr), 1), "method": "written dimensions"}))
        return
    pts = [tuple(map(float, q.split(","))) for q in a.pts.split()]
    g = Polygon(pts)
    print(json.dumps({"sf": round(g.area / a.ptft ** 2, 1), "perimeter_lf": round(g.length / a.ptft, 1),
                      "valid": g.is_valid}))


# ---------------------------------------------------------------- doors
def cmd_doors(a):
    d = fitz.open(a.pdf); p = d[a.page]
    radii = []
    for g in p.get_drawings():
        for it in g["items"]:
            if it[0] == "c":                      # bezier: door swings are arcs
                p0, p1, p2, p3 = it[1], it[2], it[3], it[4]
                # point at t=0.5, then the circle through start, middle, end
                mx = (p0.x + 3 * p1.x + 3 * p2.x + p3.x) / 8; my = (p0.y + 3 * p1.y + 3 * p2.y + p3.y) / 8
                ax, ay, bx, by, cx, cy = p0.x, p0.y, mx, my, p3.x, p3.y
                dd = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
                if abs(dd) < 1e-6:
                    continue
                ux = ((ax*ax+ay*ay)*(by-cy)+(bx*bx+by*by)*(cy-ay)+(cx*cx+cy*cy)*(ay-by))/dd
                uy = ((ax*ax+ay*ay)*(cx-bx)+(bx*bx+by*by)*(ax-cx)+(cx*cx+cy*cy)*(bx-ax))/dd
                r = math.hypot(ax - ux, ay - uy)
                if 1.5 * a.ptft <= r <= 4.5 * a.ptft:
                    radii.append(round(r / a.ptft * 12))      # inches
    if not radii:
        print("no door arcs found"); return
    from collections import Counter
    print("door leaf widths implied by swing arcs (inches: count):",
          dict(sorted(Counter(radii).items())))
    print("compare with the door schedule; most commercial leaves are 36 in. A cluster at 36 = scale OK.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd", required=True)
    s = sp.add_parser("sheets"); s.add_argument("pdf"); s.set_defaults(fn=cmd_sheets)
    s = sp.add_parser("calibrate"); s.add_argument("pdf"); s.add_argument("--page", type=int, required=True)
    s.add_argument("--stated"); s.add_argument("--out", default="."); s.set_defaults(fn=cmd_calibrate)
    s = sp.add_parser("faces"); s.add_argument("pdf"); s.add_argument("--page", type=int, required=True)
    s.add_argument("--ptft", type=float, required=True); s.add_argument("--widths"); s.add_argument("--clip")
    s.add_argument("--min-sf", type=float, default=15); s.add_argument("--dpi", type=int, default=60)
    s.add_argument("--out", default="takeoff"); s.set_defaults(fn=cmd_faces)
    s = sp.add_parser("grid"); s.add_argument("pdf"); s.add_argument("--page", type=int, required=True)
    s.add_argument("--ptft", type=float, required=True); s.add_argument("--clip"); s.add_argument("--step", type=float, default=5)
    s.add_argument("--dpi", type=int, default=110); s.add_argument("--out", default="takeoff"); s.set_defaults(fn=cmd_grid)
    s = sp.add_parser("area"); s.add_argument("--grid", required=True); s.add_argument("--poly", action="append", required=True)
    s.add_argument("--minus", action="append"); s.add_argument("--snap", type=float, default=0.75)
    s.add_argument("--name"); s.add_argument("--dpi", type=int, default=110); s.set_defaults(fn=cmd_area)
    s = sp.add_parser("measure"); s.add_argument("--faces", required=True); s.add_argument("--pick", required=True)
    s.add_argument("--minus"); s.set_defaults(fn=cmd_measure)
    s = sp.add_parser("poly"); s.add_argument("--ptft", type=float); s.add_argument("--pts"); s.add_argument("--feet")
    s.set_defaults(fn=cmd_poly)
    s = sp.add_parser("doors"); s.add_argument("pdf"); s.add_argument("--page", type=int, required=True)
    s.add_argument("--ptft", type=float, required=True); s.set_defaults(fn=cmd_doors)
    a = ap.parse_args(); a.fn(a)


if __name__ == "__main__":
    main()
