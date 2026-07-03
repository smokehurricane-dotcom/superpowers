import re
import sys
import xml.etree.ElementTree as ET


def validate_blocks(text):
    """Validate each <ossec_config> block as well-formed XML."""
    blocks = re.findall(r'<ossec_config>(.*?)</ossec_config>', text, re.DOTALL)
    if not blocks:
        raise SystemExit('ERROR: no <ossec_config> blocks found')
    for i, block in enumerate(blocks, 1):
        try:
            ET.fromstring(f'<ossec_config>{block}</ossec_config>')
        except ET.ParseError as e:
            raise SystemExit(f'ERROR: block {i} is not valid XML: {e}')


def remove_existing_firewall_block(conf):
    """Remove any <command> or <active-response> blocks named firewall-block."""
    # Remove <command> blocks whose <name> is firewall-block
    conf = re.sub(
        r'\s*<command>\s*<name>firewall-block</name>.*?</command>\s*',
        '\n',
        conf,
        flags=re.DOTALL,
    )
    # Remove <active-response> blocks that reference the firewall-block command
    def ar_replacer(m):
        block = m.group(0)
        if '<command>firewall-block</command>' in block:
            return '\n'
        return block

    conf = re.sub(
        r'\s*<active-response>\s*.*?</active-response>\s*',
        ar_replacer,
        conf,
        flags=re.DOTALL,
    )
    return conf


def main(conf_path, snippet_path, out_path):
    with open(conf_path, 'r', encoding='utf-8') as f:
        conf = f.read()
    with open(snippet_path, 'r', encoding='utf-8') as f:
        snippet = f.read().rstrip() + '\n'

    conf = remove_existing_firewall_block(conf)

    # Insert before the first </ossec_config>
    marker = '</ossec_config>'
    idx = conf.find(marker)
    if idx == -1:
        raise SystemExit('ERROR: </ossec_config> not found')

    new_conf = conf[:idx] + snippet + '\n' + conf[idx:]
    validate_blocks(new_conf)
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(new_conf)
    print(f'Wrote {out_path}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3])
