import yaml

with open('/home/ubuntu/.cloudflared/config.yml', 'r') as f:
    config = yaml.safe_load(f)

# check if pr-agent is already there
found = any(i.get('hostname') == 'pr-agent.sonagi.space' for i in config.get('ingress', []))

if not found:
    # Insert before the last catch-all rule
    new_rule = {'hostname': 'pr-agent.sonagi.space', 'service': 'http://devops.tailb95307.ts.net:80'}
    config['ingress'].insert(-1, new_rule)
    with open('/home/ubuntu/.cloudflared/config.yml', 'w') as f:
        yaml.dump(config, f, sort_keys=False)
    print("Patched successfully")
else:
    print("Already exists")
