#!/usr/bin/env python3
"""Stop hook: if files were changed (or a worker was dispatched) this turn, the working record must be
updated and a regression table produced. Governance-only edits are exempt from the regression table."""
import re, sys
from _common import (read_hook_input, load_config, read_transcript, last_turn, last_assistant_text,
                     tool_uses, is_governance_path, block)


def _shell_segments(line):
    """Split one line into simple commands at unquoted ; & | (quote state resets per line)."""
    segs, cur, quote = [], "", None
    for ch in line:
        if quote:
            quote = None if ch == quote else quote
        elif ch in "'\"":
            quote = ch
        elif ch in ";&|":
            segs.append(cur)
            cur = ""
            continue
        cur += ch
    return segs + [cur]


def bash_wrote_record(turn, record_file):
    """True when a Bash call this turn visibly WRITES the record. Conservative heuristic: the record's
    file name must appear together with a write that targets it —
      - `sed -i` / `sed --in-place` / `perl -i...` in the same simple command as the file name;
      - a `>` or `>>` redirection straight into the file;
      - `tee`, or `cp` / `mv` whose last argument is the file;
      - a python command (python/python3/py) naming the file that calls .write( / .write_text( /
        .writelines( or open(..., 'w'|'a'|'x'|'r+').
    Reads (cat, grep, sed -n, git diff/add/commit) never count. The python rule is command-wide, so a
    python script that names the record but writes a different file is a known false positive.
    Any exception returns False, i.e. the pre-existing Edit/Write-only behaviour."""
    try:
        name = re.escape(record_file.replace("\\", "/").rsplit("/", 1)[-1])
        in_place = re.compile(r"^\s*(?:\S+=\S*\s+)*(?:sed|perl)\s(?:.*\s)?-(?:-in-place|[A-Za-z]*i)\b")
        target = r"['\"]?(?:[^\s'\"]*[/\\])?" + name + r"['\"]?"
        redirect = re.compile(r">>?\s*" + target + r"(?:\s|$)")
        copy_last = re.compile(r"^\s*(?:tee|cp|mv)\b(?:.*\s)?" + target + r"\s*$")
        py_write = re.compile(r"\.write(?:_text|lines)?\(|\bopen\(.*?,\s*(?:mode\s*=\s*)?['\"](?:[wax]|r\+)")
        for use in tool_uses(turn, {"Bash"}):
            cmd = (use.get("input") or {}).get("command")
            if not isinstance(cmd, str) or not re.search(name, cmd):
                continue
            if re.search(r"\bpy(?:thon[0-9.]*)?\b", cmd) and py_write.search(cmd):
                return True
            for line in cmd.splitlines():
                for seg in _shell_segments(line):
                    if not re.search(name, seg):
                        continue
                    if in_place.search(seg) or redirect.search(seg) or copy_last.search(seg):
                        return True
    except Exception:
        return False
    return False


data = read_hook_input()
if data.get("stop_hook_active"):
    sys.exit(0)
cfg = load_config()
turn = last_turn(read_transcript(data.get("transcript_path")))
edits = tool_uses(turn, {"Edit", "Write", "MultiEdit", "NotebookEdit"})
dispatched = bool(tool_uses(turn, {"Agent", "Task"}))
paths = [(e.get("input") or {}).get("file_path") or (e.get("input") or {}).get("path") or "" for e in edits]
source_paths = [p for p in paths if p and not is_governance_path(p, cfg)]
record_touched = any(p.endswith(cfg["record_file"]) for p in paths) or bash_wrote_record(turn, cfg["record_file"])
if not source_paths and not dispatched:
    sys.exit(0)
text = last_assistant_text(turn)
problems = []
if not record_touched:
    problems.append(f"update {cfg['record_file']} (request ledger, hotspot counter, deliverable ledger)")
if not re.search(cfg["regression_table_pattern"], text):
    problems.append("end with the regression table (kept / added / intentionally removed / missing) "
                    f"against {cfg['features_file']}, and update the manifest if features changed")
if problems:
    block("Implementation happened this turn but the record is incomplete. Before finishing: " + "; ".join(problems) + ".")
sys.exit(0)
