from sqlalchemy import select

from .auth import hash_password
from .database import SessionLocal
from .models import BowlingBall, User


def seed_demo_data() -> None:
    with SessionLocal() as db:
        if db.scalar(select(User).where(User.email == "demo@strikepath.ai")):
            return
        user = User(
            email="demo@strikepath.ai",
            password_hash=hash_password("DemoPass123!"),
            display_name="Demo Bowler",
            handedness="right",
        )
        db.add(user)
        db.flush()
        db.add_all([
            BowlingBall(user_id=user.id, manufacturer="Storm", model="Demo Solid", coverstock="reactive solid", surface_grit=2000, weight_lb=15, is_primary=True),
            BowlingBall(user_id=user.id, manufacturer="Generic", model="Spare Ball", coverstock="plastic", surface_grit=5000, weight_lb=15),
        ])
        db.commit()
