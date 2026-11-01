# Queryproof map and troubleshooting

Use this when something breaks. The live project address is `https://queryproof-yushbyte.duckdns.org`. The organization name reserved for later is Yushbyte. The portfolio site on the same machine stays on port 80 for other host names.

## How a request moves

```text
Browser
  https://queryproof-yushbyte.duckdns.org
    → Nginx on the EC2, port 443
         → static files in apps/web/dist
         → /api  →  Express 127.0.0.1:3000
                      → FastAPI 127.0.0.1:8000
                      → MongoDB 127.0.0.1:27017
                      → Elasticsearch 127.0.0.1:9200
```

The browser never calls ports 3000, 8000, 9200, or 27017. Those stay on the machine.

## Machine

- EC2 name: job-radar, id i-02ae11d6d6ffe4e23, region ap-south-1, user ubuntu
- Public address: 13.232.42.28
- Project on the server: /home/ubuntu/queryproof
- DuckDNS: queryproof-yushbyte → 13.232.42.28
- Certificate: /etc/letsencrypt/live/queryproof-yushbyte.duckdns.org/ (expires 2027-01-30, renews by itself)
- Nginx site file: /etc/nginx/sites-available/queryproof
- Portfolio Nginx site stays enabled. Do not make Queryproof the default site for every name on port 80.

Security group inbound:

- 22 SSH, only this PC's current public address /32
- 80 and 443 open
- 8080 open (older address, still works)
- 3000, 8000, 9200, 27017, 5601 stay closed

This PC's public address changes. A timeout on SSH almost always means the /32 rule is stale. Check with `(Invoke-RestMethod https://api.ipify.org)` and set the SSH source to that address /32. Do not put the server address 13.232.42.28 in the SSH source. Do not open SSH to 0.0.0.0/0.

## Repo

```text
apps/web          React page. Production build is apps/web/dist
apps/api          Express. Port 3000. Talks to AI, Mongo, Elasticsearch
apps/ai-service   FastAPI. Port 8000. Calls Gemini. Does not search Elasticsearch
infra/docker      MongoDB 7 and Elasticsearch 8.15.3. Kibana is not started
infra/elasticsearch/recalls.index.json
infra/elasticsearch/drug_enforcement.documents.json   300 recalls
Jenkinsfile       SSH to the server, pull, install, build, restart the two services
```

API code worth knowing:

- `apps/api/src/server.js` listens on 127.0.0.1 (edited on the server)
- `apps/api/src/app.js` allows browser origins from `ALLOWED_ORIGINS` when `NODE_ENV=production`
- `apps/api/.env` and `apps/ai-service/.env` exist only on the server. Do not commit them
- `apps/api/src/seed-eval.js` inserts the insulin answer key once

Mongo database `queryproof`:

- `users` accounts. `passwordHash` is a hash, not the password
- `evalcases` answer keys
- `evalruns` grades
- `queryhistories` questions asked while signed in

Elasticsearch index `drug_enforcement` has 300 documents. The insulin question is supposed to score 5 of 5 and return no hits.

## Processes on the server

```bash
sudo systemctl status queryproof-api queryproof-ai nginx --no-pager
sudo docker ps
```

Expect `queryproof-api`, `queryproof-ai`, `nginx`, `queryproof-mongo`, and `queryproof-elasticsearch`. Kibana should be absent.

Restart only the apps after a code change:

```bash
sudo systemctl restart queryproof-api queryproof-ai
```

Do not restart the database containers unless Mongo or Elasticsearch itself is down.

Jenkins on this PC:

```cmd
C:\Users\santosh10977\jenkins\start-jenkins.bat
```

Then open `http://localhost:8080` and build the `queryproof` job. The job will not deploy if SSH to the EC2 times out.

## NoSQL Booster cannot see the database

The error `MongoServerSelectionError` against `localhost:14993` means the program is not talking to MongoDB. Port 14993 is a temporary port the SSH tunnel opens on this PC. MongoDB is `127.0.0.1:27017` on the EC2, and only from inside that machine.

Use the connection named like `queryproof-ec2`, not a plain localhost connection.

- Basic server: `127.0.0.1`
- Basic port: `27017`
- Authentication: none
- SSH tunnel: on
- SSH address: `13.232.42.28`
- SSH port: `22`
- SSH user: `ubuntu`
- Private key: the OpenSSH export of the `.ppk` (the text starts with `BEGIN OPENSSH PRIVATE KEY`)

Do not type 14993, 27017 on the public address, or this PC's 192.168 address.

If that connection still times out:

1. PuTTY to `13.232.42.28` as `ubuntu` must succeed first. If PuTTY times out, fix the SSH /32 rule, then retry Booster.
2. On the server:

```bash
sudo docker ps --filter name=queryproof-mongo
sudo ss -ltnp | grep 27017
```

`27017` must show `127.0.0.1:27017`. If the container is missing:

```bash
cd ~/queryproof/infra/docker
sudo docker compose up -d mongodb elasticsearch
```

3. From the server, this must print `ok`:

```bash
sudo docker exec queryproof-mongo mongosh queryproof --quiet --eval 'db.runCommand({ ping: 1 }).ok'
```

## Page loads, questions fail

The page is static. Questions need Express and the API's allowed origin.

```bash
curl -s http://127.0.0.1:3000/health
grep '^ALLOWED_ORIGINS=' ~/queryproof/apps/api/.env
```

Health should include `"status":"ok"` and `"mongodb":"connected"`. `ALLOWED_ORIGINS` must include `https://queryproof-yushbyte.duckdns.org`. After changing it:

```bash
sudo systemctl restart queryproof-api
```

## Grade or ask returns an AI error

```bash
curl -s http://127.0.0.1:8000/health
sudo systemctl status queryproof-ai --no-pager
```

Health should say `"provider":"gemini"`. The Gemini key stays in `apps/ai-service/.env` on the server. Do not print that file.

## Recalls are missing

```bash
curl -s http://127.0.0.1:9200/drug_enforcement/_count
```

The count should be 300. A count of 0 right after a bulk load can mean the index has not refreshed yet. Check again after a second.

## HTTPS or the name fails

```bash
sudo nginx -t
sudo certbot certificates
curl -sI https://queryproof-yushbyte.duckdns.org | head
```

DNS for the name is DuckDNS, current IP `13.232.42.28`. If the name points at this PC's public address, open DuckDNS and set `queryproof-yushbyte` back to `13.232.42.28`.
