# Approach Tracking and Handedness

StrikePath stores lane boards in one physical coordinate system and records the bowler's handedness on every new shot. The interface mirrors board numbers for left-handed profiles while preserving the physical location of the shot.

## Starting position

Each shot now stores two approach coordinates:

- `feet_board`: lateral board position.
- `feet_depth_ft`: distance behind the foul line, from 0.5 to 15 feet.

The Feet marker can be dragged horizontally and vertically. Horizontal movement changes the board; vertical movement changes the distance behind the foul line in half-foot increments.

## AI approach suggestion

The recommendation engine provides a small forward/backward starting adjustment based on the last shot:

- Slow delivery or a speed drop: suggest starting 0.5 feet farther back.
- Fast delivery or a speed increase: suggest starting 0.5 feet closer.
- Pulled or missed-target delivery: hold the approach depth and repeat.
- Stable execution and speed: hold the current depth.

These are coaching starting points, not guarantees. The user should verify each change with a controlled shot.

## Migration

Migration `0004_approach_tracking.py` adds:

- `shots.handedness`
- `shots.feet_depth_ft`
- `recommendations.feet_depth_delta_ft`
- `recommendations.suggested_feet_depth_ft`
- `recommendations.approach_title`
- `recommendations.approach_explanation`
