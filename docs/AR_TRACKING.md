# StrikePath AI AR Tracking Phase 2 Beta

## What is included

The web application includes AR Tracking at `/app/ar-tracking`.

The current Phase 2 beta supports:

- Rear-camera preview through supported mobile browsers
- Video recording through `MediaRecorder` when available
- Video upload fallback
- Four-point lane perspective calibration
- Browser-assisted lane-corner suggestions
- AR lane polygon and perspective guide overlays
- Local frame-difference motion analysis for ball-track candidates
- Confidence scoring and full-track visualization
- Automatic Laydown, Target, Breakpoint, and Pocket key-point suggestions
- Drag-to-correct calibration and shot-path points
- Estimated board positions
- Approximate release-to-pin speed
- Approximate entry angle
- Association with an existing bowling session
- Saved analysis records in PostgreSQL
- Recent capture history and deletion

The source video remains local to the device in this beta. The browser processes sampled frames locally and sends only calibration coordinates, path coordinates, derived telemetry, confidence, and metadata to the API when the user saves.

## What assisted tracking means

This release uses deterministic browser-side motion analysis. It is not a trained bowling-ball detector.

The analyzer:

1. Samples frames from the recorded or uploaded clip.
2. Masks analysis to the calibrated lane polygon.
3. Compares neighboring frames for motion.
4. Groups motion regions into candidate objects.
5. Prefers candidates with continuous down-lane movement.
6. Smooths the retained track.
7. Selects points near 2, 15, 44, and 59 feet.
8. Calculates a confidence score.
9. Presents all results for manual correction.

Reflections, moving people, camera shake, dark footage, zoom changes, and occlusion can produce false candidates. Every result must remain editable.

## Camera placement

For the clearest lane mapping:

1. Put the phone behind the bowler and outside the active approach.
2. Keep the foul line, lane edges, and pin deck visible.
3. Mount or brace the phone so it does not move during the shot.
4. Use landscape orientation.
5. Avoid digital zoom after calibration.
6. Keep the camera centered with the lane when possible.
7. Record a short clip containing one shot and minimal background motion.

Never place equipment where it creates a tripping hazard or interferes with another bowler.

## Suggested workflow

1. Record or upload a short shot clip.
2. Pause on a frame where the empty lane is clearly visible.
3. Select **Suggest lane corners** or mark the four corners manually.
4. Drag each cyan corner to the actual visible lane boundary.
5. Select **Auto-track ball motion**.
6. Review the confidence score and full cyan track.
7. Drag the four gold key points to correct any error.
8. Review boards, speed, and entry angle.
9. Save the analysis.

## Calibration order

The manual order remains:

1. Near left
2. Near right
3. Far left
4. Far right

The key shot points are:

1. Laydown
2. Target at the arrows
3. Breakpoint
4. Pocket entry

## Railway deployment

The API service runs `alembic upgrade head` during startup. This update adds migration `0003_ar_assisted_tracking.py`, which stores:

- Tracking mode
- Confidence
- Assisted track samples
- Estimated speed
- Estimated entry angle

Deploy the API service before the web service.

Live camera access requires a secure browser context. Use the Railway-generated HTTPS domain or a custom HTTPS domain. Localhost also works for development.

## Performance considerations

- Analysis is limited to the first 12 seconds of a clip.
- A maximum of 96 frames are sampled.
- Frames are reduced to 240 × 135 for analysis.
- Processing yields between frames so the UI remains responsive.
- Older or low-power phones may take longer.

## Production media storage phase

Do not store user videos in PostgreSQL or an application volume for the long-term product.

Recommended production flow:

1. The API creates a short-lived object-storage upload URL.
2. The browser uploads directly to S3-compatible storage.
3. The API stores only the object key and metadata.
4. A background worker runs a trained detector.
5. Derived tracking results are persisted in PostgreSQL.
6. Retention rules delete source videos after the chosen privacy window.

## Next computer-vision phase

The next major phase should use a trained detector rather than general motion alone:

- Bowling-ball object detection
- Lane-edge and foul-line segmentation
- Reflection rejection
- Bowler and pinsetter occlusion handling
- Camera-motion stabilization
- Automatic clip trimming
- Higher-confidence board crossings
- Dedicated speed and entry-angle models
- Model version and quality telemetry

## Native AR companion phase

A dedicated iOS and Android application can later add:

- ARKit and ARCore lane anchoring
- Device-motion stabilization
- Higher-frame-rate capture
- Real-time recommended-line overlays
- Native background video processing
- On-device ML acceleration

## Privacy and safety requirements

Before commercial release:

- Ask permission before recording other people.
- Display a clear recording indicator.
- Provide video deletion and retention controls.
- Keep audio disabled by default.
- Encrypt stored videos and restrict access by user and organization.
- Allow users to opt out of model-training use.
- Document that all estimates are coaching aids, not certified lane measurements.
