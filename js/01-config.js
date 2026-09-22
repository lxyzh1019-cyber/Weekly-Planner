// Weekly-Planner — data model: constants, colours, presets, templates.
// Extracted verbatim from index.html (classic script, global scope).
/* ════════════════════════════════════════════════════════════════
   DATA MODEL
════════════════════════════════════════════════════════════════ */
const LS_KEY = 'weeklyplanner-v3';
/* The build, shown on the parent portal's App landing so a grown-up can read
   which code a device is running. The page cannot read sw.js, so this is a
   second copy of SW_VERSION — and tests/check-sw-shell.js fails the build when
   the two differ. Bump both together, on every deploy that changes a shell file. */
const APP_BUILD = '2026-09-22c';
const TOTAL_SLOTS = 60;           // 6AM → 9PM = 15 hrs × 4 (legacy, used for some %s)
const START_HOUR  = 6;
const END_HOUR    = 22;
const START_MIN   = START_HOUR * 60;      // 360
const END_MIN     = END_HOUR * 60;        // 1320
const DAY_MIN_SPAN = END_MIN - START_MIN; // 960 min
const PX_PER_MIN  = 1.4;                  // 1 min = 1.4px → 1 hr = 84px

const COLOURS = ['#ff7b54','#ff9eb5','#ffd166','#95d5b2','#6fb1fc','#c3aed6','#ef476f','#8ecae6','#ffb4a2','#b5ead7'];

/* When a day has stopped being a day. Minutes from midnight, so the window
   wraps: 9pm to 7am. Today reads this to answer "what now" honestly at nine in
   the evening — "the rest of today is yours" is not a useful thing to tell a
   ten-year-old at 8:57pm. It is not a lock and it is not bedtime enforcement;
   the age-based bedtime nudge (bedtimeReminderText) is a separate thing. */
const QUIET_HOURS = { startMin: 21 * 60, endMin: 7 * 60 };

/* Age, without ever asking a child for it and without putting a birth date in a
   public repo. The only thing age decides here is the recommended-sleep band and
   the evening wind-down nudge — a year either way changes nothing a child acts
   on, so an age plus the August it was true for is precise enough, and it
   carries no date of birth. currentAge() in js/05-helpers.js seeds this on first
   read and rolls it forward one year each August. A grown-up can correct it in
   the parent portal; the child is never asked. */
const DEFAULT_KID_AGE = 10;
const AGE_ROLLOVER_MONTH = 7;   // 0-based: August

/* CAT_COLOUR lived here: the same nine categories again, as `var(--cat-*)`
   strings. It had ZERO consumers — a third copy of a colour table that nothing
   ever read, which is worse than a duplicate that drifts, because a duplicate
   that drifts at least shows up on a screen. CAT_HEX below is what the app
   asks, and ACTIVITY_CATEGORIES is what owns the hues. */
const CAT_HEX = {
  sleep:'#c3aed6', school:'#6fb1fc', active:'#fb6f1c',
  free:'#95d5b2', daily:'#ffd166', custom:'#ff9eb5', training:'#ef476f',
  routine:'#80cbc4',
  // Appointments: the dentist, the orthodontist, a parent-teacher meeting. A
  // fixed time somebody else set, which is what makes it its own category
  // rather than an "active" or a "daily" — you cannot move it, and a week that
  // has one is shaped around it. Muted on purpose: it is not a treat, and it is
  // not a chore either.
  appointment:'#8fa8b8',
  // Not a category — Competition is cat:'training' with isCompetition set. The
  // colour lives here so a competition block can be told apart at a glance.
  competition:'#f4a340'
};

/* The nine shipped defaults, frozen as a SET so blockColour can tell a colour
   somebody chose from one a placement copied out of this table. Every placement
   path seeded `colour` from CAT_HEX, so the value alone cannot say which it
   was — but a value that is exactly one of these was never a decision. The
   subgroup hexes and every hex this table has RETIRED join the set below. */
const CAT_HEX_VALUES = new Set(Object.values(CAT_HEX).map(h => h.toLowerCase()));
/* Every hex this app has ever SEEDED onto a block, as opposed to one somebody
   picked off the sheet's colour dots. The subgroup hexes join it below, once
   ACTIVITY_CATEGORIES exists — a placement seeds the subgroup's own colour so
   the sheet opens showing the right one, and that must not then read as a
   decision, or changing a subgroup's hue would leave every block already placed
   wearing the old one. */
const SEEDED_HEX_VALUES = new Set(CAT_HEX_VALUES);

/* ── ONE owner for what KIND of thing a block is ──────────────────
   Six groups, and the reason there is a table at all is that there used to be
   five of them, drifting. `cat:'daily'` was labelled "🧹 Chores" by the meeting
   and the parent trend chart and "🍽 Daily" by the week glance, the weekly wins
   and the print sheet — while actually holding breakfast, lunch, dinner, the
   house chore, four Family Hero tasks and two health tasks. So a week's hours
   counted dinner as a chore on two screens and as something else on three.

   `cat` still decides a block's COLOUR (CAT_HEX / blockColour) and still drives
   the activity picker's filters. This answers a different question — what is
   this time FOR — and it is the only thing the hours charts and the XP gate may
   ask. Two questions, two tables, on purpose.

   `short` exists because the week grid compresses a label into about seven
   characters; "Brain Construction" cannot live there.

   Brain and Body as a pair is deliberate: they name building something rather
   than being good at something, which is the performance-identity framing the
   copy rules forbid. */
/* NO `hex` HERE. This table carried one, and eight of its rows repeated a value
   that ACTIVITY_CATEGORIES below already owns — four of them exactly (routine,
   chores, free, explore). A second copy of a colour table is the six-copies
   defect this repo keeps recording, and it was one recolour away from firing:
   move a subgroup's hue and the cards would wear the new one while the hours
   charts and the meeting bars kept the old. `groupHex` derives from the
   subgroups now, so there is one owner and nothing to keep in step. */
const ACTIVITY_GROUPS = [
  { id: 'routine', label: '🌅 Routine',            short: 'Routine' },
  { id: 'brain',   label: '🧠 Brain Construction', short: 'Brain'   },
  { id: 'body',    label: '💪 Body Construction',  short: 'Body'    },
  { id: 'chores',  label: '🧹 Helping hands',      short: 'Chores'  },
  { id: 'daily',   label: '🍎 Fuel & Care',        short: 'Fuel'    },
  { id: 'free',    label: '🎮 Play & Rest',        short: 'Play'    },
  /* Swimming for the fun of it is not the same ask as a training session, and
     filing both under Body said a length of the pool on Saturday was worth what
     a coached hour is. Everyday movement is its own row. */
  { id: 'move',    label: '🏊 Everyday movement',  short: 'Move'    },
  /* A museum, a hike, a morning at the lake. Not effort in the sense Body means
     it, and not "free time" either — the week is shaped around it the way it is
     around an appointment. */
  { id: 'explore', label: '🧭 Explore',            short: 'Explore' },
];
const GROUP_ORDER = ACTIVITY_GROUPS.map(g => g.id);
/* The fallback is looked up BY ID, not by position. It used to be
   ACTIVITY_GROUPS[4], which was 'daily' only because daily happened to be the
   fifth row — so adding a group anywhere above it would have quietly re-pointed
   every unknown-group lookup at a different row, with nothing to say so. */
function groupDef(id) {
  return ACTIVITY_GROUPS.find(g => g.id === id)
      || ACTIVITY_GROUPS.find(g => g.id === 'daily');
}
function groupLabel(id) { return groupDef(id).label; }
function groupShort(id) { return groupDef(id).short; }
/* Derived from the subgroup table, which is the one owner of every hue in the
   app. A group is what the hours charts and the XP gate read; the FIRST
   subgroup that names this group is the colour those rows should wear, so the
   bar and the card a child sees can never disagree. The fallback is the grey
   blockColour uses for a block nothing resolves — same answer, same reason. */
function groupHex(id) {
  const sub = Object.values(ACTIVITY_SUBS).find(sg => sg.group === id);
  return (sub && sub.hex) || '#888';
}

/* Which group does this activity belong to?

   An explicit `group:` on the activity wins, which is how the four Family Hero
   quests become Chores — whoever did the chore is the hero, so they are chores
   with an encouraging name rather than a separate kind of thing — and how a
   parent's custom activity can be declared a chore. Everything else falls back
   to `cat`.

   An activity that cannot be resolved at all (a block naming an actId nothing
   answers to, which findActivity's archived pass usually prevents) comes back
   as `daily`: it is time spent on something the app can no longer name, and
   Daily is the neutral "part of the day" bucket. It is never dropped, because
   an hours total that silently omits blocks is worse than one that files them
   vaguely. */
function activityGroup(act) {
  if (!act) return 'daily';
  if (act.group && GROUP_ORDER.includes(act.group)) return act.group;
  /* The subgroup names a default group, which is what lets the catalog say
     "Arts" once instead of "Arts, and by the way that counts as Brain" on ten
     rows. An explicit `group:` above still wins — that is how Muscle Relaxation
     sits with the movement activities on the page and still earns nothing. */
  if (act.sub && ACTIVITY_SUBS[act.sub] && GROUP_ORDER.includes(ACTIVITY_SUBS[act.sub].group)) {
    return ACTIVITY_SUBS[act.sub].group;
  }
  if (act.isRoutine) return 'routine';
  if (act.isTraining || act.isCompetition) return 'body';
  switch (act.cat) {
    case 'training': case 'competition': return 'body';
    case 'school':                       return 'brain';
    case 'routine':                      return 'routine';
    case 'daily': case 'appointment':    return 'daily';
    /* 'active' means she moved, so it answers to Move. The three that are
       seasonal treats or outings rather than exercise carry an explicit
       `group` and never reach this line. `cat:'active'` itself has to stay —
       the athlete achievement counts on it. */
    case 'active':                       return 'move';
    case 'free': case 'sleep':           return 'free';
    default:                             return 'daily';
  }
}

/* ── CATEGORY › SUBGROUP › ACTIVITY ───────────────────────────────
   The third question about an activity, and the reason it is a third table
   rather than a column on one of the other two.

   `cat` answers "what colour is this block" and drives nothing else now.
   `group` answers "what is this time FOR" — the eight rows every hours chart
   and the XP gate read, unchanged. Neither is a shape a person can navigate: a
   picker with nine flat chips, three of which mean the same thing to a
   ten-year-old, is a list you scroll rather than a place you know your way
   around.

   So: six categories, each holding one or more subgroups, and every activity
   names a subgroup with `sub:`. The subgroup decides the COLOUR (a variant of
   its category's hue) and where the activity sits in the picker; the subgroup's
   `group` is the default for the chart row, and an explicit `group:` on the
   activity still wins — which is how Muscle Relaxation sits with the movement
   activities where it belongs in her week while still earning nothing, and how
   Family Meeting sits beside the routines without being counted as one.

   Colours: a category picks the hue, a subgroup varies it. Every one is a
   pastel that takes dark ink — never white text on these, which all fail
   contrast (CLAUDE.md, UI rules). Where a family already knows a colour it is
   kept: Routine's teal, Meals' amber, School's blue, Training's pink and Play's
   green are the shipped values unchanged. */
/* ── MEASURE COLOUR DISTANCE THE WAY AN EYE DOES ──
   These were first separated with CIE76, which overstates the distance between
   saturated greens by roughly double: it scored Helping hands against Play at
   49 where CIEDE2000 says 19, and a palette that cleared every threshold on
   paper still had two DIFFERENT categories reading as one colour on an iPad.
   `subgroupDistance` (js/05-helpers.js) is CIEDE2000, and
   `everySubgroupTellsItselfApart` (tests/smoke.js) is what holds this table to
   it. If you move a hex, run the suite — the arithmetic disagrees with intuition
   in exactly the cases that matter.

   THE FIGURE THAT MATTERS IS THE WORST *CROSS*-CATEGORY PAIR. Two subgroups
   inside one category are MEANT to look related: Meals and Appointments are
   both Fuel & Care and sit at 9.8, which is the design working. Two subgroups
   in different categories reading as one colour is the defect — and that pair
   used to be 2.9.

   The green-teal corner held five of the twelve, so Helping hands leaves it
   entirely: chores are not a shade of rest. It stays a cyan rather than going
   warm, so Daily Rhythm still reads as one category — a light aqua and a deep
   cyan are obviously siblings, which is the whole point of having categories. */
const ACTIVITY_CATEGORIES = [
  { id: 'rhythm', label: '🌅 Daily Rhythm', short: 'Rhythm', hex: '#8ad8d0', subs: [
    { id: 'routine',  label: '🌅 Routine',       hex: '#8ad8d0', group: 'routine' },
    /* Deep cyan, not a green. This was #9fd3b8, which sat 2.9 from Play in
       another category and 12.4 from its own sibling — the same colour to any
       eye, on two cards that mean opposite things. */
    { id: 'helping',  label: '🧹 Helping hands', hex: '#229eb1', group: 'chores'  },
  ]},
  { id: 'fuel', label: '🍎 Fuel & Care', short: 'Fuel', hex: '#ffd166', subs: [
    { id: 'meals',    label: '🍽 Meals',        hex: '#ffd166', group: 'daily' },
    /* Muted on purpose and kept apart from the meals: an appointment is a time
       somebody else set, it is not a treat, and it is not a chore either. */
    { id: 'appts',    label: '🩺 Appointments', hex: '#e3c48f', group: 'daily' },
  ]},
  { id: 'brain', label: '🧠 Brain Construction', short: 'Brain', hex: '#6fb1fc', subs: [
    { id: 'school',   label: '🏫 School',   hex: '#6fb1fc', group: 'brain' },
    { id: 'language', label: '🗣 Language', hex: '#8ed0f0', group: 'brain' },
    // Nudged off #b3a4f0 to hold its distance from Outings' orchid.
    { id: 'arts',     label: '🎨 Arts',     hex: '#b0a0ea', group: 'brain' },
  ]},
  { id: 'body', label: '💪 Body Construction', short: 'Body', hex: '#f2597d', subs: [
    /* Lifted from #ef476f, which gave dark ink 4.27:1 — under the 4.5:1 the
       house contrast rule asks for, and the only value in the table that failed
       it. This is 4.78:1. */
    { id: 'training', label: '🏋️ Training',          hex: '#f2597d', group: 'body' },
    { id: 'move',     label: '🏊 Everyday movement', hex: '#ff9a76', group: 'move' },
  ]},
  /* Out of the greens altogether. Explore was #7fb3a0, a sage that sat between
     Routine's teal and Play's mint and was the reason all three blurred. */
  { id: 'explore', label: '🧭 Explore', short: 'Explore', hex: '#d98ac8', subs: [
    { id: 'outings',  label: '🧭 Outings', hex: '#d98ac8', group: 'explore' },
  ]},
  { id: 'play', label: '🎮 Play & Rest', short: 'Play', hex: '#7fca79', subs: [
    { id: 'playtime', label: '🎮 Play',            hex: '#7fca79', group: 'free' },
    { id: 'seasonal', label: '🌟 Seasonal treats', hex: '#cfe06b', group: 'free' },
  ]},
];

/* ── WHAT THIS TABLE USED TO SAY ──
   SEEDED_HEX_VALUES is what lets blockColour tell a colour somebody CHOSE from
   one a placement copied out of the table, and every placement seeds the
   subgroup's own hex. So the moment a hex changes here, the retired value drops
   out of that set — and every block already on the calendar, carrying the old
   value in `b.colour`, starts reading as a deliberate choice and keeps wearing
   the hue it replaced FOREVER. No migration can fix that: `deepMergeObj` lets a
   remote scalar win, so a device serving an older bundle out of a Pages cache
   would push the old colours back over the new ones.

   Answering at read time is the only safe shape, the same reasoning as `xp2`
   and `achievementActivityId` — which means this list has to grow every time a
   hex moves, and must never be pruned. */
const RETIRED_SEEDED_HEXES = [
  '#80cbc4', // routine, and Daily Rhythm's own hex
  '#9fd3b8', // helping hands
  '#b3a4f0', // arts
  '#ef476f', // training, and Body Construction's own hex
  '#7fb3a0', // outings, and Explore's own hex
  '#95d5b2', // play, and Play & Rest's own hex
  '#c8e6a0', // seasonal treats
];
/* Flattened once, because every lookup below is by subgroup id and walking six
   nested arrays on every block of every render is work nobody needs. */
const ACTIVITY_SUBS = ACTIVITY_CATEGORIES.reduce((m, c) => {
  c.subs.forEach(sg => { m[sg.id] = Object.assign({}, sg, { cat: c.id }); });
  return m;
}, {});
ACTIVITY_CATEGORIES.forEach(c => {
  SEEDED_HEX_VALUES.add(c.hex.toLowerCase());
  c.subs.forEach(sg => SEEDED_HEX_VALUES.add(sg.hex.toLowerCase()));
});
RETIRED_SEEDED_HEXES.forEach(h => SEEDED_HEX_VALUES.add(h.toLowerCase()));

/* What a NEW block of this activity starts as. The four placement paths — two
   in addActivityAtMin, two in pickFromSlot — each wrote this out, so a default
   added to one pair was missing from the other; warm-up is the case in point,
   since only a coached session wants one. One writer, both sheets. */
function activityPlacementDraft(act) {
  const training = !!(act && act.isTraining);
  const base = {
    durationMin: activityDefaultDuration(act) || (training ? 120 : 60),
    colour: training ? CAT_HEX.training : (activitySub(act).hex || COLOURS[0]),
    note: '', repeat: false, repeatDays: [], objectives: [],
    travelBuffer: activityTravels(act),
    getReadyBuffer: activityTravels(act),
    travelBufMin: DEFAULT_BUFFER_MIN,
    getReadyBufMin: DEFAULT_BUFFER_MIN,
  };
  if (!training) return Object.assign(base, { choreTags: [] });
  return Object.assign(base, {
    tag: 'skating', compName: '', gearState: {},
    warmupBuffer: activityWarmsUp(act),
    warmupBufMin: DEFAULT_WARMUP_MIN,
  });
}

/* Which subgroup does this activity belong to?

   DERIVED, NEVER MIGRATED — the same reasoning as `xp2` and
   `achievementActivityId`. Every custom activity already in Firestore carries a
   `cat` and no `sub`, and `deepMergeObj` lets a remote scalar win, so a device
   still serving an older bundle out of a Pages cache could push an un-stamped
   record back over a stamped one. Answering at read time gives the same answer
   whatever has run, however often, in any merge order, and writes nothing. */
function activitySub(act) {
  if (!act) return ACTIVITY_SUBS.meals;
  if (act.sub && ACTIVITY_SUBS[act.sub]) return ACTIVITY_SUBS[act.sub];
  // A family's own activity, or a shipped one from before this table existed.
  if (act.isRoutine) return ACTIVITY_SUBS.routine;
  if (act.group === 'chores') return ACTIVITY_SUBS.helping;
  if (act.group === 'explore') return ACTIVITY_SUBS.outings;
  if (act._seasonal || act.season) return ACTIVITY_SUBS.seasonal;
  switch (act.cat) {
    case 'routine':     return ACTIVITY_SUBS.routine;
    case 'appointment': return ACTIVITY_SUBS.appts;
    case 'school':      return ACTIVITY_SUBS.school;
    case 'training':    return ACTIVITY_SUBS.training;
    case 'active':      return ACTIVITY_SUBS.move;
    case 'daily':       return ACTIVITY_SUBS.meals;
    case 'free': case 'sleep': case 'custom': return ACTIVITY_SUBS.playtime;
    /* Same neutral landing as activityGroup's: an activity nothing can resolve
       is filed rather than dropped, because a picker that silently omits an
       entry is worse than one that files it vaguely. */
    default:            return ACTIVITY_SUBS.meals;
  }
}
function activityCategory(act) {
  return ACTIVITY_CATEGORIES.find(c => c.id === activitySub(act).cat) || ACTIVITY_CATEGORIES[1];
}
function subDef(id) { return ACTIVITY_SUBS[id] || ACTIVITY_SUBS.meals; }
/* The legacy `cat` a new activity should carry. Still written on every record,
   because the sticker conditions (js/06-quests.js), the Athlete achievement and
   ACTIVITY_OBJECTIVES_BY_CAT all key on it — an activity saved without one
   would silently drop out of all three. Nothing reads it for colour or
   filtering any more. */
const SUB_LEGACY_CAT = {
  routine: 'routine', helping: 'daily', meals: 'daily', appts: 'appointment',
  school: 'school', language: 'school', arts: 'school',
  training: 'training', move: 'active', outings: 'free',
  playtime: 'free', seasonal: 'free',
};
function catForSub(id) { return SUB_LEGACY_CAT[id] || 'free'; }
function catDef(id) {
  return ACTIVITY_CATEGORIES.find(c => c.id === id) || ACTIVITY_CATEGORIES[1];
}

/* ── Do you GO to this, or do you do it here? ─────────────────────
   Both placement sheets started every buffer switched off, so a swim and a
   skate were planned as though they happened at the kitchen table — and
   tdActionableStart, the get-ready time Today leads with, had nothing to
   compute from until somebody remembered to reach for the toggle.

   The default comes from the ACTIVITY rather than from a global switch, which
   is the whole point: flipping it globally would put a fifteen-minute car
   journey in front of Breakfast. Warm-up is untouched — it is a training-
   specific idea with its own 20-minute default and its own toggle.

   Every toggle stays exactly where it is. Only the starting position moves. */
function activityTravels(act) { return !!(act && act.travels); }
/* And a coached session warms up at the venue, which is a third buffer with its
   own default. Same rule as travels: it comes from the ACTIVITY, never from a
   global switch — a warm-up in front of Breakfast is exactly what that would
   produce. Only Training and Competition carry it. */
function activityWarmsUp(act) { return !!(act && act.warmsUp); }

/* ── One filter table ──
   The day screen's activity picker and the tray each carried their own copy of
   this list, and they had drifted: the picker was missing Seasonal, and neither
   offered Rest or a kid's own custom activities even though both are choosable
   when you create one — anything filed there could only ever be found under
   "All". Both read this now, so a category added here appears everywhere.

   `seasonal` and `custom` match on a flag rather than a category, which is why
   filtering goes through activityMatchesFilter instead of comparing a.cat. */
/* THE CHIPS ARE THE CATEGORIES. This was nine flat `cat` values plus Seasonal
   and Mine, and three of them — Daily, Routines, Rest — name the same part of a
   ten-year-old's day; "Learning" held a school day, a French lesson and a piano
   practice; and Seasonal was a chip about WHEN an activity is available rather
   than what it is.

   One row per category now, so the chips and the activity tree are the same
   shape, and inside a category the list is grouped by subgroup. Seasonal is a
   subgroup of Play & Rest — `_locked` still keeps Beach Day out of January, so
   nothing about availability changes, only where it is filed.

   Mine stays, and stays last: it means "made by this family, wherever it was
   filed", which is a different question from all six and the only way to find
   the thing you made. */
const ACTIVITY_FILTERS = ACTIVITY_CATEGORIES.map(c => ({ id: c.id, label: c.label }))
  .concat([{ id: 'custom', label: '✨ Mine' }]);
function activityMatchesFilter(act, filterId) {
  if (!act) return false;
  if (!filterId || filterId === 'all') return true;
  // "Mine" means made by this family, wherever it was filed. A custom activity
  // saved as, say, Play would otherwise be findable only under Play — and the
  // point of the chip is to find the thing you made.
  if (filterId === 'custom') return !!act.custom || act.cat === 'custom';
  return activitySub(act).cat === filterId;
}

/* ── What a competition day looks like when the app places one ──────
   A meet recorded from the Record sheet places its own block, and these are the
   shape it arrives in. Named here rather than inlined at the call site because
   they are a FAMILY'S ROUTINE, not an implementation detail: eight in the
   morning to three in the afternoon, half an hour in the car each way, an hour
   of warming up. A parent moves any of it on the block afterwards.

   Deliberately NOT `DEFAULT_BUFFER_MIN`/`DEFAULT_WARMUP_MIN` (15 and 20): those
   are the defaults for an ordinary training session, and a competition is the
   one day of the sport where the travel is longer and the warm-up is most of
   the morning. Using the training numbers here would quietly say a meet is a
   Tuesday practice. */
const COMP_BLOCK_START = 8 * 60;          // 8:00am
const COMP_BLOCK_DUR = 7 * 60;            // through to 3:00pm
const COMP_TRAVEL_MIN = 30;               // each leg, both legs on
const COMP_WARMUP_MIN = 60;               // before it starts

/* Training tags + sport-specific starter objectives. Each topic carries its
   own icon and background colour so a Skating block reads differently from a
   Swimming or Dryland one at a glance, not just by its text label. */
const TRAINING_TAGS = [
  { id:'skating',  label:'⛸ Skating',  name:'Skating',  icon:'⛸', colour:'#8a6fd0' },
  { id:'swimming', label:'🏊 Swimming', name:'Swimming', icon:'🏊', colour:'#2f9fd0' },
  { id:'dryland',  label:'💪 Dryland', name:'Dryland',  icon:'💪', colour:'#e08a3a' },
  { id:'general',  label:'🏃 General', name:'Training', icon:'🏃', colour:'#ef476f' },
];
/* This list used to be the whole of it, which meant a sport the family took up
   — gymnastics — simply could not be entered: every training block had to be
   one of four. A family adds sports; the app has to be able to.

   Custom sports live in shared state so both girls and the parent see the same
   set, and they are read through here rather than by anyone reaching into
   state: getTrainingTopic is what every renderer already resolves a tag with,
   so a sport added today makes last month's blocks render correctly too.
   Archived rather than deleted, for exactly that reason. */
function getCustomSports() {
  const list = (typeof state !== 'undefined' && state.shared && state.shared.customSports) || [];
  return list.filter(s => s && s.id && !s.archived);
}
function getTrainingTags() {
  return TRAINING_TAGS.concat(getCustomSports());
}
/* Resolving a tag sees archived sports too — a block placed under a sport the
   family has since dropped still says what it was. */
function getTrainingTopic(tag) {
  const all = (typeof state !== 'undefined' && state.shared && state.shared.customSports)
    ? TRAINING_TAGS.concat(state.shared.customSports.filter(s => s && s.id))
    : TRAINING_TAGS;
  return all.find(t => t.id === tag) || TRAINING_TAGS[3];
}
/* The background a training block should use: an explicit non-default custom
   colour wins; otherwise the topic colour (falls back to the training pink). */
function trainingBlockColour(b) {
  if (b.colour && b.colour !== CAT_HEX.training) return b.colour;
  return getTrainingTopic(b.tag).colour;
}

/* ── What colour is this block? ──
   The formula was written out four times — the week grid twice, the day view and
   the print sheet — and two of the copies had already drifted apart: an unknown
   category came out green on the week grid and grey everywhere else. Today's
   ribbon now colours its cells by category too, which would have made a fifth
   copy and a second chance to disagree.

   Order matters and is not arbitrary: a training block's topic colour beats the
   category, because Skating and Swimming are both cat 'training' and must not be
   the same pink; an explicit per-block colour beats the category for everything
   else, because that is a choice somebody made on purpose.

   findActivity rather than getAllActivities: this colours a block that already
   exists, so an archived activity must still resolve. */
function blockColour(b, kid) {
  if (!b) return '#888';
  const act = findActivity(b.actId, kid);
  /* NOTHING ANSWERS TO THIS ID — an import, or a custom activity deleted on
     another device before the archive rule existed. Grey is the honest answer
     and it must stay explicit: activitySub's neutral landing is `meals`, which
     is right for filing an hours total vaguely and wrong for colour. A block
     nobody can name drawn in Breakfast amber does not say "unknown", it says
     "breakfast". */
  if (!act) return b.colour || '#888';
  if (act.isTraining) return trainingBlockColour(b);
  /* THE SUBGROUP IS THE HUE. `cat` used to be, and nine flat values could not
     tell a piano lesson from a French lesson from a school day — all three came
     out the same blue — nor an appointment from a museum trip.

     A stored `b.colour` only counts when somebody CHOSE it. Every placement
     wrote one, seeding it from CAT_HEX, so a colour equal to one of those nine
     shipped defaults is not a choice, it is the old default written down; a
     colour picked from the sheet's dots is, and survives. Nothing is migrated —
     the answer is derived on every read, which is the same answer in any merge
     order (see activitySub). */
  if (b.colour && !SEEDED_HEX_VALUES.has(String(b.colour).toLowerCase())) return b.colour;
  return activitySub(act).hex || CAT_HEX[act.cat] || '#888';
}

/* Figure skating: landing doubles, targeting double axel */
const SKATING_OBJECTIVES = [
  'Double Axel attempts',
  'Double Loop consistency',
  'Double Toe Loop',
  'Double Flip + Lutz',
  'Layback spin',
  'Camel → Sit combination',
  'Footwork sequence',
  'Back crossovers & edges',
  'Spirals & spread eagles',
  'Stroking power drills',
];
/* Swimming: strong butterfly, breaststroke kick weakness */
const SWIMMING_OBJECTIVES = [
  'Breaststroke KICK (board only)',
  'Breaststroke full stroke — leg focus',
  'Breaststroke pull + timing',
  'Butterfly strength set',
  'Freestyle endurance (distance)',
  'Backstroke technique',
  'Vertical / streamline kick',
  'Distance-per-stroke drills',
];
const DRYLAND_OBJECTIVES = [
  'Core circuit',
  'Flexibility & stretching',
  'Cardio intervals',
  'Jump training',
  'Balance & stability',
];
const GENERAL_OBJECTIVES = [
  'Warm-up',
  'Cool-down',
  'Mental focus / visualization',
  'Recovery stretch',
];

const OBJECTIVES_BY_TAG = {
  skating: SKATING_OBJECTIVES,
  swimming: SWIMMING_OBJECTIVES,
  dryland: DRYLAND_OBJECTIVES,
  general: GENERAL_OBJECTIVES,
};

/* Competition day is a different beast from a practice session — its checklist
   is about performing and managing the meet, not drilling technique. Kept fully
   separate from the training objectives so a Competition never just repeats the
   Training list. */
const COMPETITION_OBJECTIVES_BY_TAG = {
  skating: [
    'On-ice warm-up',
    'Program run-through',
    'Land my key jumps clean',
    'Strong spins & footwork',
    'Perform with confidence',
    'Cool-down & stretch',
  ],
  swimming: [
    'Pool warm-up',
    'Race starts & turns',
    'Swim my race plan / pace',
    'Strong finishes',
    'Stay hydrated & fuelled',
    'Cool-down swim',
  ],
  dryland: [
    'Dynamic warm-up',
    'Activation drills',
    'Give my best effort',
    'Recovery & mobility',
  ],
  general: [
    'Warm-up',
    'Compete my best',
    'Good sportsmanship',
    'Cool-down & reflect',
  ],
};

/* Goal/objective presets for ordinary (non-training) activities — same shape
   and UI as the training objectives, so any block can carry a target, not
   just Competitive Sports/Competition. Looked up by activity id first (a
   specific activity like Piano gets its own goals), falling back to its
   category. */
const ACTIVITY_OBJECTIVES_BY_ID = {
  /* The three ROUTINES are deliberately absent. A routine's completion IS its
     checklist (ROUTINE_PRESETS, and CLAUDE.md says so), so giving one goals as
     well would draw two lists on one block with nothing to say which counts. */

  // Fuel and care
  breakfast: ['Eat sitting down', 'Water bottle filled', 'Snack packed'],
  lunch: ['Finish the main', 'Fruit or veg', 'Clear your plate'],
  dinner: ['Help set the table', 'Screens away', 'Share one thing from today'],
  health_recovery_fuel: ['Protein + carb', 'Big glass of water', 'Within 30 min of training'],
  appt_general: ['Bring the paper/card', 'Two questions ready', 'Thank the person'],
  appt_medical: ['Health card', 'Know what to tell them', 'Brush before the dentist'],
  appt_haircut: ['Photo of the cut you want', 'Sit still', 'Say thank you'],
  appt_school_meet: ["One thing you're proud of", 'One thing to ask', 'Bring your agenda'],
  appt_physio: ['Exercise sheet packed', 'Say what hurt this week', 'Home exercises tonight'],
  family_meeting: ['Review the week', 'Money check', 'Plan next week'],

  // Brain
  school_day: ['Agenda filled in', 'Hand in what is due', 'Ask one question'],
  homework: ["Finish today's sheet", 'Check the answers', 'Pack it in the bag'],
  reading: ['Read 20 minutes', 'Finish the chapter', 'Tell someone what happened'],
  math: ["Beat yesterday's score", 'One Kangaroo problem', 'Explain one solution'],
  french: ['10 new words', 'One conversation with a parent', 'Finish the lesson'],
  chinese: ['Write 5 characters', 'Read one page aloud', 'Speak Chinese at dinner'],
  piano: ['Scales first', 'Trouble spot 5x slow', 'One piece start to finish'],
  singing: ['Warm-up', 'Learn one verse', 'Record it and listen back'],
  // The medium is a goal rather than a second activity or a new picker: one
  // Drawing block, and the first line says which kind of drawing it was.
  drawing: ['Sketch, or brush art', 'Finish one piece', 'Try a new technique', 'Sign and date it'],
  craft: ['Gather materials first', 'Finish it or store it safely', 'Tidy the table'],

  // Everyday movement
  swimming: ['20 lengths', 'Work on breathing', 'Stretch after'],
  skating: ['Helmet and guards packed', 'Warm up your edges', 'Try one new thing'],
  ballet: ['Bun and tights packed', 'Stretch before', 'Practise the combination'],
  bike_ride: ['Helmet on', 'Pick the route', 'Water bottle'],
  health_stretch_reset: ['Hamstrings', 'Hips', 'Shoulders'],
  relax: ['Foam roll', 'Legs up the wall', 'Slow breathing'],

  // Explore
  day_trip: ['Pack water and a snack', 'Take one photo', 'Tell the story at dinner'],
  air_show: ['Sunscreen and hat', 'Ear protection', 'Pick a favourite aircraft'],
  aviation_day: ['Ask a pilot one question', 'Sit in a cockpit', 'Bring home one thing'],
  museum: ['Pick 3 exhibits', 'One fact to share', 'Gift-shop budget agreed first'],
  library: ['Return the old ones', 'Choose 2 new', 'Read 10 minutes there'],
  fishing: ['Bait and licence packed', 'Cast 10 times', 'Release gently'],
  nature_walk: ['Spot 5 things', 'Bring a bag for treasures', 'No screens'],
  beach_day: ['Sunscreen every 2 hours', 'Swim with a buddy', 'Pack up your own things'],

  // Play and rest
  game_time: ['Timer on', 'Stop when it rings', 'Off an hour before bed'],
  break_quick: ['Water', 'Move', 'Back on time'],
  family: ['Everyone picks one thing', 'Phones away', 'Finish together'],
  free_time: ['Your pick', 'Try something not on a screen'],
  play_sister: ['Agree the game first', 'Take turns choosing', 'Tidy up together'],
  culture_story_circle: ['One story', 'Where is it from', 'Tell it back'],
  culture_festival_prep: ['Pick the festival', 'Make or decorate one thing', 'Help set it up'],
  cozy_reading: ['Blanket and cocoa', 'A book you chose', 'No stopping for a screen'],
  hot_cocoa: ['Make it yourself', 'Sit with someone', 'Wash the mug'],
  ice_cream: ['Walk or bike there', 'Try a new flavour', 'Bring the change back'],
  snow_play: ['Snow pants and mitts', 'Build or slide', 'Wet things on the rack after'],
  garden_time: ['Water', 'Pull 10 weeds', "Check what's growing"],

  // Helping hands. The chore TYPE comes from the paid pool, so the goals are
  // about doing the whole job rather than about which job it was.
  chores: ['Do the whole job', 'Put the tools back', 'Ask for a check'],
};
const ACTIVITY_OBJECTIVES_BY_CAT = {
  school: ['Homework', 'Reading', 'Review for a test'],
  active: ['Get moving', 'Stretch / cool-down'],
  free: ['Pick something new to try'],
  daily: ['Get it done before the next thing'],
  routine: [],
  custom: [],
  // An appointment is somebody else's time slot, so the goals are about
  // arriving ready for it and coming away knowing what happens next.
  appointment: ['Bring what I need', 'Ask my own question', 'Know what happens next'],
  // Rest is a state, not a task list — see CLAUDE.md: off days are valid, and
  // giving rest a checklist would turn it into another thing to perform.
  sleep: [],
  // Training blocks resolve through OBJECTIVES_BY_TAG, but a block can lose its
  // tag (a retired sport, an old import) and fall through to here.
  training: ['Warm-up', 'Give my best effort', 'Cool-down'],
};
/* Single entry point for "what goals can this block have" — training tags use
   the sport-specific lists (competition vs practice), everything else falls
   back to its own activity id, then its category. */
function getObjectivePresets(act, tag, isCompetition) {
  if (!act) return [];
  if (act.isTraining) {
    const table = isCompetition ? COMPETITION_OBJECTIVES_BY_TAG : OBJECTIVES_BY_TAG;
    // A sport the family added has no starter list of its own; the general set
    // is a better opening than an empty sheet, and every one of these is
    // editable. Custom tasks are already filtered per sport, so a new sport
    // builds its own list from the first session onward.
    return table[tag] || table.general || [];
  }
  return ACTIVITY_OBJECTIVES_BY_ID[act.id] || ACTIVITY_OBJECTIVES_BY_CAT[act.cat] || [];
}

/* REWARD_POOLS lived here: four pools of activities, three of which a child had
   to EARN before she could put them on her own day. The grant was never a
   level-up, whatever the surrounding prose said — it was a placed-block
   milestone, so the app's answer to "you have planned ten things" was to hand
   back the right to plan an eleventh kind of thing.

   Family Hero went first, for the reason recorded below. The same argument
   finishes the job: a child should not have to earn the right to eat after
   training, to stretch, or to hear a story about where her family is from.
   The thirteen activities are inlined into DEFAULT_ACTIVITIES with their ids
   unchanged, so every block that ever named one still resolves.

   The routine-checklist rewards (MORNING_LOCKED_REWARD,
   AFTERSCHOOL_CHECKLIST_REWARDS) are a DIFFERENT feature that happens to share
   the same prompt widget, and they stay: those earn an extra checklist item off
   a real streak rather than gating an activity. */
/* TUTORIAL_STARTER_CHOICES lived here — the three Family Hero chores the
   first-run overlay offered as a "starter" to unlock. Onboarding went with the
   unlock subsystem: its whole content was picking a locked chore, so with
   nothing locked there was nothing left for it to say. */
const AFTERSCHOOL_CHECKLIST_REWARDS = [
  { id:'ar1', text:'Champion Prep: 10-minute reading star mission' },
  { id:'ar3', text:'Calm Finish Bonus: 5-minute stretch reset' },
];
const MORNING_LOCKED_REWARD = { id:'mw1', text:'Warm water with breakfast' };

/* ── What a training block asks, on the block itself ──
   A training block used to render its whole packing list — ten mini
   checkboxes on skating, ten on swimming — on top of an icon, a name, a
   duration, a badge strip and a goal list. At the sizes a two-hour block
   actually gets, that is a wall of squares nobody reads.

   These four are what a parent and a kid actually review after a session, and
   they are the same four for every sport, so the block reads identically
   whatever is on it. The full packing list still exists; it lives in the
   training sheet, where there is room to tick ten things off. */
const TRAINING_CHECKS = [
  { id: 'ready',    icon: '🎒', label: 'Ready to go',   full: 'Kit packed and there on time' },
  { id: 'goal',     icon: '🎯', label: "Today's goal",  full: "Knew what today's session was for" },
  { id: 'attitude', icon: '💪', label: 'Attitude',      full: 'Gave it my best effort' },
  { id: 'cleanup',  icon: '🧽', label: 'Cleared up',    full: 'Packed up and cleared away after' },
];

/* Built-in activities — durationMin is default duration in minutes */
/* suitableTime values:
     'before-school' | 'school' | 'midday' | 'after-school' | 'evening' — the
       CLOCK bands, from the family's own schoolHours(). `school` and `midday`
       are the same hours on two different kinds of day.
     'weekend' — the kind of DAY, and nothing about the hour.

   'midday' was the band the vocabulary could not say, and it is why Lunch had
   nowhere to belong: zoneForGap answers 'weekend' for every minute of a
   non-school day, so at half past twelve the picker could tell a Saturday from
   a Tuesday and could not tell lunchtime from bedtime. slotPickerFit
   (js/17-ui-misc.js) scores against both dimensions.

   Used by the picker's suggestion row and by mascot recommendations.
   social: true = can be invited to sister via Sister Sync. */
const DEFAULT_ACTIVITIES = [
  /* ── Daily rhythm ──────────────────────────────────────────────
     The three that bracket a day. Evening grew to 30 and After-School shrank to
     20 because that is what they actually take; Tomorrow Ready is archived
     below, since "pack for tomorrow" is a LINE of the evening routine and two
     blocks for one job is how a child ends up ticking neither. */
  { id:'routine_morning', sub:'routine',     name:'Morning Routine',      icon:'🌅', cat:'routine', durationMin:30, isRoutine:true, routineId:'morning',     suitableTime:['before-school','weekend'] },
  { id:'routine_afterschool', sub:'routine', name:'After-School Routine', icon:'🎒', cat:'routine', durationMin:20, isRoutine:true, routineId:'afterschool', suitableTime:['after-school'] },
  { id:'routine_evening', sub:'routine',     name:'Evening Routine',      icon:'🌙', cat:'routine', durationMin:30, isRoutine:true, routineId:'evening',     suitableTime:['evening','weekend'] },

  /* ── Fuel and care ─────────────────────────────────────────────
     Lunch is weekends only: on a school day it sits inside the School band and
     is set by the lunch recess in the calendar, so offering it as a block to
     place was asking her to plan something the school had already planned. */
  { id:'breakfast', sub:'meals',  name:'Breakfast', icon:'🍳', cat:'daily', durationMin:20, suitableTime:['before-school','weekend'] },
  // The middle of the day on ANY kind of day — on a school day she eats it at
  // school, which is why this says midday rather than 'school'.
  { id:'lunch', sub:'meals',      name:'Lunch',     icon:'🥗', cat:'daily', durationMin:30, suitableTime:['midday','weekend'] },
  { id:'dinner', sub:'meals',     name:'Dinner',    icon:'🍽', cat:'daily', durationMin:45, suitableTime:['evening','weekend'] },
  // Renamed from "Recovery Fuel" — same id, so every block that ever named it
  // still resolves, and the name now says when it is for.
  { id:'health_recovery_fuel', sub:'meals', name:'Post-Training Snack', icon:'🍎', cat:'daily', durationMin:15, suitableTime:['after-school','evening'] },

  /* Appointments — a time somebody else set. Not moveable, and a week with one
     is shaped around it, which is why they are their own category rather than
     being filed under Daily. */
  { id:'appt_general', sub:'appts',     name:'Appointment',      icon:'🗓', cat:'appointment', travels:true, durationMin:60, suitableTime:['after-school'] },
  { id:'appt_medical', sub:'appts',     name:'Doctor / Dentist', icon:'🩺', cat:'appointment', travels:true, durationMin:60, suitableTime:['after-school'] },
  { id:'appt_haircut', sub:'appts',     name:'Haircut',          icon:'✂️', cat:'appointment', travels:true, durationMin:45, suitableTime:['after-school','weekend'] },
  { id:'appt_school_meet', sub:'appts', name:'School Meeting',   icon:'🧑‍🏫', cat:'appointment', travels:true, durationMin:30, suitableTime:['after-school','evening'] },
  { id:'appt_physio', sub:'appts',      name:'Physio',           icon:'🦴', cat:'appointment', travels:true, durationMin:45, suitableTime:['after-school'] },
  // The family sitting down together. Not the weekly meeting the app runs —
  // that is a parent tool; this is the hour it takes on the calendar.
  { id:'family_meeting', sub:'routine', group:'daily', name:'Family Meeting', icon:'🗣', cat:'daily', durationMin:30, suitableTime:['evening','weekend'] },

  /* ── Brain construction ────────────────────────────────────────
     Homework defaults to 45, not 90: at this age two 45s beat one 90, and the
     girls were already placing 45s by hand. Piano is 30 for the same reason —
     the old 60 is why a second 30-minute "Piano" kept getting created. */
  { id:'school_day', sub:'school', name:'School Day',        icon:'🏫', cat:'school', travels:true, durationMin:420, suitableTime:['school'] },
  { id:'homework', sub:'school',   name:'Homework',          icon:'📚', cat:'school', durationMin:45, suitableTime:['after-school','evening'] },
  { id:'reading', sub:'school',    name:'Reading',           icon:'📖', cat:'school', durationMin:30, suitableTime:['before-school','evening','weekend'] },
  { id:'math', sub:'school',       name:'Math Adventure',    icon:'🦘', cat:'school', durationMin:30, suitableTime:['after-school','evening','weekend'] },
  { id:'french', sub:'language',     name:'French Adventure',  icon:'🇫🇷', cat:'school', durationMin:30, suitableTime:['after-school','evening','weekend'] },
  { id:'chinese', sub:'language',    name:'Chinese Adventure', icon:'🇨🇳', cat:'school', durationMin:30, suitableTime:['after-school','evening','weekend'] },
  { id:'piano', sub:'arts',      name:'Piano Practice',    icon:'🎹', cat:'school', durationMin:30, suitableTime:['after-school','evening','weekend'] },
  { id:'singing', sub:'arts',    name:'Singing',           icon:'🎤', cat:'school', durationMin:30, suitableTime:['after-school','evening','weekend'] },
  // One Drawing, not one per medium: which kind is a goal on the block (see
  // ACTIVITY_OBJECTIVES_BY_ID), the way a Training block carries its focus.
  { id:'drawing', sub:'arts',    name:'Drawing',           icon:'🎨', cat:'school', durationMin:45, suitableTime:['after-school','weekend'] },
  // 🧵 rather than the scissors: ✂️ is Haircut, and on a short week card the
  // icon is sometimes the only thing drawn.
  { id:'craft', sub:'arts',      name:'Craft',             icon:'🧵', cat:'school', durationMin:60, suitableTime:['weekend'] },

  /* ── Body construction: training ───────────────────────────────
     A coached session. Body Maintenance is isTraining so it resolves the
     dryland objectives, but it carries no travel — it happens on the floor at
     home. */
  { id:'training', sub:'training',         name:'Training',         icon:'🏋️', cat:'training', durationMin:120, isTraining:true, travels:true, warmsUp:true, suitableTime:['after-school','weekend'] },
  { id:'competition', sub:'training',      name:'Competition',      icon:'🏆', cat:'training', durationMin:480, isTraining:true, isCompetition:true, travels:true, warmsUp:true, suitableTime:['weekend'] },
  { id:'body_maintenance', sub:'training', name:'Body Maintenance', icon:'⛹️', cat:'training', durationMin:30, isTraining:true, suitableTime:['evening','weekend'] },

  /* ── Everyday movement ─────────────────────────────────────────
     Hers, not a coach's. Swimming and Skating exist here AS WELL AS the
     training tags of the same names, and that is the point: a length of the
     pool on a Saturday is not the same ask as a coached hour, and filing both
     under Training made the hours chart unable to tell them apart. */
  { id:'swimming', sub:'move',  name:'Swimming',   icon:'🏊', cat:'active', travels:true, durationMin:60, suitableTime:['after-school','weekend'] },
  { id:'skating', sub:'move',   name:'Skating',    icon:'⛸', cat:'active', travels:true, durationMin:60, suitableTime:['after-school','weekend'] },
  { id:'ballet', sub:'move',    name:'Ballet',     icon:'🩰', cat:'active', travels:true, durationMin:60, suitableTime:['after-school'] },
  { id:'bike_ride', sub:'move', name:'Bike ride',  icon:'🚴', cat:'active', durationMin:45, suitableTime:['after-school','weekend'] },
  { id:'health_stretch_reset', sub:'move', name:'Stretch Reset', icon:'🤸', cat:'active', durationMin:15, suitableTime:['after-school','evening'] },
  /* Filed under Rest and earning nothing, deliberately. It sits with the
     movement activities on the page because that is where it belongs in her
     week, but rest that scores is rest turned into another thing to perform —
     see CLAUDE.md on off days being a valid state. */
  { id:'relax', sub:'move',     name:'Muscle Relaxation', icon:'🧘', cat:'sleep', group:'free', durationMin:30, suitableTime:['evening'] },

  /* ── Explore ───────────────────────────────────────────────────
     One-word names wherever one will do. "Nature Walk / Hike" and "Museum /
     Science Centre" both wrapped to two lines on a week card and ran straight
     through the duration under them — the grid gives a 90-minute block 65px and
     centres four rows in it, so a name that wraps has nowhere to go.

     Everything here travels. They carry an explicit group because `cat` is
     doing its other job — saying what colour the block is — and there is no
     outing colour: two questions, two tables. */
  { id:'day_trip', sub:'outings',     name:'Day Trip',                icon:'🎈', cat:'free',   group:'explore', travels:true, durationMin:360, suitableTime:['midday','weekend'], social:true },
  { id:'air_show', sub:'outings',     name:'Air Show',                icon:'✈️', cat:'free',   group:'explore', travels:true, durationMin:240, suitableTime:['weekend'], social:true },
  { id:'aviation_day', sub:'outings', name:'Aviation Day',           icon:'👩‍✈️', cat:'free', group:'explore', travels:true, durationMin:240, suitableTime:['weekend'], social:true },
  { id:'museum', sub:'outings',       name:'Museum',                 icon:'🏛', cat:'free',   group:'explore', travels:true, durationMin:180, suitableTime:['weekend'], social:true },
  // 📕 rather than 📚: Homework already has the stack of books.
  { id:'library', sub:'outings',      name:'Library Visit',           icon:'📕', cat:'free',   group:'explore', travels:true, durationMin:45,  suitableTime:['after-school','weekend'] },
  { id:'fishing', sub:'outings',      name:'Fishing Trip',            icon:'🎣', cat:'free',   group:'explore', travels:true, durationMin:240, suitableTime:['weekend'], social:true },
  { id:'nature_walk', sub:'outings',  name:'Nature Walk',            icon:'🥾', cat:'active', group:'explore', travels:true, durationMin:90,  suitableTime:['weekend'], social:true },

  /* ── Play and rest ─────────────────────────────────────────────  */
  { id:'game_time', sub:'playtime',   name:'Game Time',  icon:'🎮', cat:'free', durationMin:45, suitableTime:['after-school','weekend'] },
  { id:'break_quick', sub:'playtime', name:'Quick Break', icon:'☕', cat:'free', durationMin:15, suitableTime:['before-school','school','midday','after-school','evening','weekend'], quickBreak:true },
  { id:'family', sub:'playtime',      name:'Family Time', icon:'👨‍👩‍👧‍👦', cat:'free', durationMin:90, suitableTime:['evening','weekend'], social:true },
  { id:'free_time', sub:'playtime',   name:'Free Time',   icon:'🌤', cat:'free', durationMin:60, suitableTime:['after-school','weekend'] },
  { id:'play_sister', sub:'playtime', name:'Play together', icon:'⭐', cat:'free', durationMin:60, suitableTime:['weekend'], social:true },
  { id:'culture_story_circle', sub:'playtime',  name:'Culture Explorer Story', icon:'🏮', cat:'free', durationMin:25, suitableTime:['evening'] },
  { id:'culture_festival_prep', sub:'playtime', name:'Festival Prep Mission',  icon:'🥮', cat:'free', travels:true, durationMin:45, suitableTime:['weekend'], social:true },

  /* ── Helping hands ─────────────────────────────────────────────
     30, not 60: the paid pool's rows run 15–30 minutes, so a 60-minute default
     drew every chore at twice its real length on the hours charts — and
     schoolTemplate() was already placing this at 30, so the table and the
     template disagreed with each other.

     Family Hero is a CHORE, not a prize: whoever did the chore is the hero, and
     making the chore itself the reward said the opposite.

     ── And the four of them are now archived ──
     They named four specific jobs — set the table, prep the school bag, fold
     laundry, help in the kitchen — which is exactly what the PAID POOL already
     holds, row by row, with a price against each. So a chore could be planned
     twice under two names, and only one of them reached the money:
     mrChoreTagsForDay keys on `actId !== 'chores'`, so a Family Hero block was
     never a claimable chore at all. A child could do the washing-up under the
     Kitchen Helper Quest and be paid nothing for it.

     House Chore plus a pool row is the one way to say it. Archived rather than
     deleted, as always — every block that ever named one still resolves, still
     draws and still counts in the hours. */
  { id:'chores', sub:'helping',                name:'House Chore',                 icon:'🧹', cat:'daily', group:'chores', durationMin:30, suitableTime:['midday','after-school','evening','weekend'] },
  { id:'family_set_table', sub:'helping',      name:'Family Hero: Set the Table',   icon:'🍽', cat:'daily', group:'chores', durationMin:20, suitableTime:['evening','weekend'], archived:true },
  { id:'family_prep_bag', sub:'helping',       name:'Family Hero: Prep School Bag', icon:'🎒', cat:'daily', group:'chores', durationMin:15, suitableTime:['evening'], archived:true },
  { id:'family_laundry_fold', sub:'helping',   name:'Home Champion: Fold Laundry',  icon:'🧺', cat:'daily', group:'chores', durationMin:20, suitableTime:['weekend','evening'], archived:true },
  { id:'family_kitchen_helper', sub:'helping', name:'Kitchen Helper Quest',         icon:'🥕', cat:'daily', group:'chores', durationMin:20, suitableTime:['evening','weekend'], archived:true },

  /* ── Retired ───────────────────────────────────────────────────
     Archived, never deleted. getAllActivities drops these from every picker;
     findActivity still resolves them, so a block placed against one last March
     keeps its name, icon and colour instead of rendering as nothing at all —
     which is the silent failure the archive rule exists to stop.

     Each one was folded into something that says the same thing better:
     Tomorrow Ready into the evening routine's own "pack for tomorrow" line,
     Reading Star into Reading, Brush Art Play into Drawing's goals. Focus
     Sprint and Preview Power were study techniques dressed as activities. */
  { id:'acad_focus_sprint', sub:'school',        name:'Focus Sprint',           icon:'📘', cat:'school', durationMin:25, archived:true, suitableTime:['after-school','evening'] },
  { id:'acad_preview_power', sub:'school',       name:'Preview Power',          icon:'🧠', cat:'school', durationMin:20, archived:true, suitableTime:['evening','weekend'] },
  { id:'acad_reading_star', sub:'school',        name:'Reading Star',           icon:'📚', cat:'school', durationMin:30, archived:true, suitableTime:['after-school','evening','weekend'] },
  { id:'health_pack_tomorrow', sub:'routine',     name:'Tomorrow Ready',         icon:'👜', cat:'daily', group:'routine', durationMin:15, archived:true, suitableTime:['evening'] },
  { id:'culture_calligraphy_play', sub:'arts', name:'Brush Art Play',         icon:'🖌️', cat:'free', durationMin:30, archived:true, suitableTime:['weekend'] },
];

/* Routine preset checklists. Items: {id, text, timerSec (optional)} */
const ROUTINE_PRESETS = {
  morning: {
    title: 'Morning Routine',
    icon: '🌅',
    items: [
      { id:'m1', icon:'🏃', text:'Morning exercise' },
      { id:'m2', icon:'🥣', text:'Healthy breakfast (carb/protein/fat) + vitamin' },
      { id:'m3', icon:'🪥', text:'Brush teeth', timerSec: 120 },
      { id:'m4', icon:'🧼', text:'Wash face / skincare / hair / clean bathroom' },
      { id:'m5', icon:'🛏️', text:'Make bed / clean bedroom / take out garbage / lights off' },
      { id:'m6', icon:'👕', text:'Put on clothes for the weather' },
    ]
  },
  afterschool: {
    title: 'After-School Routine',
    icon: '🎒',
    items: [
      { id:'a1', icon:'🎒', text:'Bring back all gear & clean the car seat' },
      { id:'a2', icon:'🧼', text:'Wash hands (and face if needed)' },
      { id:'a3', icon:'📦', text:'Put everything back in its correct spot' },
      { id:'a4', icon:'🍱', text:'Empty school bag / lunchbox in sink / finish water bottle' },
      { id:'a5', icon:'✏️', text:'Finish school/home work (ask for help if needed)' },
      { id:'a6', icon:'🏋️', text:'Prep for training / get ready for today & tomorrow' },
    ]
  },
  evening: {
    title: 'Evening Routine',
    icon: '🌙',
    items: [
      { id:'e1', icon:'🏋️', text:'Sports training prep (gear / battery levels)' },
      { id:'e2', icon:'🧸', text:'Put away toys & books / clean the table' },
      { id:'e3', icon:'🪥', text:'Brush teeth', timerSec: 120 },
      { id:'e4', icon:'🧼', text:'Wash face / skincare / hair / clean bathroom' },
      { id:'e5', icon:'💡', text:'Turn off lights in empty rooms' },
    ]
  }
};

/* An activity's `season` is one season or several — Garden Time runs through
   spring AND summer — so every reader goes through these two rather than
   comparing the field directly. A plain string still works unchanged. */
function inSeason(act, season) {
  if (!act || !act.season) return true;
  return [].concat(act.season).includes(season || getCurrentSeason());
}
function seasonLabel(act) {
  return [].concat((act && act.season) || []).join(' or ');
}

/* Seasonal/rare activities — unlock by season */
function getCurrentSeason() {
  const m = formatDayKey(toDayKeyInZone(new Date())).getMonth(); // 0..11, app timezone
  if ([2,3,4].includes(m)) return 'spring';
  if ([5,6,7].includes(m)) return 'summer';
  if ([8,9,10].includes(m)) return 'autumn';
  return 'winter';
}
const SEASONAL_ACTIVITIES = [
  { id:'cozy_reading', sub:'seasonal',  name:'Cozy Reading',     icon:'🧣', cat:'free',   durationMin:45,  season:'winter', suitableTime:['evening'] },
  { id:'hot_cocoa', sub:'seasonal',     name:'Hot Cocoa Time',   icon:'☕', cat:'free',   durationMin:20,  season:'winter', suitableTime:['evening','weekend'], social:true },
  /* Snow and the garden are physical, but they are seasonal TREATS rather than
     training, so they carry an explicit group and stay out of Move — otherwise
     `cat:'active'` would file a snowball fight as exercise she is owed XP for. */
  { id:'snow_play', sub:'seasonal',     name:'Snow Adventure',   icon:'⛄', cat:'active', group:'free', durationMin:60, season:'winter', suitableTime:['weekend'], social:true },
  { id:'beach_day', sub:'outings',     name:'Beach Day',        icon:'🏖', cat:'free',   group:'explore', travels:true, durationMin:180, season:'summer', suitableTime:['weekend'], social:true },
  { id:'ice_cream', sub:'seasonal',     name:'Ice Cream Run',    icon:'🍦', cat:'free',   travels:true, durationMin:30, season:'summer', suitableTime:['evening','weekend'], social:true },
  // Two seasons, which is what inSeason() exists for — the field took a single
  // string and the garden does not stop in June.
  { id:'garden_time', sub:'seasonal',   name:'Garden Time',      icon:'🌻', cat:'active', group:'free', durationMin:45, season:['spring','summer'], suitableTime:['weekend'], social:true },
  /* Archived: Rainy Day Craft is Craft, and Leaf Hike is a Nature Walk in
     October. Both keep resolving for every block that ever named them. */
  { id:'rainy_craft', sub:'seasonal',   name:'Rainy Day Craft',  icon:'🎨', cat:'free',   durationMin:60, season:'spring', archived:true, suitableTime:['after-school','weekend','evening'], social:true },
  { id:'leaf_hike', sub:'outings',     name:'Leaf Hike',        icon:'🍂', cat:'active', durationMin:90, season:'autumn', archived:true, suitableTime:['weekend'], social:true },
];

/* The two girls, named and iconed in one place. The pair
   `p === 'jenn' ? '🐥 Jenn' : '🦊 Jess'` is written out in about ten files; this
   is not a sweep of those, it is somewhere for new code to read them from
   rather than making it eleven. */
const KID_LABEL = {
  jenn: { icon: '🐥', name: 'Jenn' },
  jess: { icon: '🦊', name: 'Jess' },
};
function kidLabel(p) { return KID_LABEL[p] || { icon: '👤', name: String(p || '') }; }

/* ── The school year ──────────────────────────────────────────────────────────
   One source of truth for "is there school today, and when". Before this, two
   places each answered it and disagreed: SCHOOL_TEMPLATE placed the School Day
   block at 8:00am while the day timeline's coloured band drew SCHOOL from 9am,
   so a child who applied the template saw her school block start an hour before
   the band that was supposed to mean school. Both now derive from here.

   Minutes are offsets from 6AM (START_MIN), the unit every block uses.
   Deliberately not synced state: this is a calendar, it is the same on every
   device, and putting it in the shipped code costs nothing to set up.

   Replace all three each August. Past SCHOOL_TERM.nextStart the app stops
   claiming to know — it falls back to plain weekday rules rather than inventing
   holidays for a year it has never been told about. */
/* The SHIPPED fallback. What the app actually uses is schoolHours()
   (js/05-helpers.js), which prefers whatever a parent has set in the portal —
   including a lunch recess, which this never had. These three constants stay as
   the answer for a family that has set nothing, and as the thing an August
   without a parent nearby still falls back to. */
const SCHOOL_HOURS = { startMin: 120, endMin: 540, days: [1, 2, 3, 4, 5] };  // Mon–Fri, 8:00am–3:00pm

const SCHOOL_TERM = { start: '2026-08-31', end: '2027-06-25', nextStart: '2027-08-30' };

/* Weekdays inside the term with no school: statutory holidays, breaks, and
   staff learning days. Weekends are not listed — SCHOOL_HOURS.days covers them,
   and neither is the summer, which is the gap between `end` and `nextStart`. */
const NO_SCHOOL_DAYS = [
  '2026-09-07',                                            // Labour Day
  '2026-09-18',                                            // staff learning day
  '2026-09-30',                                            // Truth and Reconciliation
  '2026-10-09',                                            // staff learning day
  '2026-10-12',                                            // Thanksgiving
  '2026-11-09', '2026-11-10',                              // fall break
  '2026-11-11',                                            // Remembrance Day
  '2026-11-26', '2026-11-27',                              // staff learning days
  '2026-12-21', '2026-12-22', '2026-12-23', '2026-12-24',  // holiday break
  '2026-12-25', '2026-12-28', '2026-12-29', '2026-12-30',
  '2026-12-31', '2027-01-01',
  '2027-01-15',                                            // staff learning day
  '2027-02-15',                                            // Family Day
  '2027-02-16',                                            // family break
  '2027-02-17',                                            // teacher lieu day
  '2027-02-18', '2027-02-19',                              // teachers' convention
  '2027-03-11', '2027-03-12',                              // staff learning days
  '2027-03-26',                                            // Good Friday
  '2027-03-29',                                            // Easter Monday
  '2027-03-30', '2027-03-31', '2027-04-01', '2027-04-02',  // spring break
  '2027-04-23',                                            // staff learning day
  '2027-05-21',                                            // staff learning day
  '2027-05-24',                                            // Victoria Day
  '2027-06-11',                                            // staff learning day
];

/* School day / weekend templates (minute-based from 6AM). The school block
   derives from the school hours so it can never drift from the coloured band.

   A FUNCTION, not a const, and that is the whole reason this changed: school
   hours are something a parent sets now (schoolHours(), js/05-helpers.js), and
   a const evaluated when this file loads can only ever see the shipped
   fallback. Anything that wants the school-day shape has to ask at the moment
   it needs it. */
function schoolTemplate() {
  const h = schoolHours();
  return [
    {actId:'routine_morning',   startMin: 60,  durationMin: 30},   // 7:00am
    {actId:'breakfast',         startMin: 90,  durationMin: 30},   // 7:30am
    {actId:'school_day',        startMin: h.startMin,
                                durationMin: h.endMin - h.startMin},
    {actId:'routine_afterschool',startMin: h.endMin, durationMin: 30},
    {actId:'piano',             startMin: 570, durationMin: 60},   // 3:30pm
    {actId:'dinner',            startMin: 690, durationMin: 60},   // 5:30pm
    {actId:'chores',            startMin: 750, durationMin: 30},   // 6:30pm
    {actId:'family',            startMin: 780, durationMin: 90},   // 7:00pm
    {actId:'routine_evening',   startMin: 870, durationMin: 20},   // 8:30pm
  ];
}
const WEEKEND_TEMPLATE = [
  {actId:'routine_morning',   startMin: 120, durationMin: 30},   // 8:00am
  {actId:'breakfast',         startMin: 150, durationMin: 30},   // 8:30am
  {actId:'training',          startMin: 240, durationMin: 120, tag:'skating'},  // 10:00am
  {actId:'lunch',             startMin: 390, durationMin: 30},   // 12:30pm
  {actId:'relax',             startMin: 450, durationMin: 60},   // 1:30pm
  {actId:'piano',             startMin: 540, durationMin: 60},   // 3:00pm
  {actId:'dinner',            startMin: 690, durationMin: 60},   // 5:30pm
  {actId:'family',            startMin: 780, durationMin: 120},  // 7:00pm
  {actId:'routine_evening',   startMin: 870, durationMin: 20},   // 8:30pm
];

