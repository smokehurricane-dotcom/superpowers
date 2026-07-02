#!/usr/bin/env python3
"""
Generate a client-ready HTML pentest report from findings.json.
"""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from jinja2 import Environment, FileSystemLoader


SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}


def severity_class(severity: str) -> str:
    return {
        "critical": "danger",
        "high": "warning",
        "medium": "caution",
        "low": "info",
        "info": "muted",
    }.get(severity.lower(), "muted")


def main():
    parser = argparse.ArgumentParser(description="Generate an HTML report from findings JSON.")
    parser.add_argument("findings", help="Path to findings.json")
    parser.add_argument("-o", "--output", default="report.html", help="Output HTML file")
    parser.add_argument("-t", "--template-dir", default=Path(__file__).parent / "templates", help="Jinja2 templates directory")
    args = parser.parse_args()

    data = json.loads(Path(args.findings).read_text())
    metadata = data.get("metadata", {})
    findings = data.get("findings", [])
    findings.sort(key=lambda x: SEVERITY_ORDER.get(x.get("severity", "info").lower(), 99))

    counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
    for f in findings:
        counts[f.get("severity", "info").lower()] = counts.get(f.get("severity", "info").lower(), 0) + 1

    env = Environment(loader=FileSystemLoader(args.template_dir))
    env.filters["severity_class"] = severity_class
    template = env.get_template("report.html")

    rendered = template.render(
        generated_at=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        metadata=metadata,
        findings=findings,
        counts=counts,
    )
    Path(args.output).write_text(rendered)
    print(f"[+] Report written to {args.output}")


if __name__ == "__main__":
    main()
