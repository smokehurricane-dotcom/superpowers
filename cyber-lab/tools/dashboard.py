#!/usr/bin/env python3
"""
Generate a static HTML dashboard from findings.json for demos and client reporting.
"""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from jinja2 import Environment, FileSystemLoader


def severity_class(severity: str) -> str:
    return {
        "critical": "danger",
        "high": "warning",
        "medium": "caution",
        "low": "info",
        "info": "muted",
    }.get(severity.lower(), "muted")


def main():
    parser = argparse.ArgumentParser(description="Generate a static dashboard HTML from findings JSON.")
    parser.add_argument("findings", help="Path to findings.json")
    parser.add_argument("-o", "--output", default="dashboard.html", help="Output HTML file")
    parser.add_argument("-t", "--template-dir", default=Path(__file__).parent / "templates", help="Jinja2 templates directory")
    args = parser.parse_args()

    data = json.loads(Path(args.findings).read_text())
    metadata = data.get("metadata", {})
    findings = data.get("findings", [])

    counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
    services = {}
    for f in findings:
        sev = f.get("severity", "info").lower()
        counts[sev] = counts.get(sev, 0) + 1
        svc = f.get("service", "unknown")
        services[svc] = services.get(svc, 0) + 1

    env = Environment(loader=FileSystemLoader(args.template_dir))
    env.filters["severity_class"] = severity_class
    template = env.get_template("dashboard.html")

    rendered = template.render(
        generated_at=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        metadata=metadata,
        findings=findings,
        counts=counts,
        services=services,
    )
    Path(args.output).write_text(rendered)
    print(f"[+] Dashboard written to {args.output}")


if __name__ == "__main__":
    main()
