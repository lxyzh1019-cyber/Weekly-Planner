// Unit checks for the buffer-clip arithmetic in js/05-helpers.js.
// Run: node tests/buffers.test.js
//
// This is the one place that answers "how much of a travel/get-ready window is
// real, unoccupied time" — the week grid, the day view, the print sheet and
// computeBufferConflicts all read it, so a disagreement between what a screen
// DRAWS and what the conflict banner SAYS is impossible by construction rather
// than merely unlikely.
//
// It runs the real shipped function, the way tests/merge.test.js does. Minutes
// are absolute from midnight here, which is what every caller passes.
const { bufferClip } = require('../js/05-helpers.js');

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond === true) { pass++; console.log('PASS', name); }
  else { fail++; console.log('FAIL', name, cond === false ? '' : JSON.stringify(cond)); }
}

// (1) Nothing in the way: the window is whole and nothing is short.
{
  const r = bufferClip(600, 660, 15, 15, []);
  check('an empty day clips nothing',
    r.preFrom === 585 && r.postTo === 675 && r.preShort === 0 && r.postShort === 0);
}

// (2) The screenshot's Wednesday. School Day 8:10-14:50 carries 15m travel +
// 15m get-ready each way; Homework starts at 15:00, ten minutes after the bell.
// Thirty minutes of packing-up and driving are asked for and ten exist.
{
  const r = bufferClip(490, 890, 30, 30, [{ startMin: 900, durationMin: 150 }]);
  check('School Day ends 20m short of Homework',
    r.postTo === 900 && r.postShort === 20 && r.preShort === 0);
}

// (3) Ballet 20:00-20:45 with 25m travel + 15m get-ready home, against a 21:00
// Evening Routine: the whole 40-minute window is contested but 15 minutes of it
// are real, so it is 25 short — the number the banner prints.
{
  const r = bufferClip(840, 885, 40, 40, [{ startMin: 900, durationMin: 30 }]);
  check('Ballet gets home 25m short', r.postTo === 900 && r.postShort === 25);
}

// (4) A neighbour sitting wholly INSIDE the pre-window. The free stretch is the
// run touching the block, so the minutes on the far side of the snack do not
// count — see the comment on bufferClip. 45m asked, 20m contiguous, 25m short.
{
  const r = bufferClip(600, 660, 45, 0, [{ startMin: 570, durationMin: 10 }]);
  check('only the stretch touching the block counts',
    r.preFrom === 580 && r.preShort === 25);
}

// (5) A block that overlaps the owner itself leaves no buffer at all on that
// side, and the shortfall is the whole window rather than a negative number.
{
  const r = bufferClip(600, 660, 20, 20, [{ startMin: 560, durationMin: 60 }]);
  check('an overlapping neighbour eats the whole window',
    r.preFrom === 600 && r.preShort === 20);
}

// (6) A buffer of zero can never be short — a block with no travel is not in a
// clash however tightly it is packed. This is the equivalence computeBufferConflicts
// relies on: short > 0 exactly when that side reports a conflict.
{
  const r = bufferClip(600, 660, 0, 0, [{ startMin: 660, durationMin: 30 }]);
  check('no buffer is never short', r.preShort === 0 && r.postShort === 0);
}

// (7) Back-to-back with no gap: the next block starts the moment this one ends,
// so a post buffer of any size is entirely short.
{
  const r = bufferClip(600, 660, 0, 15, [{ startMin: 660, durationMin: 30 }]);
  check('a block butting up against the next leaves no room',
    r.postTo === 660 && r.postShort === 15);
}

// (8) A neighbour that ends before the window opens is not a neighbour.
{
  const r = bufferClip(600, 660, 15, 0, [{ startMin: 500, durationMin: 30 }]);
  check('a block earlier in the day does not clip', r.preFrom === 585 && r.preShort === 0);
}

// (9) The equivalence itself, swept: for every arrangement, a side is short
// exactly when a neighbour overlaps that window — which is the test
// computeBufferConflicts has been making separately. Two definitions of one
// fact is the "six copies" defect this repo already records.
{
  const bad = [];
  for (let start = 580; start <= 620; start += 5) {
    for (let dur = 10; dur <= 40; dur += 10) {
      const other = { startMin: start, durationMin: dur };
      const r = bufferClip(600, 660, 20, 20, [other]);
      const oEnd = start + dur;
      const preOverlap  = 580 < oEnd && 600 > start;
      const postOverlap = 660 < oEnd && 680 > start;
      if ((r.preShort > 0) !== preOverlap)  bad.push(`pre ${start}+${dur}`);
      if ((r.postShort > 0) !== postOverlap) bad.push(`post ${start}+${dur}`);
    }
  }
  check('short > 0 exactly when the window overlaps a block', bad.length === 0 || bad);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
