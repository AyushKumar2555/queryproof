# Deploy checklist (temporary)

Delete this file after the Mumbai box is serving the page. It is a working list, not the project README.

Target: one EC2 instance in Asia Pacific (Mumbai). Nginx is the only public app. It serves the built page and forwards `/api` to Express. Express, the AI service, MongoDB, and Elasticsearch stay on the machine and are not open to the internet.

The instance we measured has about 908 MB of memory. Elasticsearch 8.15 needs a larger machine before this deploy. Do the resize on the day you deploy, not before.

## 1. Decide before changing the instance

- [ ] Recheck the AWS console: credits left, days remaining, and that the one Elastic IP is attached to this instance. A stop/start without that address changes the public IP.
- [ ] Choose the public address the browser will use. An Elastic IP is enough for a first deploy. A domain and HTTPS can wait.
- [ ] Resize target: `t3.medium` in `ap-south-1` (4 GB). Last quoted price was about $0.0448/hour, near $33/month. It is not free-tier. `t3.micro` at about $0.0112/hour cannot run Elasticsearch.
- [ ] Export the local `drug_enforcement` documents before the resize. The mapping is in `infra/elasticsearch/recalls.index.json`. The ~300 records live only in the local Elasticsearch volume. They are not in git.

## 2. Resize and lock the network

- [ ] Stop the instance, change the type to `t3.medium`, start it, and confirm the Elastic IP is still attached.
- [ ] Security group allows only 22, 80, and 443 from the internet.
- [ ] Do not open 3000, 8000, 9200, 27017, or 5601.

## 3. Install on the box

- [ ] Docker, so MongoDB and Elasticsearch come from `infra/docker/docker-compose.yml`. On this server, start Mongo from that file. The Windows machine keeps using its own Mongo and must not start the compose Mongo service.
- [ ] Node.js for `apps/api`.
- [ ] Python 3.11 or 3.12 and a virtualenv for `apps/ai-service`. Keep the Elasticsearch Python client on 8.x. Client 9 gets HTTP 400 from Elasticsearch 8.15.3.
- [ ] Nginx.

## 4. Put the code and secrets on the server

- [ ] Clone the repo. Do not copy a developer `.env` into git.
- [ ] `apps/api/.env`: `NODE_ENV=production`, `MONGO_URI=mongodb://127.0.0.1:27017/queryproof`, `AI_SERVICE_URL=http://127.0.0.1:8000`, `ELASTICSEARCH_URL=http://127.0.0.1:9200`, `JWT_EXPIRES_IN=7d`.
- [ ] Set `JWT_SECRET` to a new long random value. The default `change-me-in-production` is not safe on a public machine.
- [ ] Set `ALLOWED_ORIGINS` to the exact public origin, for example `http://<elastic-ip>`. The page calls `/api` on that same origin. In production the API allows only this list.
- [ ] `apps/ai-service/.env`: `LLM_PROVIDER=gemini`, `LLM_MODEL=gemini-3.5-flash-lite`, `DEBUG=false`, and `GEMINI_API_KEY` set on the server only. `DEBUG=false` turns off `/docs`.
- [ ] `npm install` in `apps/api`. `pip install -r requirements.txt` in the AI virtualenv. `npm install` and `npm run build` in `apps/web`.

## 5. Start data services on localhost only

- [ ] Change the compose port bindings so MongoDB and Elasticsearch listen on `127.0.0.1`, not `0.0.0.0`.
- [ ] Leave Kibana off, or bind it to `127.0.0.1` only. The product does not need it in public.
- [ ] Start MongoDB and Elasticsearch. Wait until cluster health is yellow or green.
- [ ] Create the `drug_enforcement` index from `infra/elasticsearch/recalls.index.json`.
- [ ] Load the exported ~300 documents. Confirm the count is 300.
- [ ] From `apps/api`, run `node src/seed-eval.js` once. That inserts the insulin answer key if it is missing.

## 6. Run the two app processes

- [ ] API: `npm start` in `apps/api` (port 3000). AI: the virtualenv Python running `main.py` (port 8000). Both must restart if the machine reboots. systemd is enough.
- [ ] Confirm from the server itself: `curl http://127.0.0.1:8000/health` and `curl http://127.0.0.1:3000/health`.

## 7. Nginx is the only public door

- [ ] Serve `apps/web/dist` as the site root. Unknown paths fall back to `index.html`.
- [ ] Forward `/api/` to `http://127.0.0.1:3000`.
- [ ] Set the proxy read timeout to at least 120 seconds. Ask and grade wait on Gemini and can take about a minute.
- [ ] Do not proxy `/api/v1` to the AI service. The browser talks only to Express.

## 8. Prove it from outside the server

- [ ] Open `http://<elastic-ip>` in a browser that is not the EC2 box.
- [ ] The page explains the grade before the sign-in form.
- [ ] Create an account, sign in, and ask `Semaglutide recalls in Pennsylvania`. Expect the ProRx recall, Class II, state PA.
- [ ] Grade the answer keys. The insulin case can score 5 of 5 and still show no matching recalls. That split is the product.
- [ ] Sign out. A second account does not see the first account's questions.
- [ ] From a laptop, these must fail: ports 3000, 8000, 9200, and 27017.

## Not part of this deploy

- HTTPS and a domain name, until the IP deploy works.
- Auth beyond the account, token, and per-user history already built.
- A second machine, a managed database, or a public Kibana.
