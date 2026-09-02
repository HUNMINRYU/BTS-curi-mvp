#!/usr/bin/env python3
"""Run one command in its own process group with a hard, portable deadline."""

from __future__ import annotations

import argparse
import os
import signal
import subprocess
import sys
from typing import Sequence


def terminate_process_group(process: subprocess.Popen[bytes]) -> None:
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    try:
        process.wait(timeout=1)
    except subprocess.TimeoutExpired:
        pass
    try:
        os.killpg(process.pid, signal.SIGKILL)
    except ProcessLookupError:
        return
    process.wait()


def parse_command(arguments: Sequence[str]) -> list[str]:
    command = list(arguments)
    if command[:1] == ["--"]:
        command = command[1:]
    if not command:
        raise ValueError("a command is required")
    return command


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seconds", type=float, required=True)
    parser.add_argument("command", nargs=argparse.REMAINDER)
    arguments = parser.parse_args(argv)
    if not 1 <= arguments.seconds <= 300:
        return 64
    try:
        command = parse_command(arguments.command)
        process = subprocess.Popen(command, start_new_session=True)
    except (OSError, ValueError):
        return 127
    try:
        return process.wait(timeout=arguments.seconds)
    except subprocess.TimeoutExpired:
        terminate_process_group(process)
        return 124


if __name__ == "__main__":
    raise SystemExit(main())
