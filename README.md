# Smart Parking prototype

This project simulates parking sensors with Node.js, processes MQTT messages in Node-RED, and uses AWS API Gateway, Lambda, DynamoDB and EventBridge for cloud storage, permit checks, alerts and gateway monitoring. The entrance display is a terminal program; no physical sensor or display hardware is included.

## Local setup

1. Use Node.js 24 or later. The simulator scripts use Node's built-in `process.loadEnvFile`.
2. Copy `.env.example` to `.env`. Set `MQTT_HOST` to the broker hostname only (no `mqtts://` or port), then enter your own MQTT username, MQTT password and `SMART_PARKING_API_KEY`. `.env` is ignored by Git and must not be shared.
3. Run `npm ci` in `simulators/` and `dashboard/` to install their declared dependencies. The root package has `dotenv-cli` for launching processes with the local environment.
4. Run `node simulators/entrace_display.js` and `node simulators/parking_node.js A01 ABC123 working` from the project root. The parking simulator publishes every two seconds and chooses occupied/available at random. Stop it with Ctrl+C when finished.
5. Import `edge/node-red/flows.json` into Node-RED. Start Node-RED with `SMART_PARKING_API_KEY` in its process environment; the flow reads that variable with `env.get`. Configure the HiveMQ broker credentials privately in Node-RED. Importing the flow file alone does not supply the broker password.
6. Run `node dashboard/server.js` and open `http://localhost:3000` to view the local dashboard. Its saved API origin is the one in `dashboard/script.js` and `dashboard/server.js`; update both if the AWS API is rebuilt.

The files under `aws/` are saved source/configuration exports, not a complete automatic deployment. They contain no payment sample rows or private API keys. The test scripts under `testdata/` send requests to the AWS API and can create records; inspect their target URL, input data and required key before running them. The main report plan and evidence should record actual test results separately.

## GitHub contents

Commit source, package manifests and lockfiles, the sanitized Node-RED flow, AWS source/configuration exports, `.env.example`, documentation and reviewed evidence. Do not commit `.env`, installed `node_modules`, private backups, archives or logs. The existing `architecture.png` is excluded because it does not match the current gateway services; create a corrected diagram before adding architecture evidence.
