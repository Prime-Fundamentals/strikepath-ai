# Handedness, Lane Markings, Guides, and Mobile UX

## Coordinate policy

StrikePath stores every lane position in one physical coordinate system:

- Physical board 1 is the right edge of the lane.
- Physical board 39 is the left edge of the lane.
- Right-handed users see the stored value directly.
- Left-handed users see `40 - physicalBoard`.

This allows a user to change their bowling-hand profile without moving historical paths or corrupting lane-state calculations.

## Profile behavior

The Profile page updates the authenticated user's `handedness` through:

```text
PATCH /api/auth/me
```

The selected hand controls:

- Live-session default line
- Shot telemetry board fields
- Interactive lane board labels
- Marker labels
- Recommendation board overlays
- Shot-history pocket values
- AR board estimates and saved-capture presentation

## Lane marking presentation

The interactive lane now separates:

- Pin deck with the No. 1 pin closest to the bowler
- Lane dots at the near target zone
- Seven arrows at five-board intervals
- Foul line
- Two approach locator-dot rows aligned to five-board intervals
- Hand-specific board numbers

## Guides & Tips

The app includes `/app/guides` with searchable categories:

- Lane basics
- Targeting
- Adjustments
- Spares
- AR tracking
- Mobile setup

## Mobile and tablet layout

At tablet and phone widths:

- The desktop sidebar becomes a bottom navigation bar.
- Dashboard, Live, AR, and Guides remain one tap away.
- Arsenal, Sessions, Analytics, Profile, and Sign out appear in a More sheet.
- AR controls use 44px-or-larger touch targets.
- The AR video workspace becomes portrait-friendly.
- The camera controls remain close to the bottom navigation while reviewing a shot.
