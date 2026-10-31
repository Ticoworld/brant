# Private bridge addresses only. Docker --internal does not expose mapped ports.
import subprocess,json
from urllib.request import build_opener,ProxyHandler
opener=build_opener(ProxyHandler({})) # ONLY explicit directly attached local IPs below.
def endpoint(name,port):
 j=json.loads(subprocess.check_output(['docker','inspect',name]))[0]
 ip=j['NetworkSettings']['Networks']['e2e-private']['IPAddress']
 assert ip.startswith('172.19.'), 'unexpected private bridge; inspect explicitly'
 return f'http://{ip}:{port}'
