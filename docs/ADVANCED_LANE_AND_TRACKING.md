# Advanced Lane Studio and Automatic Tracking

This release adds an advanced lane workspace designed for desktop, phone, and tablet use.

## Lane views

- **Overhead:** exact marker editing, board alignment, approach depth, and AI line comparison.
- **Bowler perspective:** a visual approach-side rendering of the same simulated trajectory.
- **Pin-deck zoom:** enlarged pin rack, standing-pin state, impact zone, lead pin, and spare entry board.

## Editing controls

- Undo and redo retain up to 40 lane edits for the current shot draft.
- Snapping can be set to Free, quarter-board, half-board, or full-board movement.
- Pan / pinch mode supports touch panning, two-finger zoom, and mouse-wheel zoom.
- Reset View restores 100% zoom and centered positioning.

## Physics preview

The client-side simulation estimates skid, hook, and roll using:

- Ball speed
- Rev rate
- Axis rotation
- Axis tilt
- Coverstock family
- Surface grit
- RG and differential
- Oil pattern length
- Bowler handedness

The model produces a sampled 60-foot path, predicted breakpoint and pocket boards, phase distances, hook strength, and estimated entry angle. This is an explainable coaching simulation and is not a certified lane measurement.

## Automatic camera tracking

The AR Tracking page now includes a one-tap **Automatic full-shot detection** action. It:

1. Suggests the four visible lane boundaries.
2. Analyzes frame-to-frame motion inside the lane polygon.
3. Tracks the most continuous forward-moving ball candidate.
4. Detects release, arrows, breakpoint, and pocket events.
5. Estimates speed, entry angle, board positions, and confidence.
6. Leaves every result editable before saving.

The current browser detector remains sensitive to camera movement, reflections, people crossing the lane, low contrast balls, and incomplete lane visibility. A trained ball detector remains the recommended production upgrade for high-confidence automatic tracking.
