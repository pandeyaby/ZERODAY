import yaml


def load_config(path):
    with open(path) as f:
        return yaml.full_load(f)
