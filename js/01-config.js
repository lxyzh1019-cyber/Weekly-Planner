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

const CAT_COLOUR = {
  sleep:'var(--cat-sleep)', school:'var(--cat-school)', active:'var(--cat-active)',
  free:'var(--cat-free)', daily:'var(--cat-daily)', custom:'var(--cat-custom)',
  training:'var(--cat-training)', routine:'var(--cat-routine)'
};
const CAT_HEX = {
  sleep:'#c3aed6', school:'#6fb1fc', active:'#ff7b54',
  free:'#95d5b2', daily:'#ffd166', custom:'#ff9eb5', training:'#ef476f',
  routine:'#80cbc4', competition:'#f4a340'
};

/* Training tags + sport-specific starter objectives. Each topic carries its
   own icon and background colour so a Skating block reads differently from a
   Swimming or Dryland one at a glance, not just by its text label. */
const TRAINING_TAGS = [
  { id:'skating',  label:'⛸ Skating',  name:'Skating',  icon:'⛸', colour:'#8a6fd0' },
  { id:'swimming', label:'🏊 Swimming', name:'Swimming', icon:'🏊', colour:'#2f9fd0' },
  { id:'dryland',  label:'💪 Dryland', name:'Dryland',  icon:'💪', colour:'#e08a3a' },
  { id:'general',  label:'🏃 General', name:'Training', icon:'🏃', colour:'#ef476f' },
];
function getTrainingTopic(tag) {
  return TRAINING_TAGS.find(t => t.id === tag) || TRAINING_TAGS[3];
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
  { id:'relax',      name:'Muscle Relaxation', icon:'🧘', cat:'active',   durationMin:60, suitableTime:['after-school','evening','weekend'] },
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
      { id:'m1', text:'Morning exercise' },
      { id:'m2', text:'Healthy breakfast (carb/protein/fat) + vitamin' },
      { id:'m3', text:'Brush teeth', timerSec: 120 },
      { id:'m4', text:'Wash face / skincare / hair / clean bathroom' },
      { id:'m5', text:'Make bed / clean bedroom / take out garbage / lights off' },
      { id:'m6', text:'Put on clothes for the weather' },
    ]
  },
  afterschool: {
    title: 'After-School Routine',
    icon: '🎒',
    items: [
      { id:'a1', text:'Bring back all gear & clean the car seat' },
      { id:'a2', text:'Wash hands (and face if needed)' },
      { id:'a3', text:'Put everything back in its correct spot' },
      { id:'a4', text:'Empty school bag / lunchbox in sink / finish water bottle' },
      { id:'a5', text:'Finish school/home work (ask for help if needed)' },
      { id:'a6', text:'Prep for training / get ready for today & tomorrow' },
    ]
  },
  evening: {
    title: 'Evening Routine',
    icon: '🌙',
    items: [
      { id:'e1', text:'Sports training prep (gear / battery levels)' },
      { id:'e2', text:'Put away toys & books / clean the table' },
      { id:'e3', text:'Brush teeth', timerSec: 120 },
      { id:'e4', text:'Wash face / skincare / hair / clean bathroom' },
      { id:'e5', text:'Turn off lights in empty rooms' },
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

/* School day / weekend templates (minute-based from 6AM) */
const SCHOOL_TEMPLATE = [
  {actId:'routine_morning',   startMin: 60,  durationMin: 30},   // 7:00am
  {actId:'breakfast',         startMin: 90,  durationMin: 30},   // 7:30am
  {actId:'school_day',        startMin: 120, durationMin: 420},  // 8:00am–3:00pm
  {actId:'routine_afterschool',startMin:540, durationMin: 30},   // 3:00pm
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

