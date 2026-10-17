/* ── Dragging a placed block ──

   Until this file there was no drag anywhere in the app: the only way to say
   "swimming moved to five" was to open the edit sheet and work the hour arrows.
   Two gestures live here — move a block, and resize it by an edge — and both
   end in ONE write, on drop.

   Three things about the design are deliberate and should not be "simplified":

   1. A GRIP, not a long press. The day screen scrolls by finger and
      `.day-workspace` is its only scroller, so a gesture armed by pressing
      anywhere on a block would swallow the scroll over most of a planned day.
      Only the grip and the two edge handles carry `touch-action: none`; a
      finger anywhere else on a block still scrolls the day. A long press was
      also rejected for having no affordance — a feature only its author knows
      exists — and for being the iOS text-selection gesture.

   2. attachTapGuard (js/07-week-view.js) IS THE CLICK SUPPRESSION. It owns
      blockEl.onclick and sets its `moved` flag on a pointer move past 8px on
      any DESCENDANT — and the handles are descendants. So a drag can never
      also open the edit sheet, with no hack here. That coupling is invisible;
      `aDraggedBlockDoesNotAlsoOpenItsEditor` is what holds it.

   3. Only button 0. The middle button is never claimed, so it still reaches
      attachMiddleDragPan on the workspace and panning is untouched — the same
      reasoning as the pointerdown shims on the training rows in 08-day-view.js.

   Nothing here owns data. moveBlockToDay is the one writer, it stamps through
   markItemUpdated, and it is the only function in the file that touches state.
*/

/* The gesture snaps in quarter hours, so 15 is the floor a drag can express.
   saveEditChanges keeps its own 5-minute floor: that is a different control,
   and a floor a gesture cannot reach would just be a handle that stops
   responding for no visible reason. */
const BLOCK_DRAG_MIN_DUR = 15;
/* Past this many pixels the press becomes a drag. Deliberately below
   attachTapGuard's 8px, so by the time we commit to dragging the tap guard has
   already decided the same way. */
const BLOCK_DRAG_SLOP = 6;

let blockDrag = null;

/* Asked by refreshCurrentScreen (js/03-sync.js): a remote snapshot — including
   the echo of this device's own write — rebuilds the whole timeline, which
   mid-drag destroys the element under the finger. */
function blockDragActive() { return !!blockDrag; }

/* Draw the guide the placement flow already uses, rather than inventing a
   second one. Each canvas owns its own .tl-placement-guide; .placing is what
   reveals it. */
function blockDragShowGuide(canvas, relMin, label) {
  if (!canvas) return;
  const y = relMin * PX_PER_MIN;
  canvas.classList.add('placing');
  canvas.style.setProperty('--place-guide-y', `${y}px`);
  canvas.dataset.guideLabel = label;
  const g = canvas.querySelector('.tl-placement-guide');
  if (g) { g.style.top = `${y}px`; g.dataset.time = label; }
}

/* A block's travel / get-ready / warm-up strips are separate elements rendered
   from the same record, so a transform on the block alone leaves them behind
   and a training block floats away from its own get-ready. They move with it —
   hiding them would take away the one thing worth checking while moving a
   block you travel to. */
function blockDragBufferEls(canvas, blockId) {
  if (!canvas) return [];
  return [...canvas.querySelectorAll(`.placed-block[data-owner-id="${CSS.escape(blockId)}"]`)];
}

/* Which column the pointer is over, by RECT rather than elementFromPoint: the
   topmost element at a point is a doodle, a buffer strip, an hour tick or the
   dragged block itself, and every one of those needs a closest() walk anyway.
   X only — dragging above or below the canvas should still resolve to a column
   and let the snap clamp the time. */
function blockDragColAt(clientX) {
  const cols = [...document.querySelectorAll('#timeline .tl-col')];
  return cols.find(c => {
    const r = c.getBoundingClientRect();
    return clientX >= r.left && clientX <= r.right;
  }) || null;
}

function blockDragReset() {
  if (!blockDrag) return;
  const d = blockDrag;
  blockDrag = null;
  if (d.el) d.el.classList.remove('is-block-dragging');
  document.querySelectorAll('#timeline .tl-col').forEach(c => c.classList.remove('tl-col--droptarget'));
  clearPlacementGuide();
  try { if (d.handle && d.pointerId != null) d.handle.releasePointerCapture(d.pointerId); } catch (e) {}
}

/* Where the drop lands, in minutes from the top of the target canvas. One
   converter — canvasSnapMin / canvasSnapMinRaw in js/08-day-view.js — because
   js/07-week-view.js shadows PX_PER_MIN at the week grid's scale and arithmetic
   copied from there would be silently wrong. */
function blockDragGeometry(canvas, clientY) {
  const d = blockDrag;
  let relStart = d.origRelStart;
  let dur = d.origDur;
  if (d.mode === 'move') {
    relStart = canvasSnapMin(canvas, clientY - d.grabOffsetPx);
    /* Against what this canvas was DRAWN to, not the whole day. The day view
       trims its evening when nothing is planned there, and clamping to the
       global would let a drop land below the bottom of the visible grid. */
    relStart = Math.max(0, Math.min(relStart, canvasSpanMin(canvas) - dur));
  } else if (d.mode === 'resize-bottom') {
    // An END may legally be the last minute of the day, which is exactly what
    // canvasSnapMin's "not a legal start" clamp refuses — hence the raw form.
    const end = Math.min(canvasSpanMin(canvas),
      Math.max(d.origRelStart + BLOCK_DRAG_MIN_DUR,
        canvasSnapMinRaw(canvas, clientY - d.grabOffsetPx)));
    dur = end - d.origRelStart;
  } else {
    // Dragging a top edge moves the start and HOLDS THE END. That is what the
    // gesture means; growing downward from the top would be a different verb.
    const origEnd = d.origRelStart + d.origDur;
    relStart = Math.max(0, Math.min(canvasSnapMin(canvas, clientY - d.grabOffsetPx),
      origEnd - BLOCK_DRAG_MIN_DUR));
    dur = origEnd - relStart;
  }
  return { relStart, dur };
}

function blockDragPaint(ev) {
  const d = blockDrag;
  /* A resize stays in its own column — it is one block's duration, not a
     question about which day. Only a move can change day. */
  if (d.mode === 'move') {
    const col = blockDragColAt(ev.clientX) || d.col;
    const canvas = col.querySelector('.tl-canvas');
    if (canvas && canvas !== d.canvas) {
      clearPlacementGuide();
      d.col = col;
      d.canvas = canvas;
      d.dstKey = canvas.dataset.dayKey;
    }
    document.querySelectorAll('#timeline .tl-col').forEach(c =>
      c.classList.toggle('tl-col--droptarget', c === d.col && d.dstKey !== d.srcKey));
  }
  const canvas = d.canvas;
  const { relStart, dur } = blockDragGeometry(canvas, ev.clientY);
  d.relStart = relStart;
  d.dur = dur;

  const topPx = relStart * PX_PER_MIN;
  if (d.mode === 'move') {
    /* transform, not top: it does not invalidate layout and it composites, so
       the block tracks the finger. .is-block-dragging kills .placed-block's own
       0.15s transform transition, which would otherwise lag every move, and the
       :hover translate, which would compose against this one. */
    if (d.liftRect) {
      // Lifted into #timeline, so it is steered in VIEWPORT coordinates — which
      // is what lets it cross from one column's canvas into another's.
      const cr = canvas.getBoundingClientRect();
      const wantTop = cr.top + canvas.clientTop + topPx;
      d.el.style.transform =
        `translate(${cr.left - d.liftRect.left}px, ${wantTop - d.liftRect.top}px)`;
    } else {
      d.el.style.transform = `translateY(${topPx - d.origTopPx}px)`;
    }
    // The strips stay in the SOURCE canvas and follow in its own coordinates:
    // they describe minutes on the day the block is leaving until it lands.
    const dy = topPx - d.origTopPx;
    d.bufferEls.forEach(el => { el.style.transform = `translateY(${dy}px)`; });
  } else {
    // A resize changes height, which no transform can express.
    d.el.style.top = topPx + 'px';
    d.el.style.height = Math.max(22, dur * PX_PER_MIN - 2) + 'px';
  }

  const zmin = parseFloat(canvas.dataset.zmin) || 0;
  const showEnd = d.mode === 'resize-bottom';
  const guideRel = showEnd ? relStart + dur : relStart;
  blockDragShowGuide(canvas, guideRel, formatTimeFromMin(START_MIN + zmin + guideRel));
}

/* ── The one writer ──
   Move and resize both land here, and in stage 1 srcKey and dstKey are always
   the same day. markItemUpdated is NOT optional: setDayBlocks does not stamp,
   and an unstamped edit loses whole-record arbitration to a stale remote copy —
   which is how toggleConfirm once lost a confirmation. */
function moveBlockToDay(srcKey, dstKey, blockId, patch) {
  // Read every source before writing anything — pcwPlan's rule, and what makes
  // a move between two columns of the same profile safe.
  const srcBlocks = getDayBlocks(srcKey);
  const blk = srcBlocks.find(b => b && b.id === blockId);
  if (!blk) return false;
  // Re-checked here as well as at pointerdown: a writer that trusts its callers
  // is a writer that can be called wrong.
  if (blk.parentPinned && !isParent()) { showToast('📌 Parent-pinned — ask a grown-up'); return false; }

  const startMin = Math.max(START_MIN, Math.min(END_MIN - BLOCK_DRAG_MIN_DUR, patch.startMin));
  const durationMin = Math.max(BLOCK_DRAG_MIN_DUR, Math.min(patch.durationMin, END_MIN - startMin));

  if (dstKey === srcKey) {
    if (blk.startMin === startMin && blk.durationMin === durationMin) return false;
    blk.startMin = startMin;
    blk.durationMin = durationMin;
    markItemUpdated(blk);
    setDayBlocks(srcKey, srcBlocks);
    return true;
  }

  /* ── A DAY CHANGE RE-IDS THE BLOCK, and that is the load-bearing part ──

     mergeWeeks unions each day key by id, so "not on Tuesday any more" cannot
     be said: a device that still holds the Tuesday copy puts it straight back
     and the block ends up on both days at once. A tombstone is what makes the
     removal sayable — but blockTombstoned drops a record when
     `tombstone >= updatedAt`, note the >=, and mergeNow() IS syncNow(). Keep
     the id and the tombstone written alongside the move would delete the moved
     block on every device in the same millisecond.

     Two ids make that unreachable rather than merely unlikely: the tombstone
     names the id that is genuinely gone, and the arrival carries one nothing
     has ever tombstoned. weekCloneBlock and copyDayInto already work this way.
     One tombstone per drag is nothing against TOMBSTONE_MAX (2000, pruned by
     count) — a single day copy writes far more.
     tests/merge.test.js holds both halves on two devices. */
  const dstBlocks = getDayBlocks(dstKey);
  const moved = JSON.parse(JSON.stringify(blk));   // Object.assign is shallow —
  // objectives, gearState, trainingCheck and stopwatch would stay shared by
  // reference until the next reload re-parsed the JSON.
  moved.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  moved.startMin = startMin;
  moved.durationMin = durationMin;
  /* Off its own weekday it is no longer one of the series' days. The caller has
     already said so out loud and been agreed with. */
  ['seriesId', 'seriesDays', 'seriesEvery', 'seriesStart', 'seriesEnd']
    .forEach(k => { delete moved[k]; });
  /* A SHARED BLOCK KEEPS ITS 💌 (the owner's decision, 2026-09-24) and records
     the invites it was sent under, which name the old id. sisterInviteFor then
     still finds them, and — since they are for another day — reads them as
     MOVED: the edit sheet and Sister Sync offer "Send again?". */
  const sentIds = inviteIdsForBlock(blk);
  if (sentIds.length) moved.sentInviteIds = sentIds;
  else delete moved.sentInviteIds;
  markItemUpdated(moved);

  /* The one store keyed by block id rather than carried on the record. Miss it
     and a child's mood on that block silently belongs to nothing. */
  const profd = getProfData();
  if (profd.blockMoods && profd.blockMoods[blk.id] != null) {
    profd.blockMoods[moved.id] = profd.blockMoods[blk.id];
    delete profd.blockMoods[blk.id];
  }

  tombstoneBlockIds([blk.id]);

  /* Assigned directly, then ONE saveAll. setDayBlocks saves on every call, so
     writing two days through it would upload the whole family document twice —
     paSaveSchoolHours' precedent. It reads like a bug without this comment. */
  if (!profd.weeks) profd.weeks = {};
  profd.weeks[srcKey] = srcBlocks.filter(b => b && b.id !== blk.id);
  profd.weeks[dstKey] = dstBlocks.concat([moved]);
  saveAll();
  return true;
}

/* Moving a repeat off its own weekday makes the record claim a repeat it is no
   longer part of, and seriesExtendTo would later act on that stale plan. State
   the consequence; do not ask a child to reason about a data model. */
async function blockDragConfirmLeaveSeries(blk, srcKey, dstKey) {
  const from = DAY_SHORT[dayIdxOfKey(srcKey)];
  const to = DAY_SHORT[dayIdxOfKey(dstKey)];
  return showConfirm(
    `This one repeats on ${from}. Moving it to ${to} takes just this one out of the repeat — the others stay where they are.`,
    { okLabel: 'Move it', cancelLabel: 'Leave it' });
}

async function blockDragCommit() {
  const d = blockDrag;
  const zmin = parseFloat(d.canvas.dataset.zmin) || 0;
  const startMin = START_MIN + zmin + d.relStart;
  const dstKey = d.dstKey || d.srcKey;
  let ok = true;
  if (dstKey !== d.srcKey) {
    const blk = getDayBlocks(d.srcKey).find(b => b && b.id === d.id);
    /* Read first, await, THEN write — removeBlock's shape. blockDrag stays set
       for the whole await so a remote snapshot cannot rebuild underneath it. */
    if (blk && blk.seriesId) ok = await blockDragConfirmLeaveSeries(blk, d.srcKey, dstKey);
  }
  const moved = ok && moveBlockToDay(d.srcKey, dstKey, d.id, { startMin, durationMin: d.dur });
  if (moved) focusDayColumn(dstKey);
  blockDragReset();
  /* buildTimeline redraws every column from the records and empties #timeline
     first, so it also puts a LIFTED block back where it belongs. That is why
     there is no manual restore path: a refused drop, a declined confirm and a
     no-op drop all end here. */
  buildTimeline();
  return moved;
}

function blockDragStart(ev, blockEl, block, mode) {
  if (ev.button !== 0) return;              // the middle button belongs to the panner
  if (blockDrag) return;
  const canvas = blockEl.closest('.tl-canvas');
  const col = blockEl.closest('.tl-col');
  if (!canvas || !col) return;
  ev.stopPropagation();
  ev.preventDefault();

  const rect = blockEl.getBoundingClientRect();
  const handle = ev.currentTarget;
  blockDrag = {
    mode, id: block.id, el: blockEl, canvas, col, handle,
    srcKey: canvas.dataset.dayKey,
    dstKey: canvas.dataset.dayKey,
    pointerId: ev.pointerId,
    startX: ev.clientX, startY: ev.clientY,
    /* The distance from the finger to the EDGE IT IS DRAGGING, so that edge
       tracks the finger instead of jumping to it. Without it the pointer grabs
       the middle of a 14px strip and the block's real bottom sits 9px lower
       (the handle is inset by the block's 2px border and centred in its own
       height), so a drag of exactly half an hour's pixels came out 15 minutes
       short — which is what the resize check caught. A bottom handle measures
       to the block's true END; the other two measure to its top. */
    grabOffsetPx: ev.clientY - (mode === 'resize-bottom'
      ? rect.top + (block.durationMin || 0) * PX_PER_MIN
      : rect.top),
    origTopPx: parseFloat(blockEl.style.top) || 0,
    origHeightPx: parseFloat(blockEl.style.height) || rect.height,
    origRelStart: (block.startMin - START_MIN) - (parseFloat(canvas.dataset.zmin) || 0),
    origDur: block.durationMin || BLOCK_DRAG_MIN_DUR,
    bufferEls: mode === 'move' ? blockDragBufferEls(canvas, block.id) : [],
    dragging: false,
  };
  blockDrag.relStart = blockDrag.origRelStart;
  blockDrag.dur = blockDrag.origDur;
  try { handle.setPointerCapture(ev.pointerId); } catch (e) {}
}

function blockDragMove(ev) {
  if (!blockDrag) return;
  if (!blockDrag.dragging) {
    if (Math.abs(ev.clientX - blockDrag.startX) <= BLOCK_DRAG_SLOP &&
        Math.abs(ev.clientY - blockDrag.startY) <= BLOCK_DRAG_SLOP) return;
    blockDrag.dragging = true;
    blockDrag.el.classList.add('is-block-dragging');
    blockDragLift();
  }
  ev.preventDefault();
  blockDragPaint(ev);
}

/* .tl-canvas clips its overflow AND is a deliberate stacking context, so a
   block dragged toward the next column would simply be cut off at the edge.
   Lift it to #timeline — which spans every column — and drive it in viewport
   coordinates for the rest of the gesture. Only a move needs this; a resize
   never leaves its own canvas. */
function blockDragLift() {
  const d = blockDrag;
  if (d.mode !== 'move' || d.lifted) return;
  const host = document.getElementById('timeline');
  if (!host) return;
  const r = d.el.getBoundingClientRect();
  d.lifted = true;
  d.parent = d.el.parentNode;
  d.next = d.el.nextSibling;
  d.liftRect = r;
  d.el.style.position = 'fixed';
  d.el.style.left = r.left + 'px';
  d.el.style.top = r.top + 'px';
  d.el.style.width = r.width + 'px';
  d.el.style.height = r.height + 'px';
  d.el.style.margin = '0';
  host.appendChild(d.el);
}

function blockDragEnd(ev) {
  if (!blockDrag) return;
  if (!blockDrag.dragging) { blockDragReset(); return; }   // a still press is a tap
  ev.preventDefault();
  blockDragCommit();
}

function blockDragAbort() {
  if (!blockDrag) return;
  const wasDragging = blockDrag.dragging;
  blockDragReset();
  // Nothing was moved on screen below the slop, so there is nothing to put back.
  if (wasDragging) buildTimeline();
}

/* Attached by renderBlockPixel to every block a child may actually drag. The
   handles are pointer-only and aria-hidden on purpose: the edit sheet is still
   the keyboard and screen-reader route to the same two facts, and three extra
   tab stops on every block would describe an afternoon as a list of grips. */
function blockDragHandle(cls, label) {
  const h = document.createElement('div');
  h.className = 'block-drag-handle ' + cls;
  h.setAttribute('aria-hidden', 'true');
  h.title = label;
  return h;
}

function attachBlockDrag(blockEl, block, dayKey) {
  /* Two thresholds, two questions — and this is the second one. A block under
     BLOCK_STACK_MIN is 22-40px tall, so two 14px edge handles would leave no
     tappable body at all and the drag would swallow the tap that opens the
     editor: the very failure .wf-card-check is exempted for. Short blocks keep
     the edit sheet, where a 15-minute change is a better control anyway. */
  const h = parseFloat(blockEl.style.height) || 0;
  if (h < BLOCK_STACK_MIN) return;
  /* A pinned block simply offers no grip. Letting a child drag it for two
     seconds and refusing at the drop is a control announcing something it did
     not do. */
  if (block.parentPinned && !isParent()) return;

  const grip = blockDragHandle('block-grip', 'Drag to move');
  grip.textContent = '⠿';
  const top = blockDragHandle('block-resize block-resize--top', 'Drag to change the start');
  const bottom = blockDragHandle('block-resize block-resize--bottom', 'Drag to change the end');

  /* Tells the stylesheet to inset the block's own text past the grip, so the
     two never sit on top of each other. Set from here rather than with :has()
     so it works wherever the app does. */
  blockEl.classList.add('has-grip');

  [[grip, 'move'], [top, 'resize-top'], [bottom, 'resize-bottom']].forEach(([el, mode]) => {
    el.addEventListener('pointerdown', (ev) => blockDragStart(ev, blockEl, block, mode));
    el.addEventListener('pointermove', blockDragMove);
    el.addEventListener('pointerup', blockDragEnd);
    el.addEventListener('pointercancel', blockDragAbort);
    el.addEventListener('lostpointercapture', blockDragAbort);
    blockEl.appendChild(el);
  });
}
