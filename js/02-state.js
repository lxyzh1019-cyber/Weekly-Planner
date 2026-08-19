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
/* The leftmost column of the day screen. currentDayKey is the day being edited
   — the two are the same at one column, and differ the moment a tap lands in
   another column of a 2- or 3-day view. Everything downstream (placeBlock,
   setDayMood, clearDay, the edit sheet) still reads currentDayKey, which is why
   the anchor is a separate name rather than a redefinition of it. */
let dayViewAnchorKey = null;
let selectedActivity = null;
/* dayViewMode was here. The day screen has one layout now — the timeline —
   so there is no mode to hold, and nothing to carry between visits. The 1/2/3
   control is a column count, not a mode: nothing about how a day is read or
   edited changes with it, and it is a localStorage preference, not state. */
let timelinePlacementGuideEl = null;
/* dayLandscapeChromeRaf lived here, throttling the day screen's chrome
   measurement. The measurement is gone — one scroller needs no arithmetic. */
let pendingStartMin = null;
let editingBlockId = null;
let syncDayIdx = 0;
let weekView = 'timegrid';   // Day Blocks is the front page of the week
/* currentZone lived here, for the morning/afternoon/evening day filters.
   Those are gone and the day is always shown whole — see js/08-day-view.js. */
/* currentTrayFilter lived here, for the activity rail's category chips. The
   rail is gone; the placement picker keeps its own filter (slotPickerFilter). */
let activeTimers = {}; // itemKey -> {remaining, interval}
let pendingFocusBlockId = null;
let pendingFocusAttempts = 0;
let activeStopwatchTick = null;
let kidQuickBlockId = null;
let kidRoutineStopwatchTick = null;
let kidTrainingStopwatchTick = null;
/* dayLandscapeFocusPane lived here, dimming one pane of the day screen while
   the other was in use. There is one pane now — the schedule. */
let currentTimelineGuideY = null;
let dayTopbarCompactBound = false;
const MORNING_UNLOCK_ITEM = { id:'m_unlock_warm_water', text:'Warm water before breakfast' };
const AFTERSCHOOL_REWARD_ITEMS = [
  { id:'a_unlock_helper', text:'Reward pick: Family Hero helper task (your choice)' },
  { id:'a_unlock_focus', text:'Reward pick: Focus Sprint bonus (15 min)' },
  { id:'a_unlock_culture', text:'Reward pick: Culture Explorer mini time' },
];

let ts  = { durationMin:120, colour: CAT_HEX.training, tag:'skating', objectives:[], note:'', repeat:false, repeatDays: [], travelBuffer:false, getReadyBuffer:false, warmupBuffer:false, gearState:{}, travelBufMin:15, getReadyBufMin:15, warmupBufMin:20 };
let as_ = { durationMin:60,  colour: COLOURS[0], note:'', repeat:false, repeatDays: [], travelBuffer:false, travelBufMin:15, choreTags: [], objectives: [] };
let customTaskContext = 'training'; // 'training' | 'activity' — which sheet opened the custom-goal editor

function isParent() { return profile === 'parent'; }
function activeProfile() { return isParent() ? parentViewing : profile; }

