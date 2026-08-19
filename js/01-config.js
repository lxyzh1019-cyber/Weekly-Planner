// Weekly-Planner — data model: constants, colours, presets, templates.
// Extracted verbatim from index.html (classic script, global scope).
/* ════════════════════════════════════════════════════════════════
   DATA MODEL
════════════════════════════════════════════════════════════════ */
const LS_KEY = 'weeklyplanner-v3';
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

const CAT_COLOUR = {
  sleep:'var(--cat-sleep)', school:'var(--cat-school)', active:'var(--cat-active)',
  free:'var(--cat-free)', daily:'var(--cat-daily)', custom:'var(--cat-custom)',
  training:'var(--cat-training)', routine:'var(--cat-routine)',
  appointment:'var(--cat-appointment)'
};
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

/* ── One filter table ──
   The day screen's activity picker and the tray each carried their own copy of
   this list, and they had drifted: the picker was missing Seasonal, and neither
   offered Rest or a kid's own custom activities even though both are choosable
   when you create one — anything filed there could only ever be found under
   "All". Both read this now, so a category added here appears everywhere.

   `seasonal` and `custom` match on a flag rather than a category, which is why
   filtering goes through activityMatchesFilter instead of comparing a.cat. */
const ACTIVITY_FILTERS = [
  { id:'daily',       label:'🍽 Daily' },
  { id:'routine',     label:'🌅 Routines' },
  { id:'school',      label:'📚 Learning' },
  { id:'active',      label:'🏃 Active' },
  { id:'training',    label:'🏋️ Competitive Sports' },
  { id:'appointment', label:'🩺 Appointments' },
  { id:'free',        label:'🎮 Free' },
  { id:'sleep',       label:'😴 Rest' },
  { id:'custom',      label:'✨ Mine' },
  { id:'seasonal',    label:'🌟 Seasonal' },
];
function activityMatchesFilter(act, filterId) {
  if (!act) return false;
  if (!filterId || filterId === 'all') return true;
  if (filterId === 'seasonal') return !!act._seasonal;
  // "Mine" means made by this family, wherever it was filed. A custom activity
  // saved as, say, Free would otherwise be findable only under Free — and the
  // point of the chip is to find the thing you made.
  if (filterId === 'custom') return !!act.custom || act.cat === 'custom';
  // Category is the source of truth — isTraining is a shared UI mechanism
  // (objectives/gear/tags) between Competitive Sports and Competition, not a category.
  return act.cat === filterId;
}

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
  piano: ['Scales / technique', 'New piece — learn notes', 'Polish a piece', 'Sight-reading'],
  french: ['Vocabulary', 'Listening practice', 'Conversation practice', 'Reading'],
  chinese: ['Vocabulary / characters', 'Listening practice', 'Conversation practice', 'Reading'],
  math: ['Times tables / facts', 'Word problems', 'Homework review', 'New concept'],
  chores: ['Finish assigned chore(s)', 'Do it without being asked twice', 'Clean up after'],
  relax: ['Deep breathing', 'Stretch', 'Quiet time — no screens'],
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

const REWARD_POOLS = {
  family: [
    { id:'family_set_table', name:'Family Hero: Set the Table', icon:'🍽', cat:'daily', durationMin:20, suitableTime:['evening','weekend'] },
    { id:'family_prep_bag', name:'Family Hero: Prep School Bag', icon:'🎒', cat:'daily', durationMin:15, suitableTime:['evening'] },
    { id:'family_laundry_fold', name:'Home Champion: Fold Laundry', icon:'🧺', cat:'daily', durationMin:20, suitableTime:['weekend','evening'] },
    { id:'family_kitchen_helper', name:'Kitchen Helper Quest', icon:'🥕', cat:'daily', durationMin:20, suitableTime:['evening','weekend'] },
  ],
  academic: [
    { id:'acad_focus_sprint', name:'Focus Sprint', icon:'📘', cat:'school', durationMin:25, suitableTime:['after-school','evening'] },
    { id:'acad_preview_power', name:'Preview Power', icon:'🧠', cat:'school', durationMin:20, suitableTime:['evening','weekend'] },
    { id:'acad_reading_star', name:'Reading Star', icon:'📚', cat:'school', durationMin:30, suitableTime:['after-school','evening','weekend'] },
  ],
  health: [
    { id:'health_recovery_fuel', name:'Recovery Fuel', icon:'🍎', cat:'daily', durationMin:15, suitableTime:['after-school','evening'] },
    { id:'health_stretch_reset', name:'Stretch Reset', icon:'🤸', cat:'active', durationMin:15, suitableTime:['after-school','evening'] },
    { id:'health_pack_tomorrow', name:'Tomorrow Ready', icon:'👜', cat:'daily', durationMin:15, suitableTime:['evening'] },
  ],
  culture: [
    { id:'culture_story_circle', name:'Culture Explorer Story', icon:'🏮', cat:'free', durationMin:25, suitableTime:['evening','weekend'] },
    { id:'culture_festival_prep', name:'Festival Prep Mission', icon:'🥮', cat:'free', durationMin:30, suitableTime:['weekend','evening'] },
    { id:'culture_calligraphy_play', name:'Brush Art Play', icon:'🖌️', cat:'free', durationMin:30, suitableTime:['weekend'] },
  ],
};
const TUTORIAL_STARTER_CHOICES = REWARD_POOLS.family.slice(0, 3);
const AFTERSCHOOL_CHECKLIST_REWARDS = [
  { id:'ar1', text:'Champion Prep: 10-minute reading star mission' },
  { id:'ar2', text:'Family Hero Bonus: organize tomorrow clothes' },
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
/* suitableTime values: 'before-school' | 'school' | 'after-school' | 'evening' | 'weekend'
   Used by mascot recommendations.
   social: true = can be invited to sister via Sister Sync. */
const DEFAULT_ACTIVITIES = [
  { id:'breakfast',  name:'Breakfast',        icon:'🍳', cat:'daily',    durationMin:30, suitableTime:['before-school','weekend'] },
  { id:'lunch',      name:'Lunch',             icon:'🥗', cat:'daily',    durationMin:30, suitableTime:['school','weekend'] },
  { id:'dinner',     name:'Dinner',            icon:'🍽', cat:'daily',    durationMin:60, suitableTime:['evening','weekend'] },
  { id:'school_day', name:'School Day',        icon:'🏫', cat:'school',   durationMin:420, suitableTime:['school'] }, // 7h
  { id:'french',     name:'French Adventure',  icon:'🇫🇷', cat:'school',   durationMin:60, suitableTime:['after-school','weekend','evening'] },
  { id:'chinese',    name:'Chinese Adventure', icon:'🇨🇳', cat:'school',   durationMin:60, suitableTime:['after-school','weekend','evening'] },
  { id:'math',       name:'Math Adventure',    icon:'🦘', cat:'school',   durationMin:60, suitableTime:['after-school','weekend','evening'] },
  { id:'training',   name:'Training',          icon:'🏋️', cat:'training', durationMin:120, isTraining:true, suitableTime:['after-school','weekend'] },
  { id:'competition', name:'Competition',      icon:'🏆', cat:'training', durationMin:480, isTraining:true, isCompetition:true, suitableTime:['weekend'] },
  // Filed under Rest, not Active. It is the opposite of a workout, and Rest was
  // a category with a colour, a chip and nothing in it.
  { id:'relax',      name:'Muscle Relaxation', icon:'🧘', cat:'sleep',    durationMin:60, suitableTime:['after-school','evening','weekend'] },
  // Appointments — a time somebody else set. Not moveable, and a week with one
  // is shaped around it, which is why they are their own category rather than
  // being filed under Daily.
  { id:'appt_general',    name:'Appointment',      icon:'🗓', cat:'appointment', durationMin:60, suitableTime:['after-school','school','weekend'] },
  { id:'appt_medical',    name:'Doctor / Dentist', icon:'🩺', cat:'appointment', durationMin:60, suitableTime:['after-school','school','weekend'] },
  { id:'appt_haircut',    name:'Haircut',          icon:'✂️', cat:'appointment', durationMin:45, suitableTime:['after-school','weekend'] },
  { id:'appt_school_meet', name:'School Meeting',  icon:'🧑‍🏫', cat:'appointment', durationMin:60, suitableTime:['after-school','school'] },
  { id:'break_quick', name:'Quick Break',     icon:'☕', cat:'free',     durationMin:15, suitableTime:['before-school','school','after-school','evening','weekend'], quickBreak:true },
  { id:'piano',      name:'Piano Practice',    icon:'🎹', cat:'school',   durationMin:60, suitableTime:['after-school','evening','weekend'] },
  { id:'chores',     name:'House Chore',       icon:'🧹', cat:'daily',    durationMin:60, suitableTime:['after-school','evening','weekend'] },
  { id:'family',     name:'Family Time',       icon:'👨‍👩‍👧‍👦', cat:'free', durationMin:120, suitableTime:['evening','weekend'], social:true },
  ...Object.values(REWARD_POOLS).flat().map(a => ({ ...a, rewardLocked: true })),
  // Routines
  { id:'routine_morning',   name:'Morning Routine',      icon:'🌅', cat:'routine', durationMin:30, isRoutine:true, routineId:'morning',     suitableTime:['before-school','weekend'] },
  { id:'routine_afterschool', name:'After-School Routine', icon:'🎒', cat:'routine', durationMin:30, isRoutine:true, routineId:'afterschool', suitableTime:['after-school'] },
  { id:'routine_evening',   name:'Evening Routine',      icon:'🌙', cat:'routine', durationMin:20, isRoutine:true, routineId:'evening',     suitableTime:['evening','weekend'] },
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

/* Seasonal/rare activities — unlock by season */
function getCurrentSeason() {
  const m = formatDayKey(toDayKeyInZone(new Date())).getMonth(); // 0..11, app timezone
  if ([2,3,4].includes(m)) return 'spring';
  if ([5,6,7].includes(m)) return 'summer';
  if ([8,9,10].includes(m)) return 'autumn';
  return 'winter';
}
const SEASONAL_ACTIVITIES = [
  { id:'cozy_reading',  name:'Cozy Reading',     icon:'📖', cat:'free',   durationMin:60,  season:'winter', suitableTime:['after-school','evening','weekend'] },
  { id:'hot_cocoa',     name:'Hot Cocoa Time',   icon:'☕', cat:'free',   durationMin:30,  season:'winter', suitableTime:['after-school','evening','weekend'], social:true },
  { id:'snow_play',     name:'Snow Adventure',   icon:'⛄', cat:'active', durationMin:60,  season:'winter', suitableTime:['weekend','after-school'], social:true },
  { id:'beach_day',     name:'Beach Day',        icon:'🏖', cat:'free',   durationMin:180, season:'summer', suitableTime:['weekend'], social:true },
  { id:'ice_cream',     name:'Ice Cream Run',    icon:'🍦', cat:'free',   durationMin:30,  season:'summer', suitableTime:['after-school','weekend'], social:true },
  { id:'garden_time',   name:'Garden Time',      icon:'🌻', cat:'active', durationMin:60,  season:'spring', suitableTime:['after-school','weekend'], social:true },
  { id:'rainy_craft',   name:'Rainy Day Craft',  icon:'🎨', cat:'free',   durationMin:60,  season:'spring', suitableTime:['after-school','weekend','evening'], social:true },
  { id:'leaf_hike',     name:'Leaf Hike',        icon:'🍂', cat:'active', durationMin:90,  season:'autumn', suitableTime:['weekend'], social:true },
];

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
   derives from SCHOOL_HOURS so it can never drift from the coloured band. */
const SCHOOL_TEMPLATE = [
  {actId:'routine_morning',   startMin: 60,  durationMin: 30},   // 7:00am
  {actId:'breakfast',         startMin: 90,  durationMin: 30},   // 7:30am
  {actId:'school_day',        startMin: SCHOOL_HOURS.startMin,
                              durationMin: SCHOOL_HOURS.endMin - SCHOOL_HOURS.startMin},
  {actId:'routine_afterschool',startMin: SCHOOL_HOURS.endMin, durationMin: 30},
  {actId:'piano',             startMin: 570, durationMin: 60},   // 3:30pm
  {actId:'dinner',            startMin: 690, durationMin: 60},   // 5:30pm
  {actId:'chores',            startMin: 750, durationMin: 30},   // 6:30pm
  {actId:'family',            startMin: 780, durationMin: 90},   // 7:00pm
  {actId:'routine_evening',   startMin: 870, durationMin: 20},   // 8:30pm
];
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

