#!/usr/bin/env python3
"""Disable Wazuh modules that are not needed in a manager-only SIEM.

Run inside the Wazuh manager container:
    python3 /tmp/disable-heavy-modules.py /var/ossec/etc/ossec.conf

This disables:
  - <vulnerability-detection>  (CVE feed loader that exhausts RAM)
  - <indexer> output           (no indexer in manager-only deployment)
"""
import re
import sys


def main(conf_path):
    with open(conf_path, "r", encoding="utf-8") as f:
        conf = f.read()

    # Disable vulnerability-detection
    conf = re.sub(
        r"(<vulnerability-detection>.*?<enabled>)[^<]+(</enabled>.*?</vulnerability-detection>)",
        r"\1no\2",
        conf,
        flags=re.DOTALL,
    )
    if "<vulnerability-detection>" in conf and not re.search(
        r"<vulnerability-detection>.*?<enabled>", conf, flags=re.DOTALL
    ):
        conf = conf.replace(
            "<vulnerability-detection>",
            "<vulnerability-detection>\n    <enabled>no</enabled>",
        )

    # Disable indexer output (manager-only, no indexer)
    conf = re.sub(
        r"(<indexer>.*?<enabled>)[^<]+(</enabled>.*?</indexer>)",
        r"\1no\2",
        conf,
        flags=re.DOTALL,
    )
    if "<indexer>" in conf and not re.search(
        r"<indexer>.*?<enabled>", conf, flags=re.DOTALL
    ):
        conf = conf.replace(
            "<indexer>",
            "<indexer>\n    <enabled>no</enabled>",
        )

    with open(conf_path, "w", encoding="utf-8") as f:
        f.write(conf)

    print(f"Disabled heavy modules in {conf_path}")


if __name__ == "__main__":
    main(sys.argv[1])
