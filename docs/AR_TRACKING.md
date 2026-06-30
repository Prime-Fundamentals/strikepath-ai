# StrikePath AI AR Tracking Beta

## What is included

The web application now includes an AR Tracking Beta at `/app/ar-tracking`.

The beta supports:

- Rear-camera preview through the browser
- Video recording where the browser supports `MediaRecorder`
- Video upload fallback
- Four-point lane perspective calibration
- AR lane polygon and perspective guide overlays
- Manual marking of Laydown, Target, Breakpoint, and Pocket
- Conversion of visual points into estimated board positions
- Association with an existing bowling session
- Saved AR analysis records in PostgreSQL
- Recent capture history and deletion

The captured video remains local to the device in this release. The API stores calibration coordinates, path coordinates, board estimates, metadata, and notes. This avoids placing large video files inside the API container or PostgreSQL.

## Camera placement

For the clearest lane mapping:

1. Put the phone behind the bowler and outside the active approach.
2. Keep the entire lane visible, including the foul line and pin deck.
3. Mount or brace the phone so it does not move during the shot.
4. Use landscape orientation.
5. Avoid zooming after lane calibration.
6. Keep the camera centered with the lane when possible.

Never place equipment where it creates a tripping hazard or interferes with another bowler.

## Calibration order

Tap the visible lane corners in this order:

1. Near left
2. Near right
3. Far left
4. Far right

After calibration, mark:

1. Laydown
2. Target at the arrows
3. Breakpoint
4. Pocket entry

The board result is a perspective estimate. The user should review it before using the values as official shot telemetry.

## Railway deployment

The API service automatically runs `alembic upgrade head` at startup. Deployment of this update creates the `ar_tracking_captures` table through migration `0002_ar_tracking.py`.

Live camera access requires a secure browser context. Use the Railway-generated HTTPS domain or a custom HTTPS domain. Localhost also works for development.

## Media storage production phase

Do not store user videos in PostgreSQL or an attached application volume for the long-term product.

Recommended production flow:

1. The API creates a short-lived upload URL.
2. The browser uploads the video directly to S3-compatible object storage.
3. The API stores only the object key and metadata.
4. A background worker analyzes the video.
5. Derived tracking results are persisted in PostgreSQL.
6. Retention rules delete source videos after the chosen privacy window.

## Computer-vision automation roadmap

### Phase 2: Assisted detection

- Detect lane edges and foul line automatically
- Suggest the four calibration corners
- Detect moving-ball candidates with background subtraction
- Track ball centroid frame-by-frame
- Present confidence and allow manual correction
- Estimate release-to-pin duration

### Phase 3: Model-based tracking

- Train a lane/ball detector from labeled StrikePath captures
- Detect occlusion and reflections
- Estimate board crossing at multiple distances
- Estimate speed and entry angle
- Track multiple lane conditions and camera placements

### Phase 4: Native AR companion

- Dedicated iOS and Android capture application
- Real-time overlays and device motion stabilization
- ARKit and ARCore lane anchoring
- Higher-frame-rate video analysis
- Live recommended-line display

## Privacy and safety requirements

Before commercial release:

- Ask permission before recording other people.
- Display a clear recording indicator.
- Provide video deletion and retention controls.
- Avoid collecting audio by default.
- Encrypt stored videos and restrict access by user and organization.
- Document that estimated boards are coaching aids, not certified lane measurements.
