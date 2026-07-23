// Weekly-Planner — shared mutable state and edit-session variables.
// Extracted verbatim from index.html (classic script, global scope).
/* ════════════════════════════════════════════════════════════════
   STATE
════════════════════════════════════════════════════════════════ */
let state = {
  profiles: {
    jenn: { weeks:{}, customActivities:[], dayMoods:{}, blockMoods:{}, activityCounts:{}, activityHours:{}, goals:[], todos:[], mascotName:'', mascotIntroShown:false },
    jess: { weeks:{}, customActivities:[], dayMoods:{}, blockMoods:{}, activityCounts:{}, activityHours:{}, goals:[], todos:[], mascotName:'', mascotIntroShown:false },
  },
  shared: {
    levelRules: [],
    challenges: [],
    customTasks: [],
    invites: [],
    routineTemplates: [],  // custom routines: {id, title, icon, items:[{id,text,timerSec}]}
    parentPin: '1234',     // soft child-lock, parent-configurable (NOT a security boundary)
    tombstones: {},        // {[blockId]: deletedAtMs} — keeps deletions from resurrecting on merge
  }
};

let profile = null;
let parentViewing = 'jenn';
let weekOffset = 0;
let currentDayKey = null;
let selectedActivity = null;
let dayViewMode = 'timeline';        // 3b: 'timeline' | 'checklist'
let dcOpenGaps = new Set();          // 3b: which free-gaps are expanded (by start-min)
let timelinePlacementGuideEl = null;
let dayLandscapeChromeRaf = 0;
let pendingStartMin = null;
let editingBlockId = null;
let syncDayIdx = 0;
let weekView = 'full';
let currentZone = 'all';
let currentTrayFilter = 'all';
let activeTimers = {}; // itemKey -> {remaining, interval}
let pendingFocusBlockId = null;
let pendingFocusAttempts = 0;
let activeStopwatchTick = null;
let kidQuickBlockId = null;
let kidRoutineStopwatchTick = null;
let kidTrainingStopwatchTick = null;
let dayLandscapeFocusPane = null;
let currentTimelineGuideY = null;
let dayTopbarCompactBound = false;
const MORNING_UNLOCK_ITEM = { id:'m_unlock_warm_water', text:'Warm water before breakfast' };
const AFTERSCHOOL_REWARD_ITEMS = [
  { id:'a_unlock_helper', text:'Reward pick: Family Hero helper task (your choice)' },
  { id:'a_unlock_focus', text:'Reward pick: Focus Sprint bonus (15 min)' },
  { id:'a_unlock_culture', text:'Reward pick: Culture Explorer mini time' },
];

let ts  = { durationMin:120, colour: CAT_HEX.training, tag:'skating', objectives:[], note:'', repeat:false, repeatDays: [], travelBuffer:false, getReadyBuffer:false, warmupBuffer:false, gearState:{}, travelBufMin:15, getReadyBufMin:15, warmupBufMin:20 };
let as_ = { durationMin:60,  colour: COLOURS[0], note:'', repeat:false, repeatDays: [], travelBuffer:false, travelBufMin:15, choreTags: [] };

function isParent() { return profile === 'parent'; }
function activeProfile() { return isParent() ? parentViewing : profile; }

