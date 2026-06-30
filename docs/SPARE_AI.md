# Pin-Specific Spare Planning

StrikePath AI now creates a spare plan immediately after a first-ball leave.

## Workflow

1. The bowler logs the first ball and taps the pins still standing.
2. The API identifies the lead pin, cluster center, and whether the leave is a known split.
3. StrikePath creates a straighter cross-lane line with exact feet, laydown, arrow target, downlane point, finish board, speed, and equipment guidance.
4. The web app automatically switches to Spare mode and applies the line to the next-shot draft.
5. The purple AI overlay appears on the lane for review and can be edited before logging.

## Plan behavior

- Single pins receive a direct center-pin line.
- Multi-pin leaves use the nearest front pin as the lead pin and shade toward the remaining cluster.
- Common splits are labeled as lower-confidence conversion attempts.
- Outside single pins and splits recommend a plastic/polyester spare ball when one exists in the arsenal.
- A second-ball miss does not create a third-shot spare plan for the same frame.

The geometry is an explainable coaching estimate. It is not a guarantee of spare conversion and remains editable by the bowler or coach.
