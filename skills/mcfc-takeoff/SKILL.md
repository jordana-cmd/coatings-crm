---
name: "mcfc-takeoff"
description: "Measure flooring square footage off a job's plans for MotorCity Floors and Coatings when the SF isn't written in the bid docs: scale check against written dimensions, room inventory by finish code, measured polygons with a check image, cross-checks against stated areas, and a low/high range logged to the CRM. Use before mcfc-pricing or mcfc-scope-sheet whenever SF is missing, when Jordan asks for a takeoff or 'how many square feet', or when a sub's SF disagrees with ours."
---

# MCFC Takeoff

The computer measures. The agent only decides which areas are in scope. An AI eyeballing a hatch is
not a measurement (on D1 an eyeball read was 3x too high).

Every takeoff produces one row per area in the CRM `takeoffs` table, with a range and a check image.
Those rows are compared later against the sub's SF and the field SF. That comparison is how the
method gets better, so never skip logging.

## 0. Before you start (every run)
1. Read the active lessons. They are short rules learned from past misses, and they apply now:
   `select lesson, applies_when from takeoff_lessons where active order by created_at`
   (Supabase project xeykiicwwemecwyzmqgy).
2. Check the scoreboard so you know how much to trust each method:
   `select * from v_takeoff_method_stats`.
3. Look for SF that is already stated: the finish schedule, spec quantities, room tags with areas, the
   life safety / occupancy plan (area by use), the code summary on the cover sheet, and the GC's
   invite. If the doc states the SF for exactly our scope, use it (method `stated`), but still do
   step 4 if it is cheap. Stated numbers are wrong sometimes too.

## 1. Get the plans and set up
- The job folder is `MCFC Brain\01 Active Bids\<job>\01 Bid Docs`. Stage the plan PDF into the
  cloud workspace (device_stage_files), or download it with the Drive connector.
- Copy `scripts/takeoff.py` from this skill to a scripts folder outside the download folder.
  Install with `pip install pymupdf shapely --break-system-packages`.
  Run with `python3 -I takeoff.py ...`.
- `takeoff.py sheets plans.pdf` lists every page with its sheet number, page size, scales and whether
  it is vector or scanned. Find the **floor finish plan**; use the floor plan if there is none. Also
  find the life safety / occupancy plan and the door schedule.
- If the page is **scanned** (not vector), the snapping won't work. Do the same steps with
  `grid` + `area --snap 0`. The method becomes `raster_grid` and the range widens (±8%).

## 2. Scale gate (hard stop)
`takeoff.py calibrate plans.pdf --page N` fits the scale from the written dimension strings on the
sheet and compares it to the stated scale and the page size.
- **PASS** = 3 or more dimensions, with the fitted scale within 2% of the stated one. Use the
  printed `--ptft`.
- **FAIL or fewer than 3 dimensions:** check the page size first. 11x17 means the set was shrunk,
  so the stated scale is wrong; use the fitted value. If there is still no fit, calibrate by hand
  on two long written dimensions (a wall run, a column grid).
  Never measure on an unverified scale. The CRM refuses a measured takeoff without this.
- `takeoff.py doors ... --ptft X` is a weak third check only. Door arcs are noisy, so compare them
  with the door schedule. Never calibrate on a door.

## 3. Room inventory (this is the stopping rule)
Before measuring anything, list **every room or area on the plan** with its finish code from the
plan tags and the finish legend. Mark each one IN or OUT, with the reason (owner-provided,
existing to remain, other trade, alternate). You are done when every room on the plan has a row
and every IN row has an area.

Watch for these:
- Alternates: e.g. "RF-1 LVT is the GC alternate to sealed concrete". Measure the base finish and
  flag the alternate.
- Hatched patterns that continue past a wall line.
- Fixed casework, equipment pads and feature walls. Deduct these.
- Areas under future equipment, if the spec says so.
- Addenda that change the finish plan.

## 4. Measure
1. `takeoff.py grid plans.pdf --page N --ptft X --clip x0,y0,x1,y1 --out takeoff` renders the
   region with a feet grid every 5 ft. Clip coordinates are display points; render the whole
   sheet first at 40 dpi to pick the clip. Use `--step 2` for small rooms.
2. Read each IN area's corners off the grid in feet (x right, y down) and run:
   `takeoff.py area --grid takeoff/grid.json --name "F-1 lobby" --poly "x,y x,y ..." [--minus "x,y ..."]`
   - Corners snap to the nearest drawn line endpoint within 0.75 ft. Use `--snap 0.3` for thin
     walls. Large snap moves mean you read a corner wrong.
   - Measure net of walls: trace the inside face of the walls. Deduct interior partitions,
     feature walls and casework with `--minus`.
   - One `area` call per finish code / system. Repeat `--poly` for disconnected pieces.
3. **Open the check image** (`takeoff/<name>.png`) and look at it every time. It must show yellow
   only on the scope finish, no hatch from another finish inside the yellow, and no scope floor
   left white. If it's wrong, fix the polygon and re-run.
4. Where the plan has closed room outlines, `takeoff.py faces` can area the rooms automatically.
   It's useful for counting many identical rooms, but the check-image rule still applies.
5. If there's only a dimensioned sketch and no usable drawing, use
   `takeoff.py poly --feet "34.5*28.92 - 6*8"` with written dimensions only (method `written_dims`).

Cove base LF: use the perimeter_lf from `area`, minus door openings (3 ft each from the door
schedule), and only where the spec calls for integral cove.

## 5. Cross-check (at least one, two if the number decides a bid / no-bid)
- An area-by-use table on the life safety or code sheet (D1: BUSINESS 685 SF vs 679 measured).
- Gross area on the cover sheet: in-scope + out-of-scope rooms should come to about 92–95% of
  gross (walls take the rest). A gap over 10% means a room is missing from the inventory.
- A second, independent trace: the same area from written dimensions, or `faces`.
- The sub's SF, when their quote comes back (logged automatically, see step 7).

If two sources disagree by more than 5%, find out why before pricing. Write the reason in notes.

## 6. Log it (required)
Agents write through the service-role function (one row per area):
```sql
select agent_record_takeoff(
  p_opportunity_id => '<opp uuid>', p_area_label => 'Lobby / office / corridor', p_method => 'vector_grid',
  p_sf => 679, p_sf_low => 627, p_sf_high => 731, p_system => 'sealer', p_finish_code => 'F-1',
  p_sheet => 'A111', p_page => 12, p_scale_stated_ptft => 18, p_scale_fit_ptft => 17.993, p_n_dims => 12,
  p_perimeter_lf => 205, p_cross_checks => '[{"source":"A100 BUSINESS","sf":685,"diff_pct":-0.9}]'::jsonb,
  p_check_image_url => '<Drive link to the check PNG>', p_estimate_id => '<estimate uuid if priced>',
  p_agent => 'mcfc-takeoff', p_notes => 'what was excluded and why');
```
- Use the `sf_low`/`sf_high` from `area`. Widen them when the scope boundary was a judgment call.
- Files go in the job folder's `02 Pricing\Takeoff\`:
  - the room inventory as a CSV;
  - the check PNGs;
  - `calibration.json`.
- The pricing sheet and the scope sheet quote the SF **with its source and range**, e.g.
  "679 SF measured (627–731), A111 at 1/4 in., checked against A100".

## 7. Closing the loop (how this gets better)
- **When a sub quote arrives**, `v_takeoff_accuracy.sub_mismatch` flags a difference over 10%.
  Find out which number is right before the proposal goes out. Variety Foods (7,700 vs 3,200) is
  the kind of miss this catches.
- **After a job is built**, Jordan or the close-out agent sets `takeoffs.field_sf` (and
  `field_sf_at`) to the field-verified SF. That makes it the ground truth for the scoreboard.
- **When a takeoff misses** (more than 10% off the sub or field SF, or a scope boundary was wrong),
  write one lesson:
  `select agent_add_takeoff_lesson('<what went wrong, the numbers, the rule that prevents it>', '<when it applies>', '<opp uuid>', '<takeoff uuid>')`.
  A lesson is a rule with a number in it, not a diary entry. Retire stale ones by setting
  `active = false`; never delete them.
- `v_takeoff_method_stats` shows median error, bias and range hit-rate by method. If a method's
  range hits less than 80% of the time, widen its band in `takeoff.py` (`measure` / `area`)
  and note it in a lesson.

## Hand off
Tell Jordan in 2–4 lines:
- the SF by finish/system, with its range;
- the scale check result;
- the cross-check and how far off it was;
- anything you excluded or weren't sure about, by room name.
