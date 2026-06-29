from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import BowlingBall, User
from ..schemas import BallCreate, BallRead, BallUpdate

router = APIRouter(prefix="/api/balls", tags=["balls"])


@router.get("", response_model=list[BallRead])
def list_balls(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return list(db.scalars(select(BowlingBall).where(BowlingBall.user_id == user.id).order_by(BowlingBall.is_primary.desc(), BowlingBall.created_at.desc())))


@router.post("", response_model=BallRead, status_code=status.HTTP_201_CREATED)
def create_ball(payload: BallCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.is_primary:
        db.execute(update(BowlingBall).where(BowlingBall.user_id == user.id).values(is_primary=False))
    ball = BowlingBall(user_id=user.id, **payload.model_dump())
    db.add(ball)
    db.commit()
    db.refresh(ball)
    return ball


def owned_ball(ball_id: int, user_id: int, db: Session) -> BowlingBall:
    ball = db.scalar(select(BowlingBall).where(BowlingBall.id == ball_id, BowlingBall.user_id == user_id))
    if not ball:
        raise HTTPException(status_code=404, detail="Ball not found")
    return ball


@router.put("/{ball_id}", response_model=BallRead)
def update_ball(ball_id: int, payload: BallUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ball = owned_ball(ball_id, user.id, db)
    if payload.is_primary:
        db.execute(update(BowlingBall).where(BowlingBall.user_id == user.id).values(is_primary=False))
    for key, value in payload.model_dump().items():
        setattr(ball, key, value)
    db.commit()
    db.refresh(ball)
    return ball


@router.delete("/{ball_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ball(ball_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ball = owned_ball(ball_id, user.id, db)
    db.delete(ball)
    db.commit()
