from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import get_current_user
from ..models import BowlingBall, BowlingSession, Recommendation, Shot, User
from ..schemas import LaneStateRead, ShotCreate, ShotRead
from ..services.lane_model import build_lane_state
from ..services.recommendation import recommend

router = APIRouter(prefix="/api", tags=["shots"])


def owned_session(session_id: int, user_id: int, db: Session) -> BowlingSession:
    session = db.scalar(select(BowlingSession).where(BowlingSession.id == session_id, BowlingSession.user_id == user_id))
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("/sessions/{session_id}/shots", response_model=ShotRead, status_code=status.HTTP_201_CREATED)
def create_shot(session_id: int, payload: ShotCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    session = owned_session(session_id, user.id, db)
    if session.status != "active":
        raise HTTPException(status_code=409, detail="This session has already been completed")
    if payload.ball_id:
        ball = db.scalar(select(BowlingBall).where(BowlingBall.id == payload.ball_id, BowlingBall.user_id == user.id))
        if not ball:
            raise HTTPException(status_code=404, detail="Ball not found")
    sequence = (db.scalar(select(func.max(Shot.sequence_number)).where(Shot.session_id == session.id)) or 0) + 1
    shot = Shot(session_id=session.id, sequence_number=sequence, handedness=user.handedness, **payload.model_dump())
    db.add(shot)
    db.flush()

    recent = list(db.scalars(select(Shot).where(Shot.session_id == session.id).order_by(Shot.sequence_number.asc())))
    result = recommend(recent, user.handedness)
    recommendation = Recommendation(shot_id=shot.id, **result.__dict__)
    db.add(recommendation)
    db.commit()
    return db.scalar(select(Shot).where(Shot.id == shot.id).options(selectinload(Shot.recommendation)))


@router.get("/sessions/{session_id}/shots", response_model=list[ShotRead])
def list_shots(session_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    owned_session(session_id, user.id, db)
    return list(db.scalars(select(Shot).where(Shot.session_id == session_id).options(selectinload(Shot.recommendation)).order_by(Shot.sequence_number.asc())))


@router.delete("/shots/{shot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_shot(shot_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    shot = db.scalar(select(Shot).join(BowlingSession).where(Shot.id == shot_id, BowlingSession.user_id == user.id))
    if not shot:
        raise HTTPException(status_code=404, detail="Shot not found")
    db.delete(shot)
    db.commit()


@router.get("/sessions/{session_id}/lane-state", response_model=LaneStateRead)
def lane_state(session_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    session = owned_session(session_id, user.id, db)
    shots = list(db.scalars(select(Shot).where(Shot.session_id == session.id).order_by(Shot.sequence_number.asc())))
    return build_lane_state(shots, session.oil_length_ft)
