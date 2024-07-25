from server import red
from flask import current_app

def rate_limit(key, rate):
    if current_app.config['IS_TEST']:
        return False

    if red.exists(key):
        attempts = int(red.get(key))
        if attempts > rate:
            ttl = int(red.ttl(key)/60)
            return ttl
        red.set(key, attempts+1, keepttl=True)
        return False
    red.setex(key, 
        3600, # 1 Hour
        value=1)
    return False