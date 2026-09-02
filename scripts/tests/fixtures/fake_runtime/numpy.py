"""Small NumPy-compatible fixture for sidecar process tests."""

float32 = "float32"


def empty(shape: tuple[int, int], dtype: object = None) -> list[list[float]]:
    rows, columns = shape
    return [[0.0] * columns for _ in range(rows)]
