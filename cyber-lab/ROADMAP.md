# Cyber Lab Roadmap

**Harter Schnitt:** Die ersten drei Punkte unter ★ ALS NÄCHSTES sind das einzige, was gerade gearbeitet wird.  
Alles darunter ist **BACKLOG** — nicht anfangen, solange die ★ nicht fertig sind oder ein konkreter Kunde/Grund es nicht explizit verlangt. Breite ist nicht der Engpass.

---

## ★ ALS NÄCHSTES

### 1. Active Response fertig verdrahten

**Ziel:** Aus `docs/response/README.md` den Status „deferred" in „verified" ändern.

Schritte:

- [x] `firewall-block.ps1` und `firewall-block.cmd` ins Wazuh-Agent-`active-response\bin\`-Verzeichnis auf dem DC kopieren.
- [x] `<command>`- und `<active-response>`-Blöcke sauber in `/var/ossec/etc/ossec.conf` einfügen — **ausschließlich über die Datei-Bytes-Methode** (Host-Datei → base64 → `docker cp` → decode), kein sed/heredoc.
- [x] Sicherstellen, dass der Block die Verbindung zum Manager/Agent nicht killt: WinRM- und Wazuh-Agent-Allow-Regeln auf dem DC vor dem Block aktivieren.
- [ ] Live-Test: SMB-Brute-Force → Alert Level ≥10 → Active Response → temporärer Firewall-Block → nach Timeout Regel wieder weg.
- [x] Doku in `docs/response/README.md` aktualisieren: Status auf „wired but blocked" setzen mit Begründung.

**Status =** Konfiguration und Skript stehen; automatischer End-to-End-Loop ist durch Wazuh-Manager/Agent-Instabilität blockiert. nächster Schritt: Manager/Agent stabilisieren, dann Live-Test wiederholen.

---

### 2. Reproduzierbarkeit: Live-Schritte ins Provisioning falten

**Ziel:** `vagrant destroy -f && vagrant up` baut den kompletten Detect→Alert→Respond-Stack neu auf, ohne manuelle Container-Edits.

Schritte:

- [ ] SIEM-Provisioner erweitern:
  - `custom-wazuh-notify`-Wrapper und `wazuh-notify.py` nach `/var/ossec/integrations/` kopieren.
  - `data/mitre-techniques.json` nach `/var/ossec/etc/data/` kopieren.
  - `ALERT_WEBHOOK_URL` aus `.env` in `/var/ossec/etc/wazuh-notify.env` schreiben.
  - `<integration>`-Block in `ossec.conf` einfügen (Datei-Bytes-Methode).
- [ ] DC-Provisioner erweitern:
  - `firewall-block.ps1` nach `active-response\bin\` kopieren.
  - Ausführungsrichtlinien/Permissions setzen, sodass Wazuh execd das Skript starten darf.
- [ ] AR-Block ins Provisioning übernehmen (siehe Slice 1).
- [ ] Nach einem kompletten `vagrant destroy && vagrant up` den SMB-Brute-Force-Test automatisch laufen lassen und Webhook-POST + AR-Log prüfen.

**Done =** Frisches Lab baut in einem Durchlauf auf und der Live-Loop funktioniert ohne manuelle Eingriffe.

---

### 3. 60-Sekunden-Demo des Live-Loops

**Ziel:** Ein kurzes Video/GIF, das den kompletten Purple-Team-Loop zeigt.

Inhalt:

- Kali: SMB-Brute-Force gegen DC.
- SIEM: Alert 100303 (Level 12) entsteht.
- Webhook-Receiver auf Kali: POST kommt an.
- DC: Firewall-Regel wird angelegt und wieder entfernt.

Schritte:

- [ ] Szenario-Skript schreiben, das die Schritte in korrekter Reihenfolge und mit sichtbaren Timestamps ausführt.
- [ ] Terminal-Aufnahme mit asciinema oder OBS erstellen.
- [ ] Auf 60 Sekunden schneiden; Optional als GIF für README/`docs/img/` exportieren.
- [ ] In `README.md` und `docs/response/README.md` verlinken.

**Done =** Video/GIF liegt im Repo und ist von README aus erreichbar.

---

## BACKLOG

> **NICHT anfangen, solange nicht ★ fertig ist ODER ein konkreter Kunde/Grund es verlangt. Breite ist nicht der Engpass.**

### Detection Engineering

- **Sysmon + Command-Line-Logging auf DC/win10**
  - Ingest Event ID 1; ermöglicht PowerShell-, PsExec-, WMIC- und RDP-Lateral-Movement-Regeln.
- **Post-Exploitation-Regeln**
  - PsExec / WMI / RDP lateral movement; Validierungs-Attacken mit netexec/impacket.
- **LDAP-Signing / LDAPS-Enumeration**
  - BloodHound/SharpHound-Indikatoren erkennen.
- **PetitPotam / NTLM-Relay**
  - MS-EFSRPC-Events + Authentifizierungsanomalien.
- **DCShadow**
  - Spezifische 5137/5141-Muster + Replikationsanomalien.
- **Linux-auditd für `target`-VM**
  - Brute-force, File-Integrity, Web-Shell-Erkennung.
- **Rule-CI-Harness**
  - Pro Custom-Rule ein known-good JSON-Sample durch `wazuh-logtest` jagen; Regression = rot.

### Infrastructure & Observability

- **Zeek oder Suricata auf dem Router**
  - Netzwerk-Layer-Erkennung; Korrelation mit Host-Alerts.
- **Lab-Status-Dashboard**
  - Einfache Webseite: VM/agent status, letzter Alert, letzte Attacke.
- **Wazuh-Config-Backup**
  - Regeln, ossec.conf, Integrationen bei Änderungen ins Repo sichern.
- **Zweiter DC oder Linux AD-Member**
  - Mehr RAM nötig; erst wenn horizontal skaliert werden soll.

### Purple-Team Automation & Metrics

- **Attack-Scheduler**
  - Stündlich eine ATT&CK-Technik ausführen und Detection prüfen.
- **MTTD-Dashboard**
  - Zeit von Attack-Ausführung bis Alert + Webhook-Delivery.
- **Atomic Red Team / Caldera-Integration**
  - Wiederholbare Testfälle statt handgemachter Befehle.
- **Wöchentlicher Purple-Team-Report**
  - Markdown/PDF: Attacken, Detektionen, Lücken.

### Response / SOAR light

- **SOAR-Playbook (klein)**
  - Alert → Webhook → automatisch Case anlegen.
- **TheHive / Cortex**
  - Großes neues Component; nur bei konkretem Bedarf.
- **Velociraptor IR-Agent**
  - Endpoint-Response / Artifact-Collection.

### Documentation & Portfolio

- **MkDocs-Site für Detection-Playbooks**
  - Besser teilbar als rohe Markdown-Dateien.
- **Attack → Detection → Mitigation-Mapping**
  - Pro Technik eine Zeile; zeigt End-to-End-Wert.
- **Asciinema/GIFs für weitere Attacken**
  - Kerberoasting, DCSync, Password Spray.
- **LESSONS.md pro Phase in `docs/` splitten**
  - Lesbarkeit verbessern.
