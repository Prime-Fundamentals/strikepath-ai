# StrikePath AI Lane Upgrade Roadmap

## Completed in this update

- Local drag preview with one commit on pointer release.
- `requestAnimationFrame` throttling for pointer movement.
- Smooth unsnapped movement while dragging and exact board snapping on release.
- Whole-line dragging only activates in Whole Line mode.
- Unique SVG definition IDs to prevent gradient and path collisions.
- A true-width pin rack based on 12-inch pin-spot spacing across an approximately 41.5-inch lane.
- A separate pin-deck region so the path ends at the head-pin row rather than the back of the deck.
- Top-down pin graphics sized to the lane width rather than tiny side-view pin icons.

## Recommended Phase 1 — Editor usability

1. Undo and redo for every marker movement.
2. Pinch-to-zoom and two-finger pan on phones and tablets.
3. Optional snap modes: free, quarter-board, half-board, and whole-board.
4. Lock individual markers so moving the whole path preserves selected points.
5. Compare current, previous, and AI lines with explicit visibility toggles.
6. Haptic feedback when a marker crosses a full board or arrow.

## Recommended Phase 2 — Lane realism

1. Toggle between coaching view and true-scale view.
2. Perspective lane view for bowlers who prefer the view from the approach.
3. Accurate pin-deck zoom panel with remaining-pin impact zones.
4. House, sport, and custom oil-pattern overlays.
5. Carrydown and depletion heatmaps based on logged traffic.
6. Center-specific lane topography and lane-pair notes.

## Recommended Phase 3 — Shot intelligence

1. Use release speed, rev rate, tilt, rotation, ball surface, and oil pattern together.
2. Learn each bowler's actual miss tendencies and preferred moves.
3. Score whether previous recommendations improved pocket position.
4. Distinguish execution misses from lane-transition misses.
5. Suggest ball changes only after line and execution evidence agree.
6. Pin-specific spare targeting with confidence and alternate routes.

## Recommended Phase 4 — Camera and AR

1. Automatic foul-line, arrow, and lane-edge calibration.
2. Ball detection trained specifically for bowling footage.
3. Release, target, breakpoint, speed, and entry-angle extraction.
4. Live AR overlay for the recommended line.
5. Tripod and handheld stabilization modes.
6. On-device processing for privacy and low latency.

## Recommended Phase 5 — Commercial coaching platform

1. Coach and athlete accounts.
2. Shared sessions with comments and assignments.
3. Team dashboards and practice plans.
4. Bowling-center and pro-shop organization accounts.
5. Subscription plans and usage limits.
6. Exportable reports and branded coach summaries.
