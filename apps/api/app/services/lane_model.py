from __future__ import annotations

from math import comb


COVERSTOCK_HOOK = {
    "plastic": 0.45,
    "urethane": 0.72,
    "reactive pearl": 0.95,
    "reactive hybrid": 1.05,
    "reactive solid": 1.15,
}


def _bezier(points: list[tuple[float, float]], t: float) -> tuple[float, float]:
    degree = len(points) - 1
    x = y = 0.0
    for i, (px, py) in enumerate(points):
        weight = comb(degree, i) * ((1 - t) ** (degree - i)) * (t**i)
        x += weight * px
        y += weight * py
    return x, y


def build_lane_state(shots: list, oil_length_ft: float, zones: int = 30) -> dict:
    boards = 39
    # Higher values indicate more estimated oil. A house pattern starts fuller in the middle.
    oil = []
    for zone in range(zones):
        distance_ft = 60 * zone / max(1, zones - 1)
        row = []
        for board_idx in range(boards):
            board = board_idx + 1
            center_weight = max(0.0, 1 - abs(board - 20) / 20)
            base = 0.20 + 0.62 * center_weight
            if distance_ft > oil_length_ft:
                base *= max(0.05, 1 - (distance_ft - oil_length_ft) / 8)
            row.append(base)
        oil.append(row)

    paths: list[dict] = []
    for shot in shots:
        control = [
            (shot.laydown_board, 0.0),
            (shot.target_board, 15.0),
            (shot.breakpoint_board, min(54.0, max(32.0, oil_length_ft + 4.0))),
            (shot.pocket_board, 60.0),
        ]
        samples = []
        for step in range(121):
            t = step / 120
            board, distance = _bezier(control, t)
            board = max(1.0, min(39.0, board))
            samples.append({"board": round(board, 3), "distance_ft": round(distance, 3)})
            zone = min(zones - 1, max(0, int((distance / 60) * zones)))
            center = min(boards - 1, max(0, round(board) - 1))
            for offset, depletion in ((0, 0.025), (-1, 0.012), (1, 0.012)):
                idx = center + offset
                if 0 <= idx < boards:
                    oil[zone][idx] = max(0.0, oil[zone][idx] - depletion)
            # Approximate carrydown several feet farther down-lane.
            carry_zone = min(zones - 1, zone + 3)
            oil[carry_zone][center] = min(1.0, oil[carry_zone][center] + 0.006)

        paths.append(
            {
                "shot_id": shot.id,
                "sequence_number": shot.sequence_number,
                "pinfall": shot.pinfall,
                "samples": samples[::4],
            }
        )

    friction = [[round(1 - value, 3) for value in row] for row in oil]
    return {
        "boards": boards,
        "zones": zones,
        "friction_grid": friction,
        "paths": paths[-12:],
        "description": "Estimated transition derived from logged ball paths; it is not a direct measurement of lane oil.",
    }
