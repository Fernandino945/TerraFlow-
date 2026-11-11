import logging

import pytest

from app.services import sensor_validation


@pytest.mark.parametrize(
    "humidity,temperature",
    [(50, 20), (0, 20), (100, 20), (50, -20), (50, 60)],
)
def test_valid_reading_is_accepted(humidity, temperature):
    assert sensor_validation.check_reading("sensor_zone_1", humidity, temperature) is None


@pytest.mark.parametrize(
    "humidity,temperature,reason",
    [
        (100.1, 20, "humedad"),
        (-0.1, 20, "humedad"),
        (50, -127, "temperatura"),
        (50, 85, "temperatura"),
        (float("nan"), 20, "no numérico"),
        (50, float("inf"), "no numérico"),
    ],
)
def test_invalid_reading_returns_reason(humidity, temperature, reason):
    result = sensor_validation.check_reading("sensor_zone_1", humidity, temperature)
    assert result is not None
    assert reason in result


def test_invalid_reading_is_logged(caplog):
    with caplog.at_level(logging.WARNING, logger="terraflow.validation"):
        sensor_validation.check_reading("sensor_zone_1", 150, 20)
    assert "LECTURA DESCARTADA" in caplog.text
