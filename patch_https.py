import yaml

with open('/home/ubuntu/.cloudflared/config.yml', 'r') as f:
    config = yaml.safe_load(f)

for rule in config.get('ingress', []):
    if rule.get('hostname') == 'pr-agent.sonagi.space':
        rule['service'] = 'https://devops.tailb95307.ts.net:443'
        rule['originRequest'] = {'noTLSVerify': True}

with open('/home/ubuntu/.cloudflared/config.yml', 'w') as f:
    yaml.dump(config, f, sort_keys=False)
