export type GuideCategory = "Lane basics" | "Targeting" | "Adjustments" | "Spares" | "AR tracking" | "Mobile setup";

export interface BowlingGuide {
  id: string;
  category: GuideCategory;
  title: string;
  summary: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  duration: string;
  steps: string[];
  tip: string;
}

export const guideCategories: GuideCategory[] = ["Lane basics", "Targeting", "Adjustments", "Spares", "AR tracking", "Mobile setup"];

export const bowlingGuides: BowlingGuide[] = [
  {
    id: "board-numbering",
    category: "Lane basics",
    title: "Read board numbers for your bowling hand",
    summary: "Understand why the same physical board has a mirrored display number for right- and left-handed bowlers.",
    level: "Beginner",
    duration: "3 min",
    steps: [
      "Board 1 begins at the gutter on your bowling-hand side.",
      "Right-handed bowlers count from the right gutter toward the left.",
      "Left-handed bowlers count from the left gutter toward the right.",
      "StrikePath stores one physical lane coordinate and mirrors only the displayed number, so historical paths remain consistent.",
    ],
    tip: "Confirm your bowling hand in Profile before starting a live session or AR analysis.",
  },
  {
    id: "approach-dots",
    category: "Lane basics",
    title: "Use approach locator dots correctly",
    summary: "Line your feet up consistently using the dot rows on the approach.",
    level: "Beginner",
    duration: "4 min",
    steps: [
      "Find the row of approach dots that matches your normal starting distance from the foul line.",
      "Use the inside edge of your sliding shoe as the repeatable reference point.",
      "The near-foul-line dots align with the five-board arrow intervals; back approach guides can vary by center.",
      "Record the board number, not only the dot, because back approach layouts and starting distances can vary between centers.",
    ],
    tip: "Take one practice setup without throwing and verify your shoe edge against the displayed board number.",
  },
  {
    id: "approach-depth",
    category: "Lane basics",
    title: "Track starting depth on the approach",
    summary: "Record both the board under your sliding foot and how far behind the foul line you begin.",
    level: "Beginner",
    duration: "4 min",
    steps: [
      "Use the Feet marker for your lateral board position.",
      "Drag the same marker forward or backward to record starting distance behind the foul line.",
      "Larger distance values mean you are starting farther from the foul line.",
      "Use the AI approach suggestion only as a small starting adjustment, then verify it with one controlled shot.",
    ],
    tip: "Moving back can help create more natural speed; moving forward can help reduce excess speed, but tempo should remain smooth.",
  },
  {
    id: "arrows-targets",
    category: "Targeting",
    title: "Count arrows from your side",
    summary: "Translate the seven lane arrows into exact board targets.",
    level: "Beginner",
    duration: "4 min",
    steps: [
      "The seven arrows are commonly aligned with boards 5, 10, 15, 20, 25, 30, and 35.",
      "Count the first arrow from your bowling-hand gutter, not from the opposite side.",
      "The second arrow is board 10 from your side, and the center arrow is board 20.",
      "Use the exact board input when your ball crosses between arrows.",
    ],
    tip: "Focus on one small target board instead of watching the pins during the delivery.",
  },
  {
    id: "laydown-target-breakpoint",
    category: "Targeting",
    title: "Separate laydown, target, and breakpoint",
    summary: "Track three different locations instead of treating the entire ball path as one target.",
    level: "Intermediate",
    duration: "5 min",
    steps: [
      "Laydown is where the ball first contacts the lane.",
      "Target is where the ball crosses your chosen arrow or target zone.",
      "Breakpoint is the farthest outside point before the ball changes direction toward the pocket.",
      "Pocket is the observed entry board near the head pin.",
    ],
    tip: "A good adjustment starts by knowing which part of the path actually changed.",
  },
  {
    id: "two-and-one",
    category: "Adjustments",
    title: "Make a 2-and-1 angular move",
    summary: "Move the feet two boards and the target one board in the same physical direction.",
    level: "Intermediate",
    duration: "4 min",
    steps: [
      "Confirm the miss occurred on a trustworthy delivery.",
      "Move your feet two boards in the recommended direction.",
      "Move the target one board in the same direction.",
      "Repeat one controlled shot before making another change.",
    ],
    tip: "Do not chase a single poor release. Confirm the trend before moving.",
  },
  {
    id: "parallel-move",
    category: "Adjustments",
    title: "Know when to use a parallel move",
    summary: "Shift feet and target by the same number of boards while preserving the launch angle.",
    level: "Intermediate",
    duration: "4 min",
    steps: [
      "Use a parallel move when you want to relocate the whole line without changing its shape much.",
      "Move feet and target equally in the same physical direction.",
      "Keep speed and release intent consistent for a useful comparison.",
      "Use StrikePath's Whole Path control to preview the change.",
    ],
    tip: "Parallel moves are especially useful when the lane develops a new track area but the breakpoint shape still looks good.",
  },
  {
    id: "single-pin-spares",
    category: "Spares",
    title: "Build a repeatable single-pin spare system",
    summary: "Use a straighter trajectory and a predictable spare ball when possible.",
    level: "Beginner",
    duration: "6 min",
    steps: [
      "Select Spare mode after the first ball leaves pins standing.",
      "Choose a plastic or low-hook ball when available.",
      "Reduce axis rotation and project the ball more directly at the pin.",
      "Save the feet and target combination that converts each corner pin reliably.",
    ],
    tip: "A spare system should be simple enough to repeat under pressure.",
  },
  {
    id: "split-leaves",
    category: "Spares",
    title: "Read split and multi-pin leaves",
    summary: "Use the pin diagram to preserve the exact standing-pin pattern.",
    level: "Intermediate",
    duration: "5 min",
    steps: [
      "Tap only the pins still standing after the first shot.",
      "Confirm the pin numbers before saving the leave.",
      "Choose whether the goal is conversion, count, or avoiding a chop.",
      "Add a note when the preferred path differs from a normal single-pin spare line.",
    ],
    tip: "The exact leave matters more than the total number of pins left.",
  },
  {
    id: "camera-position",
    category: "AR tracking",
    title: "Position the camera for AR tracking",
    summary: "Create a stable, centered view that gives the browser the best chance to follow the ball.",
    level: "Beginner",
    duration: "5 min",
    steps: [
      "Place the phone behind the bowler and outside the swing path.",
      "Keep both lane edges, the foul line, arrows, and pin deck visible.",
      "Use a tripod, shelf, or stable phone clamp instead of handholding.",
      "Avoid zooming during the shot and keep the camera stationary until the ball reaches the pins.",
    ],
    tip: "A stable 1080p or 720p clip usually produces better motion analysis than a shaky high-resolution clip.",
  },
  {
    id: "ar-calibration",
    category: "AR tracking",
    title: "Calibrate the lane corners",
    summary: "Correct the four cyan lane points before running assisted tracking.",
    level: "Intermediate",
    duration: "5 min",
    steps: [
      "Pause on a frame where the lane edges are clear.",
      "Set Near left and Near right at the visible lane edges closest to the camera.",
      "Set Far left and Far right near the pin-deck lane edges.",
      "Run assisted tracking, then correct the four gold path points before saving.",
    ],
    tip: "Small calibration errors near the pin deck can create large breakpoint and pocket-board errors.",
  },
  {
    id: "mobile-live-session",
    category: "Mobile setup",
    title: "Run a live session from a phone",
    summary: "Use the mobile workflow without covering the lane view or losing your place.",
    level: "Beginner",
    duration: "4 min",
    steps: [
      "Open Live Session and choose the current shot workflow.",
      "Use tap-to-place for quick board entry, then fine-tune with the number fields.",
      "Use the pin leave selector immediately after the shot.",
      "Keep the app installed as a PWA for faster access and offline shot queuing.",
    ],
    tip: "Landscape orientation is best for AR capture; portrait is usually easier for logging scores and leaves.",
  },
  {
    id: "tablet-coaching",
    category: "Mobile setup",
    title: "Use a tablet as a coaching station",
    summary: "Create a larger touch workspace for lane visualization, ball changes, and athlete review.",
    level: "Intermediate",
    duration: "4 min",
    steps: [
      "Place the tablet on a stable stand near the settee area.",
      "Use split-screen or landscape mode for the lane editor and shot form.",
      "Review the recommendation and equipment overlay before the next delivery.",
      "Open the saved session afterward for a cleaner post-game review.",
    ],
    tip: "Keep brightness moderate to preserve battery during long practice sessions.",
  },
];
