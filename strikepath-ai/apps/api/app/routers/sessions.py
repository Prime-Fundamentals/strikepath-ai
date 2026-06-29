from datetime import datetime, timezone
from statistics import mean

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import get_current_user
from ..models import BowlingSession, Shot, User
from ..schemas import AnalyticsRead, DashboardRead, SessionCreate, SessionDetail, SessionRead

router = APIRouter(prefix="/api", tags=["sessions"])


def get_owned_session(session_id: int, user_id: int, db: Session, with_shots: bool = False) -> BowlingSession:
    query = select(BowlingSession).where(BowlingSession.id == session_id, BowlingSession.user_id == user_id)
    if with_shots:
        query = query.options(selectinload(BowlingSession.shots).selectinload(Shot.recommendation))
    session = db.scalar(query)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


def session_read(session: BowlingSession, shot_count: int | None = None) -> SessionRead:
    payload = SessionRead.model_validate(session)
    payload.shot_count = shot_count if shot_count is not None else len(session.shots)
    return payload


@router.get("/sessions", response_model=list[SessionRead])
def list_sessions(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.execute(
        select(BowlingSession, func.count(Shot.id))
        .outerjoin(Shot)
        .where(BowlingSession.user_id == user.id)
        .group_by(BowlingSession.id)
        .order_by(BowlingSession.started_at.desc())
    ).all()
    return [session_read(session, count) for session, count in rows]


@router.post("/sessions", response_model=SessionRead, status_code=status.HTTP_201_CREATED)
def create_session(payload: SessionCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Keep one active session per bowler to prevent accidental split history.
    active = db.scalar(select(BowlingSession).where(BowlingSession.user_id == user.id, BowlingSession.status == "active"))
    if active:
        return session_read(active, len(active.shots))
    session = BowlingSession(user_id=user.id, **payload.model_dump())
    db.add(session)
    db.commit()
    db.refresh(session)
    return session_read(session, 0)


@router.get("/sessions/{session_id}", response_model=SessionDetail)
def get_session(session_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    session = get_owned_session(session_id, user.id, db, with_shots=True)
    base = SessionRead.model_validate(session).model_dump()
    base["shot_count"] = len(session.shots)
    base["shots"] = session.shots
    return SessionDetail(**base)


@router.post("/sessions/{session_id}/finish", response_model=SessionRead)
def finish_session(session_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    session = get_owned_session(session_id, user.id, db)
    session.status = "completed"
    session.ended_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(session)
    return session_read(session)


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(session_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    session = get_owned_session(session_id, user.id, db)
    db.delete(session)
    db.commit()


@router.get("/dashboard", response_model=DashboardRead)
def dashboard(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sessions = list(db.scalars(select(BowlingSession).where(BowlingSession.user_id == user.id).order_by(BowlingSession.started_at.desc())))
    session_ids = [item.id for item in sessions]
    shots = list(db.scalars(select(Shot).where(Shot.session_id.in_(session_ids)))) if session_ids else []
    strike_rate = (sum(1 for shot in shots if shot.pinfall == 10) / len(shots) * 100) if shots else 0
    desired = 17.5 if user.handedness == "right" else 22.5
    pocket_rate = (sum(1 for shot in shots if abs(shot.pocket_board - desired) <= 0.75) / len(shots) * 100) if shots else 0
    from ..models import BowlingBall
    arsenal_count = db.scalar(select(func.count(BowlingBall.id)).where(BowlingBall.user_id == user.id)) or 0
    active = next((item for item in sessions if item.status == "active"), None)
    counts = dict(db.execute(select(Shot.session_id, func.count(Shot.id)).where(Shot.session_id.in_(session_ids)).group_by(Shot.session_id)).all()) if session_ids else {}
    return DashboardRead(
        active_session=session_read(active, counts.get(active.id, 0)) if active else None,
        total_sessions=len(sessions),
        total_shots=len(shots),
        strike_rate=round(strike_rate, 1),
        pocket_rate=round(pocket_rate, 1),
        arsenal_count=arsenal_count,
        recent_sessions=[session_read(item, counts.get(item.id, 0)) for item in sessions[:5]],
    )


@router.get("/sessions/{session_id}/analytics", response_model=AnalyticsRead)
def session_analytics(session_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    session = get_owned_session(session_id, user.id, db, with_shots=True)
    shots = session.shots
    desired = 17.5 if user.handedness == "right" else 22.5
    speeds = [shot.speed_mph for shot in shots if shot.speed_mph is not None]
    strikes = sum(1 for shot in shots if shot.pinfall == 10)
    pocket_hits = sum(1 for shot in shots if abs(shot.pocket_board - desired) <= 0.75)
    accurate = sum(1 for shot in shots if abs(shot.target_board - round(shot.target_board)) <= 0.5)
    recs = [shot.recommendation for shot in shots if shot.recommendation and (shot.recommendation.feet_delta or shot.recommendation.target_delta)]
    successes = 0
    for idx, shot in enumerate(shots[:-1]):
        if shot.recommendation and (shot.recommendation.feet_delta or shot.recommendation.target_delta):
            before = abs(shot.pocket_board - desired)
            after = abs(shots[idx + 1].pocket_board - desired)
            if after < before:
                successes += 1
    game_numbers = sorted({shot.game_number for shot in shots})
    games = []
    for game_no in game_numbers:
        game_shots = [shot for shot in shots if shot.game_number == game_no]
        games.append({
            "game": game_no,
            "shots": len(game_shots),
            "strike_rate": round(sum(1 for shot in game_shots if shot.pinfall == 10) / len(game_shots) * 100, 1),
            "average_pinfall": round(mean(shot.pinfall for shot in game_shots), 2),
        })
    return AnalyticsRead(
        session_id=session.id,
        shot_count=len(shots),
        strike_rate=round(strikes / len(shots) * 100, 1) if shots else 0,
        pocket_rate=round(pocket_hits / len(shots) * 100, 1) if shots else 0,
        average_pinfall=round(mean(shot.pinfall for shot in shots), 2) if shots else 0,
        average_speed=round(mean(speeds), 2) if speeds else None,
        target_accuracy=round(accurate / len(shots) * 100, 1) if shots else 0,
        adjustment_success_rate=round(successes / len(recs) * 100, 1) if recs else 0,
        board_miss_average=round(mean(abs(shot.pocket_board - desired) for shot in shots), 2) if shots else 0,
        games=games,
    )
