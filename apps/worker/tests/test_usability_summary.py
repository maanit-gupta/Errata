"""scripts/usability_summary.py: SUS scoring, validation, gates and splicing (synthetic rows)."""

from __future__ import annotations

import csv
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
import usability_summary as us


def row(pid: str, order: str = "AB", **kw: str) -> dict[str, str]:
    return {"participant": pid, "order": order, **kw}


def sus(*answers: int) -> dict[str, str]:
    return {f"sus_q{i}": str(a) for i, a in enumerate(answers, 1)}


def test_sus_scoring_matches_the_standard() -> None:
    assert us.sus_score([3] * 10) == 50.0
    assert us.sus_score([5, 1] * 5) == 100.0
    assert us.sus_score([1, 5] * 5) == 0.0
    assert us.sus_score([4, 2, 4, 2, 4, 2, 4, 2, 4, 2]) == 75.0
    with pytest.raises(us.SessionError):
        us.sus_score([3] * 9)
    with pytest.raises(us.SessionError):
        us.sus_score([6] + [3] * 9)


def test_planned_rows_without_results_are_ignored() -> None:
    sessions = us.parse([row("P1"), row("P2", "BA")])
    s = us.summarise(sessions)
    assert s.n == 0 and s.sus_gate == "PENDING" and s.found_gate == "PENDING"


@pytest.mark.parametrize(
    ("bad", "msg"),
    [
        (row("P1", a_found="5"), "a_found"),
        (row("P1", a_time_s="fast"), "a_time_s"),
        (row("P1", t1="maybe"), "t1"),
        (row("P1", order="AA"), "order"),
        (row("P1", order="", b_found="3"), "order"),
        (row("P1", sus_q1="4"), "partly"),
        (row("P1", a_found="2.5"), "whole"),
    ],
)
def test_bad_cells_are_rejected_not_guessed(bad: dict[str, str], msg: str) -> None:
    with pytest.raises(us.SessionError, match=msg):
        us.parse([bad])


def test_gates_pass_and_fail() -> None:
    good = [
        row(
            "P1",
            a_found="2",
            b_found="4",
            a_time_s="300",
            b_time_s="90",
            **sus(4, 2, 4, 2, 4, 2, 4, 2, 4, 2),
        ),
        row("P2", "BA", a_found="3", b_found="4", **sus(5, 1, 5, 2, 4, 2, 4, 1, 4, 2)),
        row("P3", a_found="4", b_found="4", **sus(4, 2, 4, 2, 4, 2, 4, 2, 4, 2)),
    ]
    s = us.summarise(us.parse(good))
    assert (s.better, s.same, s.worse) == (2, 1, 0)
    assert s.found_gate == "PASS" and s.sus_gate == "PASS"
    assert s.a_found == 3 and s.b_found == 4 and s.a_time == 300

    bad = [row("P1", a_found="4", b_found="3", **sus(3, 3, 3, 3, 3, 3, 3, 3, 3, 3))]
    s = us.summarise(us.parse(bad))
    assert s.found_gate == "FAIL" and s.sus_gate == "FAIL"


def test_render_and_splice_keep_the_hand_written_parts(tmp_path: Path) -> None:
    doc = f"# Results\n\nintro\n\n{us.BEGIN}\nold\n{us.END}\n\n## Top issues\n| a | b |\n"
    sessions = us.parse(
        [row("P1", a_found="1", b_found="4", t1="Y", **sus(4, 2, 4, 2, 4, 2, 4, 2, 4, 2))]
    )
    out = us.splice(doc, us.render(sessions, us.summarise(sessions)))
    assert out.startswith("# Results\n\nintro\n\n") and out.endswith("## Top issues\n| a | b |\n")
    assert "| P1 | A→B |" in out and "| 75 |" in out and "old" not in out
    with pytest.raises(us.SessionError):
        us.splice("no markers", "x")


def test_repo_template_is_valid_and_results_md_is_current() -> None:
    with us.CSV_PATH.open(newline="", encoding="utf-8") as fh:
        sessions = us.parse(list(csv.DictReader(fh)))
    assert len(sessions) >= 8
    assert us.main(["--check"]) == 0, "run: python scripts/usability_summary.py"


FAKE_CSV = Path(__file__).parent / "fixtures" / "FAKE_usability_sessions.csv"


def test_fake_fixture_end_to_end(tmp_path: Path) -> None:
    """FAKE data, tests only: every row is labelled FAKE-P*, never real participants."""
    results = tmp_path / "results.md"
    results.write_text(f"# r\n\n{us.BEGIN}\n{us.END}\n\n## Top issues\n", encoding="utf-8")
    assert us.main(["--csv", str(FAKE_CSV), "--results", str(results)]) == 0
    out = results.read_text(encoding="utf-8")
    assert "| FAKE-P1 | A→B |" in out and "| FAKE-P2 | B→A |" in out
    assert "FAKE-P3" not in out  # planned row without results is skipped
    assert "| 2 | 1 | 1 |" in out  # probe: asked 2, understood 1, not understood 1
    assert "| T5 | 1 | 1 | 0 |" in out and "| T4 | 1 | 0 | 0 |" in out
    assert "## Top issues" in out


def test_probe_and_new_tasks_are_validated() -> None:
    with pytest.raises(us.SessionError, match="pending_understood"):
        us.parse([row("P1", pending_understood="maybe")])
    with pytest.raises(us.SessionError, match="t6"):
        us.parse([row("P1", t6="X")])
    (s,) = us.parse([row("P1", pending_understood="n", t5="y")])
    assert s.pending_understood is False and s.tasks == {"t5": "Y"} and s.has_data
