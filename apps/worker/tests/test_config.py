from brandlens_worker import config


def test_thresholds_match_spec() -> None:
    assert config.HUMAN_CONFIDENCE == 0.6
    assert config.PRECISION_GATE == 0.85
    assert set(config.DIMENSION_MAX_SEVERITY) == {
        "tone",
        "terms",
        "facts",
        "claims",
        "visual",
        "access",
    }
    assert config.LLM_CACHE is False
