#!/usr/bin/env python3
"""
Basic recon wrapper for lab and client work.
Runs an nmap service scan and probes HTTP titles, producing JSON and Markdown.
"""
import argparse
import json
import re
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse


def run_nmap(target: str, top_ports: int = 1000) -> str:
    if not shutil.which("nmap"):
        sys.exit("nmap not found. Install nmap or run this from Kali.")
    cmd = [
        "nmap", "-sV", "-Pn", "--top-ports", str(top_ports),
        "-oX", "-", target,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        sys.exit(f"nmap failed: {result.stderr}")
    return result.stdout


def parse_nmap(xml_output: str) -> list:
    root = ET.fromstring(xml_output)
    hosts = []
    for host in root.findall("host"):
        addr = host.find("address")
        ip = addr.attrib.get("addr") if addr is not None else "unknown"
        hostnames = [h.attrib.get("name") for h in host.findall("hostnames/hostname") if h.attrib.get("name")]
        ports = []
        for port in host.findall("ports/port"):
            port_id = port.attrib.get("portid")
            protocol = port.attrib.get("protocol")
            state = port.find("state")
            service = port.find("service")
            ports.append({
                "port": port_id,
                "protocol": protocol,
                "state": state.attrib.get("state") if state is not None else "unknown",
                "service": service.attrib.get("name") if service is not None else "unknown",
                "product": service.attrib.get("product") if service is not None else "",
                "version": service.attrib.get("version") if service is not None else "",
            })
        hosts.append({"ip": ip, "hostnames": hostnames, "ports": ports})
    return hosts


def http_title(ip: str, port: int) -> str:
    url = f"http://{ip}:{port}"
    try:
        result = subprocess.run(
            ["curl", "-s", "--max-time", "5", url],
            capture_output=True, text=True, timeout=10,
        )
        html = result.stdout
        match = re.search(r"<title>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
        return match.group(1).strip() if match else ""
    except Exception:
        return ""


def enrich(hosts: list) -> list:
    for host in hosts:
        for port in host["ports"]:
            if port["state"] == "open" and port["port"] in ("80", "8080", "3000", "8000"):
                title = http_title(host["ip"], int(port["port"]))
                if title:
                    port["http_title"] = title
    return hosts


def generate_findings(hosts: list) -> list:
    findings = []
    for host in hosts:
        for port in host["ports"]:
            if port["state"] != "open":
                continue
            title = port.get("http_title")
            evidence = f"{port['service']} on {port['port']}/{port['protocol']}"
            if title:
                evidence += f" — title: {title}"
            findings.append({
                "id": f"F-{host['ip']}-{port['port']}-{port['protocol']}",
                "title": f"Open service: {port['service']} on {host['ip']}:{port['port']}",
                "severity": "info",
                "host": host["ip"],
                "port": port["port"],
                "service": port["service"],
                "product": f"{port['product']} {port['version']}".strip(),
                "evidence": evidence,
                "remediation": "Review whether this service is required and patch it to the latest version.",
            })
    return findings


def write_outputs(out_dir: Path, hosts: list, findings: list, target: str):
    out_dir.mkdir(parents=True, exist_ok=True)
    metadata = {
        "target": target,
        "scanned_at": datetime.utcnow().isoformat() + "Z",
        "tool": "recon.py",
    }
    (out_dir / "hosts.json").write_text(json.dumps(hosts, indent=2))
    (out_dir / "findings.json").write_text(json.dumps({"metadata": metadata, "findings": findings}, indent=2))

    md = [f"# Recon Report: {target}", f"Scanned at: {metadata['scanned_at']}", ""]
    md.append(f"## Hosts ({len(hosts)})")
    for host in hosts:
        md.append(f"### {host['ip']}")
        for port in host["ports"]:
            if port["state"] != "open":
                continue
            line = f"- **{port['port']}/{port['protocol']}** — {port['service']} {port['product']} {port['version']}".strip()
            if "http_title" in port:
                line += f" — _{port['http_title']}_"
            md.append(line)
        md.append("")
    md.append(f"## Findings ({len(findings)})")
    for f in findings:
        md.append(f"- **{f['severity'].upper()}** {f['title']}: {f['evidence']}")
    (out_dir / "report.md").write_text("\n".join(md))
    print(f"Outputs written to {out_dir}")


def main():
    parser = argparse.ArgumentParser(description="Run basic recon and emit JSON/Markdown.")
    parser.add_argument("target", help="Target IP, host, or CIDR range")
    parser.add_argument("-o", "--output", default="./recon-output", help="Output directory")
    parser.add_argument("--top-ports", type=int, default=1000, help="Top N ports to scan")
    args = parser.parse_args()

    print(f"[*] Scanning {args.target}...")
    xml = run_nmap(args.target, args.top_ports)
    hosts = parse_nmap(xml)
    hosts = enrich(hosts)
    findings = generate_findings(hosts)
    write_outputs(Path(args.output), hosts, findings, args.target)
    print(f"[+] Found {len(findings)} open service(s).")


if __name__ == "__main__":
    main()
