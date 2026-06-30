# StrikePath Pro Bowler Knowledge Base

StrikePath uses deterministic, explainable coaching rules rather than pretending a generic model can perfectly predict every lane. The recommendation engine records the evidence used for each suggestion and keeps every setup editable.

## Strike-line foundations

### Pocket target

- Right-handed pocket: between the 1 and 3 pins.
- Left-handed pocket: between the 1 and 2 pins.
- The internal physical target corresponds to approximately board 17.5 from the bowler's side.
- A six-degree entry angle is treated as an ideal coaching reference, not a guaranteed carry result.

### Pattern-length starting point

The knowledge engine uses pattern length minus 31 as a starting estimate for the board where the ball exits the oil pattern. This is not treated as an infallible breakpoint rule. The result is adjusted using:

- Speed
- Rev rate
- Coverstock family
- Surface grit
- RG and differential when available
- Actual observed breakpoint
- Actual pocket result

### Adjustment hierarchy

1. Reject obvious execution misses before changing the lane line.
2. Correct a clear speed or approach-tempo problem first.
3. Use a small parallel move for a small or breakpoint-related miss.
4. Use a 2-and-1 angular move for a moderate high/light miss.
5. Use a 3-and-2 move for a large trusted miss.
6. Raise confidence when the same reaction repeats.
7. Consider a ball change only after the lane move is verified.

## Spare knowledge

- Identify the key pin: the standing pin closest to the bowler.
- Single pins use a direct center-pin line.
- Multi-pin leaves aim at the key pin and shade toward the remaining cluster.
- Common splits receive lower confidence and prioritize clean lead-pin contact.
- Corner pins and splits prefer a plastic/polyester spare ball when available.
- The generated geometry follows the same cross-lane principles as a 3-6-9 spare system while targeting the exact leave.

## Sources used to design the rules

- USBC, “Making In-Game Adjustments” — 2-and-1 angular adjustment.
  https://bowl.com/welcome/making-in-game-adjustments-8c6f1af3abe01df729e6970093e720cf
- USBC, “Picking Up the Spare” and coaching fundamentals — key-pin and 3-6-9 spare guidance.
  https://bowl.com/welcome/picking-up-the-spare
  https://bowl.com/coaching/fundamental/
- USBC, “Striking 101” — right- and left-handed strike pockets.
  https://bowl.com/striking-101-6ab7e4e97bc59c15e4a927a2bd09ce7d
- Kegel, “Understanding 3 Point Targeting with Quiet Eye” — pattern length minus 31 as a starting exit-board estimate.
  https://www.kegel.net/articles/3-point-targeting-with-quiet-eye
- IBPSIA / USBC Coaching, “Entry Angle” series — pocket board and entry-angle concepts.
  https://ibpsia.com/entry-angle-part-1/
  https://ibpsia.com/entry-angle-part-2/

## Important limitation

Lane topography, oil volume, oil shape, carrydown, surface wear, release consistency, and pinsetter differences can materially change reaction. StrikePath recommendations are coaching starting points that must be verified by the next controlled shot.
