# Simple AI Next-Shot Workflow

The Live Session page is designed for bowlers who do not want to manage technical telemetry on every shot.

## Default easy workflow

1. Confirm the ball used.
2. Enter speed only when available.
3. Mark the pins left standing.
4. Log the shot.
5. Review the newly generated AI setup.
6. Select **Show AI suggestion** to place the suggested approach and lane line on the board.
7. Select **Use this setup** to copy the suggested feet board, starting depth, laydown, target, breakpoint, pocket, and speed into the next-shot draft.

## Visual behavior

- The cyan line is the current shot setup.
- The purple dashed line is shown only when the user requests the AI suggestion.
- Historical shot traces are intentionally hidden from the default lane view to avoid clutter.
- Detailed draggable markers are shown only in Edit Line mode.
- The feet marker moves both left/right and forward/backward.

## Per-shot updates

Every successful shot entry creates a fresh recommendation stored with that shot. The AI setup card identifies the source shot number and updates automatically after each logged entry.

## Recommendation fields

The AI setup includes:

- feet board
- starting distance behind the foul line
- laydown board
- arrow target
- breakpoint
- pocket entry board
- suggested speed
- confidence
- optional ball-change idea

The recommendation system is deterministic and explainable. It is not a replacement for a certified coach or a direct lane-oil measurement system.
