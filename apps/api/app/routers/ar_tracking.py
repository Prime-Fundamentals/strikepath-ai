from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import ARTrackingCapture, BowlingSession, User
from ..schemas import ARTrackingCaptureCreate, ARTrackingCaptureRead

router = APIRouter(prefix="/api/ar", tags=["ar-tracking"])


def owned_session(session_id: int | None, user_id: int, db: Session) -> BowlingSession | None:
    if session_id is None:
        return None
    session = db.scalar(
        select(BowlingSession).where(
            BowlingSession.id == session_id,
            BowlingSession.user_id == user_id,
        )
    )
    if not session:
        raise HTTPException(status_code=404, detail="Bowling session not found")
    return session


@router.get("/captures", response_model=list[ARTrackingCaptureRead])
def list_captures(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list(
        db.scalars(
            select(ARTrackingCapture)
            .where(ARTrackingCapture.user_id == user.id)
            .order_by(ARTrackingCapture.created_at.desc())
        )
    )


@router.post("/captures", response_model=ARTrackingCaptureRead, status_code=status.HTTP_201_CREATED)
def create_capture(
    payload: ARTrackingCaptureCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    owned_session(payload.session_id, user.id, db)
    capture = ARTrackingCapture(user_id=user.id, **payload.model_dump())
    db.add(capture)
    db.commit()
    db.refresh(capture)
    return capture


@router.delete("/captures/{capture_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_capture(
    capture_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    capture = db.scalar(
        select(ARTrackingCapture).where(
            ARTrackingCapture.id == capture_id,
            ARTrackingCapture.user_id == user.id,
        )
    )
    if not capture:
        raise HTTPException(status_code=404, detail="AR capture not found")
    db.delete(capture)
    db.commit()
